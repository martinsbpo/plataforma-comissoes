'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type LinhaVinculada = {
  importacao_linha_id: string
  producao_id: string
  seguradora_id: string
  seguradora_nome: string
  referencia: string
  segurado: string
  produto: string | null
  parcela_comissionada: number | null
  total_parcelas: number | null
  comissao_recebida: number
  aliquota_pct: number
  imposto_valor: number
  indicador_id: string | null
  indicador_nome: string | null
  pct_indicador: number | null
  repasse_indicador: number
  corretor1_id: string | null
  corretor1_nome: string | null
  pct_corretor1: number | null
  repasse_corretor1: number
  corretor2_id: string | null
  corretor2_nome: string | null
  pct_corretor2: number | null
  repasse_corretor2: number
  resultado: number
}

export type LinhaSemProducao = {
  importacao_linha_id: string
  seguradora_id: string
  seguradora_nome: string
  referencia: string
  segurado: string
  produto: string | null
  comissao_recebida: number
}

export type ResultadoCalculo = {
  vinculadas: LinhaVinculada[]
  sem_producao: LinhaSemProducao[]
  aliquota_pct: number
  total_comissao: number
  total_imposto: number
  total_repasses: number
  total_resultado: number
  sem_aliquota: boolean
}

export async function calcularApuracao(
  tenantId: string,
  competencia: string  // YYYY-MM
): Promise<{ error: string } | ResultadoCalculo> {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) return { error: 'Sem permissão' }

  const db = admin()
  const competenciaDate = `${competencia}-01`

  // Busca alíquota do mês
  const { data: aliquotaRow } = await db
    .from('aliquotas_mensais')
    .select('aliquota_global')
    .eq('tenant_id', tenantId)
    .eq('competencia', competenciaDate)
    .maybeSingle()

  const aliquota_pct = aliquotaRow?.aliquota_global ?? 0
  const sem_aliquota = !aliquotaRow

  // Busca todas as linhas de importação confirmadas da competência
  const { data: importacoes } = await db
    .from('importacoes')
    .select('id, seguradora_id, seguradora:seguradora_id(nome_fantasia, nome)')
    .eq('tenant_id', tenantId)
    .eq('competencia', competenciaDate)
    .eq('status', 'confirmada')

  if (!importacoes || importacoes.length === 0) {
    return { error: 'Nenhum relatório confirmado encontrado para esta competência.' }
  }

  const importacaoIds = importacoes.map(i => i.id)

  // Busca linhas dos relatórios (agrupa por referencia para somar valores)
  const { data: linhasRelatorio } = await db
    .from('importacao_linhas')
    .select('id, importacao_id, referencia, nome_segurado, grupo_produto_id, produto_id, valor, tipo_valor, parcela_comissionada, total_parcelas')
    .in('importacao_id', importacaoIds)

  if (!linhasRelatorio || linhasRelatorio.length === 0) {
    return { error: 'Nenhuma linha encontrada nos relatórios desta competência.' }
  }

  // Mapa importacao_id -> seguradora
  type SegRow = { nome_fantasia: string | null; nome: string } | { nome_fantasia: string | null; nome: string }[] | null
  const segByImportacao: Record<string, { id: string; nome: string }> = {}
  for (const imp of importacoes) {
    const seg = imp.seguradora as SegRow
    const nome = Array.isArray(seg)
      ? (seg[0]?.nome_fantasia ?? seg[0]?.nome ?? '')
      : ((seg as { nome_fantasia: string | null; nome: string } | null)?.nome_fantasia ?? (seg as { nome_fantasia: string | null; nome: string } | null)?.nome ?? '')
    segByImportacao[imp.id] = { id: imp.seguradora_id, nome }
  }

  // Agrega valores por (seguradora_id, referencia) — soma todos os tipos de valor
  const agregado: Record<string, {
    importacao_linha_id: string
    seguradora_id: string
    seguradora_nome: string
    referencia: string
    segurado: string
    produto_id: string | null
    parcela_comissionada: number | null
    total_parcelas: number | null
    valor: number
  }> = {}

  for (const linha of linhasRelatorio) {
    const seg = segByImportacao[linha.importacao_id]
    if (!seg) continue
    const chave = `${seg.id}::${linha.referencia.trim().toUpperCase()}`
    if (!agregado[chave]) {
      agregado[chave] = {
        importacao_linha_id: linha.id,
        seguradora_id: seg.id,
        seguradora_nome: seg.nome,
        referencia: linha.referencia.trim().toUpperCase(),
        segurado: linha.nome_segurado,
        produto_id: linha.produto_id,
        parcela_comissionada: linha.parcela_comissionada ?? null,
        total_parcelas: linha.total_parcelas ?? null,
        valor: 0,
      }
    }
    agregado[chave].valor += Number(linha.valor)
  }

  // Busca nomes de produtos (usado tanto nas vinculadas quanto nas sem produção)
  const produtoIds = [...new Set(Object.values(agregado).map(a => a.produto_id).filter(Boolean))] as string[]
  const produtoNomeMap: Record<string, string> = {}
  if (produtoIds.length > 0) {
    const { data: prods } = await db.from('produtos').select('id, nome').in('id', produtoIds)
    for (const p of prods ?? []) produtoNomeMap[p.id] = p.nome
  }

  // Busca produção do tenant (sem filtro de competência — vale para qualquer mês)
  const { data: producao } = await db
    .from('producao')
    .select(`
      id, seguradora_id, referencia,
      indicador_id, pct_indicador, indicador:indicador_id(nome),
      corretor1_id, pct_corretor1, corretor1:corretor1_id(nome),
      corretor2_id, pct_corretor2, corretor2:corretor2_id(nome),
      produto:produto_id(nome), grupo_produto:grupo_produto_id(nome)
    `)
    .eq('tenant_id', tenantId)

  // Mapa producao por (seguradora_id, referencia)
  type NomeRow = { nome: string } | { nome: string }[] | null
  const resolvNome = (v: NomeRow) => {
    if (!v) return null
    if (Array.isArray(v)) return v[0]?.nome ?? null
    return (v as { nome: string }).nome
  }

  const prodMap: Record<string, typeof producao extends (infer T)[] | null ? T : never> = {}
  for (const p of producao ?? []) {
    const chave = `${p.seguradora_id}::${p.referencia.trim().toUpperCase()}`
    prodMap[chave] = p
  }

  // Cruza e calcula
  const vinculadas: LinhaVinculada[] = []
  const sem_producao: LinhaSemProducao[] = []

  for (const [chave, item] of Object.entries(agregado)) {
    const prod = prodMap[chave]
    const comissao = item.valor

    if (!prod) {
      sem_producao.push({
        importacao_linha_id: item.importacao_linha_id,
        seguradora_id: item.seguradora_id,
        seguradora_nome: item.seguradora_nome,
        referencia: item.referencia,
        segurado: item.segurado,
        produto: item.produto_id ? (produtoNomeMap[item.produto_id] ?? null) : null,
        comissao_recebida: parseFloat(comissao.toFixed(2)),
      })
      continue
    }

    const imposto_valor = parseFloat((comissao * (aliquota_pct / 100)).toFixed(2))
    const base = comissao * (1 - aliquota_pct / 100)
    const pct_ind = prod.pct_indicador ? Number(prod.pct_indicador) : 0
    const pct_c1 = prod.pct_corretor1 ? Number(prod.pct_corretor1) : 0
    const pct_c2 = prod.pct_corretor2 ? Number(prod.pct_corretor2) : 0
    const rep_ind = parseFloat((prod.indicador_id ? base * (pct_ind / 100) : 0).toFixed(2))
    const rep_c1 = parseFloat((prod.corretor1_id ? base * (pct_c1 / 100) : 0).toFixed(2))
    const rep_c2 = parseFloat((prod.corretor2_id ? base * (pct_c2 / 100) : 0).toFixed(2))
    const resultado = parseFloat((comissao - imposto_valor - rep_ind - rep_c1 - rep_c2).toFixed(2))

    // produto: preferência para o que veio do relatório da seguradora (tem de-para aplicado)
    const produtoNome = (item.produto_id ? produtoNomeMap[item.produto_id] : null)
      ?? resolvNome(prod.produto as NomeRow)
      ?? resolvNome(prod.grupo_produto as NomeRow)

    vinculadas.push({
      importacao_linha_id: item.importacao_linha_id,
      producao_id: prod.id,
      seguradora_id: item.seguradora_id,
      seguradora_nome: item.seguradora_nome,
      referencia: item.referencia,
      segurado: item.segurado,
      produto: produtoNome,
      parcela_comissionada: item.parcela_comissionada,
      total_parcelas: item.total_parcelas,
      comissao_recebida: parseFloat(comissao.toFixed(2)),
      aliquota_pct,
      imposto_valor,
      indicador_id: prod.indicador_id,
      indicador_nome: resolvNome(prod.indicador as NomeRow),
      pct_indicador: pct_ind || null,
      repasse_indicador: rep_ind,
      corretor1_id: prod.corretor1_id,
      corretor1_nome: resolvNome(prod.corretor1 as NomeRow),
      pct_corretor1: pct_c1 || null,
      repasse_corretor1: rep_c1,
      corretor2_id: prod.corretor2_id,
      corretor2_nome: resolvNome(prod.corretor2 as NomeRow),
      pct_corretor2: pct_c2 || null,
      repasse_corretor2: rep_c2,
      resultado,
    })
  }

  const total_comissao = parseFloat(vinculadas.reduce((s, l) => s + l.comissao_recebida, 0).toFixed(2))
  const total_imposto = parseFloat(vinculadas.reduce((s, l) => s + l.imposto_valor, 0).toFixed(2))
  const total_repasses = parseFloat(vinculadas.reduce((s, l) => s + l.repasse_indicador + l.repasse_corretor1 + l.repasse_corretor2, 0).toFixed(2))
  const total_resultado = parseFloat(vinculadas.reduce((s, l) => s + l.resultado, 0).toFixed(2))

  return { vinculadas, sem_producao, aliquota_pct, total_comissao, total_imposto, total_repasses, total_resultado, sem_aliquota }
}

