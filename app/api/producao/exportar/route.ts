import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const fmtPct = (v: number | null) => v != null ? v / 100 : null

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const mes_inicio = searchParams.get('mes_inicio')
  const mes_fim = searchParams.get('mes_fim')
  const seguradora = searchParams.get('seguradora')
  const parceiro = searchParams.get('parceiro')
  const q = searchParams.get('q')
  const vinculacao = searchParams.get('vinculacao')

  const db = admin()

  let query = db
    .from('producao')
    .select(`
      competencia, data, referencia, segurado, cpf_segurado,
      comissao, impostos_pct,
      indicador_id, pct_indicador, repasse_indicador,
      corretor1_id, pct_corretor1, repasse_corretor1,
      corretor2_id, pct_corretor2, repasse_corretor2,
      resultado,
      seguradora:seguradora_id (nome_fantasia, nome),
      indicador:indicador_id (nome),
      corretor1:corretor1_id (nome),
      corretor2:corretor2_id (nome),
      grupo_produto:grupo_produto_id (nome),
      produto:produto_id (nome)
    `)
    .eq('tenant_id', session.tenantId)
    .order('competencia', { ascending: false })
    .order('created_at', { ascending: false })

  if (mes_inicio) query = query.gte('competencia', `${mes_inicio}-01`)
  if (mes_fim) query = query.lte('competencia', `${mes_fim}-01`)
  if (seguradora) query = query.eq('seguradora_id', seguradora)
  if (vinculacao) query = query.eq('status_vinculacao', vinculacao)
  if (parceiro) query = query.or(`indicador_id.eq.${parceiro},corretor1_id.eq.${parceiro},corretor2_id.eq.${parceiro}`)
  if (q) query = query.or(`segurado.ilike.%${q}%,referencia.ilike.%${q}%,cpf_segurado.ilike.%${q}%`)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type SegRow = { nome_fantasia: string | null; nome: string } | { nome_fantasia: string | null; nome: string }[] | null
  type NomeRow = { nome: string } | { nome: string }[] | null

  const resolve = (v: SegRow | NomeRow) => {
    if (!v) return ''
    if (Array.isArray(v)) return (v[0] as { nome: string; nome_fantasia?: string | null })?.nome_fantasia ?? (v[0] as { nome: string })?.nome ?? ''
    return (v as { nome_fantasia?: string | null; nome: string }).nome_fantasia ?? (v as { nome: string }).nome ?? ''
  }

  const wsData = [
    [
      'SEG+REF', 'DATA', 'SEGURADORA', 'SEGURADO', 'REF SEGURADORA', 'CPF DO SEGURADO',
      'GRUPO DE PRODUTO', 'PRODUTO', 'COMISSÃO', 'INDICADOR', '% INDICADOR',
      'CORRETOR1', '% CORRETOR1', 'CORRETOR2', '% CORRETOR2',
      'IMPOSTOS', 'REPASSE INDICADOR', 'REPASSE CORRETOR1', 'REPASSE CORRETOR2', 'RESULTADO',
    ],
    ...(rows ?? []).map(r => {
      const segNome = resolve(r.seguradora as SegRow)
      const impostosValor = r.comissao * (r.impostos_pct / 100)
      return [
        `${segNome.slice(0, 3).toUpperCase()}${r.referencia}`,
        fmtDate(r.data),
        segNome,
        r.segurado,
        r.referencia,
        r.cpf_segurado ?? '',
        resolve(r.grupo_produto as NomeRow),
        resolve(r.produto as NomeRow),
        r.comissao,
        resolve(r.indicador as NomeRow),
        fmtPct(r.pct_indicador),
        resolve(r.corretor1 as NomeRow),
        fmtPct(r.pct_corretor1),
        resolve(r.corretor2 as NomeRow),
        fmtPct(r.pct_corretor2),
        impostosValor,
        r.repasse_indicador,
        r.repasse_corretor1,
        r.repasse_corretor2,
        r.resultado,
      ]
    }),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Formato de células monetárias (colunas I, P, Q, R, S, T = índices 8,15,16,17,18,19)
  const moneyFmt = '#,##0.00'
  const pctFmt = '0.00%'
  const moneyColIdxs = [8, 15, 16, 17, 18, 19]
  const pctColIdxs = [10, 12, 14]

  if (!ws['!cols']) ws['!cols'] = []
  ;[...moneyColIdxs, ...pctColIdxs].forEach(i => {
    if (!ws['!cols']![i]) ws['!cols']![i] = {}
    ws['!cols']![i].wch = 14
  })

  for (let row = 1; row < wsData.length; row++) {
    moneyColIdxs.forEach(col => {
      const cell = XLSX.utils.encode_cell({ r: row, c: col })
      if (ws[cell]) ws[cell].z = moneyFmt
    })
    pctColIdxs.forEach(col => {
      const cell = XLSX.utils.encode_cell({ r: row, c: col })
      if (ws[cell]) ws[cell].z = pctFmt
    })
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Produção')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const tenantSlug = session.tenantNome.slice(0, 20).toLowerCase().replace(/\s+/g, '_')
  const periodoStr = mes_inicio && mes_fim
    ? `${mes_inicio}_${mes_fim}`
    : mes_inicio ?? mes_fim ?? 'completo'
  const filename = `producao_${tenantSlug}_${periodoStr}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
