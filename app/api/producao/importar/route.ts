import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// Normaliza string para matching
const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')

// Mapeamento automático por nome de coluna
const FIELD_ALIASES: Record<string, string> = {
  'SEG+REF': 'seg_ref', 'SEG_REF': 'seg_ref', 'REF': 'referencia',
  'DATA': 'data', 'DT': 'data', 'DATA NEGOCIO': 'data', 'DATA DO NEGOCIO': 'data',
  'SEGURADORA': 'seguradora', 'SEGUR': 'seguradora',
  'SEGURADO': 'segurado', 'NOME': 'segurado', 'NOME SEGURADO': 'segurado',
  'REF SEGURADORA': 'referencia', 'REFERENCIA': 'referencia', 'APOLICE': 'referencia', 'APÓLICE': 'referencia',
  'CPF': 'cpf_segurado', 'CPF DO SEGURADO': 'cpf_segurado', 'CPF SEGURADO': 'cpf_segurado',
  'GRUPO': 'grupo_produto', 'GRUPO DE PRODUTO': 'grupo_produto', 'GRUPO PRODUTO': 'grupo_produto',
  'PRODUTO': 'produto',
  'COMISSAO': 'comissao', 'COMISSÃO': 'comissao', 'VL COMISSAO': 'comissao',
  'INDICADOR': 'indicador', 'IND': 'indicador',
  '% INDICADOR': 'pct_indicador', 'PCT INDICADOR': 'pct_indicador',
  'CORRETOR1': 'corretor1', 'CORRETOR 1': 'corretor1', 'COR1': 'corretor1',
  '% CORRETOR1': 'pct_corretor1', 'PCT CORRETOR1': 'pct_corretor1',
  'CORRETOR2': 'corretor2', 'CORRETOR 2': 'corretor2', 'COR2': 'corretor2',
  '% CORRETOR2': 'pct_corretor2', 'PCT CORRETOR2': 'pct_corretor2',
  'IMPOSTOS': 'impostos_pct', '% IMPOSTOS': 'impostos_pct', 'IMPOSTO': 'impostos_pct',
}

function detectMapping(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {}
  headers.forEach((h, i) => {
    const key = norm(h)
    if (FIELD_ALIASES[key]) mapping[i] = FIELD_ALIASES[key]
  })
  return mapping
}

function parseExcelDate(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    const mm = String(d.m).padStart(2, '0')
    const dd = String(d.d).padStart(2, '0')
    return `${d.y}-${mm}-${dd}`
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    // DD/MM/YYYY
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  }
  return null
}