export async function confirmarApuracao(
  tenantId: string,
  competencia: string,
  resultado: ResultadoCalculo
) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) return { error: 'Sem permissão' }
  if (resultado.sem_aliquota) return { error: 'Alíquota não cadastrada — não é possível confirmar.' }

  const db = admin()
  const competenciaDate = `${competencia}-01`

  // Upsert cabeçalho
  const { data: apuracao, error: apErr } = await db
    .from('apuracoes')
    .upsert({
      tenant_id: tenantId,
      competencia: competenciaDate,
      status: 'confirmada',
      aliquota_pct: resultado.aliquota_pct,
      total_comissao: resultado.total_comissao,
      total_imposto: resultado.total_imposto,
      total_repasses: resultado.total_repasses,
      total_resultado: resultado.total_resultado,
      confirmado_por: session.id,
      confirmado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,competencia' })
    .select('id')
    .single()

  if (apErr || !apuracao) return { error: apErr?.message ?? 'Erro ao salvar apuração' }

  // Apaga linhas anteriores e reinseere
  await db.from('apuracao_linhas').delete().eq('apuracao_id', apuracao.id)

  if (resultado.vinculadas.length > 0) {
    const linhas = resultado.vinculadas.map(l => ({
      apuracao_id: apuracao.id,
      importacao_linha_id: l.importacao_linha_id,
      producao_id: l.producao_id,
      seguradora_id: l.seguradora_id,
      referencia: l.referencia,
      segurado: l.segurado,
      produto: l.produto,
      parcela_comissionada: l.parcela_comissionada,
      total_parcelas: l.total_parcelas,
      comissao_recebida: l.comissao_recebida,
      aliquota_pct: l.aliquota_pct,
      imposto_valor: l.imposto_valor,
      indicador_id: l.indicador_id,
      indicador_nome: l.indicador_nome,
      pct_indicador: l.pct_indicador,
      repasse_indicador: l.repasse_indicador,
      corretor1_id: l.corretor1_id,
      corretor1_nome: l.corretor1_nome,
      pct_corretor1: l.pct_corretor1,
      repasse_corretor1: l.repasse_corretor1,
      corretor2_id: l.corretor2_id,
      corretor2_nome: l.corretor2_nome,
      pct_corretor2: l.pct_corretor2,
      repasse_corretor2: l.repasse_corretor2,
      resultado: l.resultado,
    }))
    const { error: linhasErr } = await db.from('apuracao_linhas').insert(linhas)
    if (linhasErr) return { error: linhasErr.message }
  }

  revalidatePath('/financeiro')
  return { ok: true, apuracao_id: apuracao.id }
}

export async function reabrirApuracao(tenantId: string, competencia: string) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (session.role !== 'bpo_admin') return { error: 'Apenas BPO Admin pode reabrir uma apuração.' }

  const db = admin()
  const { error } = await db
    .from('apuracoes')
    .update({ status: 'rascunho', confirmado_por: null, confirmado_em: null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('competencia', `${competencia}-01`)

  if (error) return { error: error.message }
  revalidatePath('/financeiro')
  return { ok: true }
}