function parseNum(val: unknown): number | null {
  if (val == null || val === '') return null
  const n = typeof val === 'string' ? parseFloat(val.replace(',', '.').replace(/[^0-9.-]/g, '')) : Number(val)
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const formData = await req.formData()
  const arquivo = formData.get('arquivo') as File | null
  const competencia = formData.get('competencia') as string | null  // YYYY-MM
  const mapeamentoJson = formData.get('mapeamento') as string | null
  const duplicataAcao = (formData.get('duplicata_acao') as string) ?? 'ignorar'  // ignorar | sobrescrever
  const linhaInicio = parseInt((formData.get('linha_inicio') as string) ?? '1')
  const preview = formData.get('preview') === 'true'

  if (!arquivo || !competencia) {
    return NextResponse.json({ error: 'arquivo e competencia são obrigatórios' }, { status: 400 })
  }

  const db = admin()
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  if (raw.length < 2) return NextResponse.json({ error: 'Arquivo sem dados' }, { status: 400 })

  const headerRow = raw[linhaInicio - 1] as string[]
  const dataRows = raw.slice(linhaInicio)

  // Mapeamento: pode vir do cliente (ajustado) ou auto-detectado
  const mapping: Record<number, string> = mapeamentoJson
    ? JSON.parse(mapeamentoJson)
    : detectMapping(headerRow)

  if (preview) {
    return NextResponse.json({ headers: headerRow, mapping, preview: dataRows.slice(0, 10) })
  }

  // Carrega parceiros e grupos/produtos do tenant para matching
  const [{ data: parceiros }, { data: seguradoras }, { data: grupos }, { data: produtos }, aliquota] = await Promise.all([
    db.from('parceiros').select('id, nome').eq('tenant_id', session.tenantId).eq('status', 'ativo'),
    db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo'),
    db.from('grupos_produto').select('id, nome'),
    db.from('produtos').select('id, nome, grupo_produto_id'),
    db.from('aliquotas_mensais').select('aliquota_global')
      .eq('tenant_id', session.tenantId)
      .eq('competencia', `${competencia}-01`)
      .maybeSingle(),
  ])

  const impostoPct = aliquota.data?.aliquota_global ?? 0

  const matchParceiro = (nome: string) => {
    if (!nome || !parceiros) return null
    const n = norm(nome)
    return parceiros.find(p => norm(p.nome) === n) ?? null
  }
  const matchSeguradora = (nome: string) => {
    if (!nome || !seguradoras) return null
    const n = norm(nome)
    return seguradoras.find(s => norm(s.nome_fantasia ?? s.nome) === n || norm(s.nome) === n) ?? null
  }
  const matchGrupo = (nome: string) => grupos?.find(g => norm(g.nome) === norm(nome)) ?? null
  const matchProduto = (nome: string) => produtos?.find(p => norm(p.nome) === norm(nome)) ?? null

  const competenciaDate = `${competencia}-01`

  const linhasOk: Record<string, unknown>[] = []
  const linhasErro: { row: number; motivo: string; dados: unknown[] }[] = []
  const linhasAlerta: { row: number; campo: string; valor: string }[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[]
    if (row.every(c => c === '' || c == null)) continue  // linha em branco

    const get = (field: string) => {
      const idx = Object.entries(mapping).find(([, v]) => v === field)?.[0]
      return idx != null ? row[parseInt(idx)] : undefined
    }

    // Campos obrigatórios
    const dataVal = parseExcelDate(get('data'))
    const comissaoVal = parseNum(get('comissao'))

    let referencia = String(get('referencia') ?? get('seg_ref') ?? '').trim().toUpperCase()
    let seguradoraId: string | null = null

    // Se tem seg_ref: separar prefixo de seguradora
    const segRefRaw = String(get('seg_ref') ?? '').trim()
    if (segRefRaw && !referencia) {
      referencia = segRefRaw.replace(/^[A-Z]+/i, '').trim().toUpperCase() || segRefRaw.toUpperCase()
    }

    const seguradoraRaw = String(get('seguradora') ?? '').trim()
    if (seguradoraRaw) {
      const seg = matchSeguradora(seguradoraRaw)
      if (seg) seguradoraId = seg.id
      else linhasAlerta.push({ row: i + linhaInicio + 1, campo: 'seguradora', valor: seguradoraRaw })
    }

    const segurado = String(get('segurado') ?? '').trim()

    if (!dataVal || comissaoVal == null || !referencia || !segurado) {
      const faltando = [!dataVal && 'DATA', comissaoVal == null && 'COMISSÃO', !referencia && 'REFERÊNCIA', !segurado && 'SEGURADO'].filter(Boolean).join(', ')
      linhasErro.push({ row: i + linhaInicio + 1, motivo: `Campos obrigatórios faltando: ${faltando}`, dados: row })
      continue
    }

    const indicadorRaw = String(get('indicador') ?? '').trim()
    const corretor1Raw = String(get('corretor1') ?? '').trim()
    const corretor2Raw = String(get('corretor2') ?? '').trim()

    const indicador = indicadorRaw ? matchParceiro(indicadorRaw) : null
    const corretor1 = corretor1Raw ? matchParceiro(corretor1Raw) : null
    const corretor2 = corretor2Raw ? matchParceiro(corretor2Raw) : null

    if (indicadorRaw && !indicador) linhasAlerta.push({ row: i + linhaInicio + 1, campo: 'indicador', valor: indicadorRaw })
    if (corretor1Raw && !corretor1) linhasAlerta.push({ row: i + linhaInicio + 1, campo: 'corretor1', valor: corretor1Raw })
    if (corretor2Raw && !corretor2) linhasAlerta.push({ row: i + linhaInicio + 1, campo: 'corretor2', valor: corretor2Raw })

    const grupoProdutoRaw = String(get('grupo_produto') ?? '').trim()
    const produtoRaw = String(get('produto') ?? '').trim()
    const grupo = grupoProdutoRaw ? matchGrupo(grupoProdutoRaw) : null
    const produto = produtoRaw ? matchProduto(produtoRaw) : null

    const pctInd = parseNum(get('pct_indicador'))
    const pctCor1 = parseNum(get('pct_corretor1'))
    const pctCor2 = parseNum(get('pct_corretor2'))
    const impostosRaw = parseNum(get('impostos_pct'))
    const impostosFinal = impostosRaw ?? impostoPct

    // Cálculo de repasses
    const impostosValor = comissaoVal * (impostosFinal / 100)
    const baseRepasse = comissaoVal * (1 - impostosFinal / 100)
    const repInd = indicador && pctInd ? baseRepasse * (pctInd / 100) : 0
    const repCor1 = corretor1 && pctCor1 ? baseRepasse * (pctCor1 / 100) : 0
    const repCor2 = corretor2 && pctCor2 ? baseRepasse * (pctCor2 / 100) : 0
    const resultado = comissaoVal - impostosValor - repInd - repCor1 - repCor2

    linhasOk.push({
      tenant_id: session.tenantId,
      competencia: competenciaDate,
      data: dataVal,
      seguradora_id: seguradoraId,
      segurado,
      referencia,
      cpf_segurado: String(get('cpf_segurado') ?? '').trim() || null,
      grupo_produto_id: grupo?.id ?? null,
      produto_id: produto?.id ?? null,
      comissao: comissaoVal,
      indicador_id: indicador?.id ?? null,
      pct_indicador: pctInd,
      corretor1_id: corretor1?.id ?? null,
      pct_corretor1: pctCor1,
      corretor2_id: corretor2?.id ?? null,
      pct_corretor2: pctCor2,
      impostos_pct: impostosFinal,
      repasse_indicador: parseFloat(repInd.toFixed(2)),
      repasse_corretor1: parseFloat(repCor1.toFixed(2)),
      repasse_corretor2: parseFloat(repCor2.toFixed(2)),
      resultado: parseFloat(resultado.toFixed(2)),
      origem: 'importacao_planilha',
      status_vinculacao: 'pendente',
      status_periodo: 'aberto',
    })
  }

  if (linhasOk.length === 0) {
    return NextResponse.json({ importadas: 0, ignoradas: linhasErro.length, erros: linhasErro, alertas: linhasAlerta })
  }

  // Trata duplicatas
  const referencias = linhasOk.map(l => l.referencia as string)
  const { data: existentes } = await db
    .from('producao')
    .select('id, referencia, seguradora_id')
    .eq('tenant_id', session.tenantId)
    .eq('competencia', competenciaDate)
    .in('referencia', referencias)

  const existentesSet = new Set((existentes ?? []).map(e => `${e.seguradora_id}::${e.referencia}`))

  let importadas = 0
  const linhasParaInserir = []
  const linhasParaSobrescrever = []

  for (const linha of linhasOk) {
    const chave = `${linha.seguradora_id}::${linha.referencia}`
    if (existentesSet.has(chave)) {
      if (duplicataAcao === 'sobrescrever') linhasParaSobrescrever.push(linha)
      // else ignorar
    } else {
      linhasParaInserir.push(linha)
    }
  }

  if (linhasParaInserir.length > 0) {
    const { data: inserted } = await db.from('producao').insert(linhasParaInserir).select('id')
    importadas += inserted?.length ?? 0
  }

  if (linhasParaSobrescrever.length > 0) {
    for (const linha of linhasParaSobrescrever) {
      const { data: existente } = await db
        .from('producao')
        .select('id')
        .eq('tenant_id', session.tenantId)
        .eq('competencia', competenciaDate)
        .eq('seguradora_id', linha.seguradora_id as string)
        .eq('referencia', linha.referencia as string)
        .maybeSingle()

      if (existente) {
        await db.from('producao').update({ ...linha, updated_at: new Date().toISOString() }).eq('id', existente.id)
        importadas++
      }
    }
  }

  return NextResponse.json({
    importadas,
    ignoradas: linhasErro.length + (duplicataAcao === 'ignorar' ? (linhasOk.length - linhasParaInserir.length - linhasParaSobrescrever.length) : 0),
    erros: linhasErro,
    alertas: linhasAlerta,
    sem_imposto: impostoPct === 0,
  })
}
