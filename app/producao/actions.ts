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

export type ProducaoFormData = {
  competencia: string    // YYYY-MM
  data: string           // YYYY-MM-DD
  seguradora_id: string
  segurado: string
  referencia: string
  cpf_segurado?: string
  grupo_produto_id?: string
  produto_id?: string
  comissao: number
  indicador_id?: string
  pct_indicador?: number
  corretor1_id?: string
  pct_corretor1?: number
  corretor2_id?: string
  pct_corretor2?: number
  impostos_pct: number
  observacoes?: string
}

function calcularRepasses(data: ProducaoFormData) {
  const { comissao, impostos_pct, pct_indicador, pct_corretor1, pct_corretor2 } = data
  const impostos_valor = comissao * (impostos_pct / 100)
  const base_repasse = comissao * (1 - impostos_pct / 100)
  const repasse_indicador = pct_indicador ? base_repasse * (pct_indicador / 100) : 0
  const repasse_corretor1 = pct_corretor1 ? base_repasse * (pct_corretor1 / 100) : 0
  const repasse_corretor2 = pct_corretor2 ? base_repasse * (pct_corretor2 / 100) : 0
  const resultado = comissao - impostos_valor - repasse_indicador - repasse_corretor1 - repasse_corretor2
  return {
    repasse_indicador: parseFloat(repasse_indicador.toFixed(2)),
    repasse_corretor1: parseFloat(repasse_corretor1.toFixed(2)),
    repasse_corretor2: parseFloat(repasse_corretor2.toFixed(2)),
    resultado: parseFloat(resultado.toFixed(2)),
  }
}

function competenciaToDate(periodo: string) {
  return `${periodo}-01`
}

export async function buscarAliquotaMes(tenantId: string, competencia: string) {
  const db = admin()
  const { data } = await db
    .from('aliquotas_mensais')
    .select('aliquota_global')
    .eq('tenant_id', tenantId)
    .eq('competencia', competenciaToDate(competencia))
    .single()
  return data?.aliquota_global ?? null
}

export async function criarProducao(formData: ProducaoFormData) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const db = admin()
  const repasses = calcularRepasses(formData)

  // Aviso de duplicata (não bloqueante)
  const competenciaDate = competenciaToDate(formData.competencia)
  const { data: dup } = await db
    .from('producao')
    .select('id')
    .eq('tenant_id', session.tenantId)
    .eq('seguradora_id', formData.seguradora_id)
    .eq('referencia', formData.referencia.trim().toUpperCase())
    .eq('competencia', competenciaDate)
    .limit(1)
    .maybeSingle()

  const { data, error } = await db
    .from('producao')
    .insert({
      tenant_id: session.tenantId,
      competencia: competenciaDate,
      data: formData.data,
      seguradora_id: formData.seguradora_id,
      segurado: formData.segurado,
      referencia: formData.referencia.trim().toUpperCase(),
      cpf_segurado: formData.cpf_segurado || null,
      grupo_produto_id: formData.grupo_produto_id || null,
      produto_id: formData.produto_id || null,
      comissao: formData.comissao,
      indicador_id: formData.indicador_id || null,
      pct_indicador: formData.pct_indicador ?? null,
      corretor1_id: formData.corretor1_id || null,
      pct_corretor1: formData.pct_corretor1 ?? null,
      corretor2_id: formData.corretor2_id || null,
      pct_corretor2: formData.pct_corretor2 ?? null,
      impostos_pct: formData.impostos_pct,
      ...repasses,
      observacoes: formData.observacoes || null,
      origem: 'manual',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/producao')
  return { id: data.id, duplicata: !!dup }
}

export async function atualizarProducao(id: string, formData: ProducaoFormData) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const db = admin()

  // Verificar se período está fechado
  const competenciaDate = competenciaToDate(formData.competencia)
  const { data: linha } = await db
    .from('producao')
    .select('status_periodo, tenant_id')
    .eq('id', id)
    .single()

  if (!linha) return { error: 'Registro não encontrado' }
  if (linha.tenant_id !== session.tenantId) return { error: 'Sem permissão' }
  if (linha.status_periodo === 'fechado') return { error: 'Período fechado — edição não permitida' }

  const repasses = calcularRepasses(formData)

  const { error } = await db
    .from('producao')
    .update({
      competencia: competenciaDate,
      data: formData.data,
      seguradora_id: formData.seguradora_id,
      segurado: formData.segurado,
      referencia: formData.referencia.trim().toUpperCase(),
      cpf_segurado: formData.cpf_segurado || null,
      grupo_produto_id: formData.grupo_produto_id || null,
      produto_id: formData.produto_id || null,
      comissao: formData.comissao,
      indicador_id: formData.indicador_id || null,
      pct_indicador: formData.pct_indicador ?? null,
      corretor1_id: formData.corretor1_id || null,
      pct_corretor1: formData.pct_corretor1 ?? null,
      corretor2_id: formData.corretor2_id || null,
      pct_corretor2: formData.pct_corretor2 ?? null,
      impostos_pct: formData.impostos_pct,
      ...repasses,
      observacoes: formData.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/producao')
  return { ok: true }
}

export async function excluirProducao(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const db = admin()

  const { data: linha } = await db
    .from('producao')
    .select('status_periodo, tenant_id')
    .eq('id', id)
    .single()

  if (!linha) return { error: 'Registro não encontrado' }
  if (linha.tenant_id !== session.tenantId) return { error: 'Sem permissão' }
  if (linha.status_periodo === 'fechado') return { error: 'Período fechado — exclusão não permitida' }

  const { error } = await db.from('producao').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/producao')
  return { ok: true }
}

export async function revincularpProducao(tenantId: string, competencia?: string) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }

  const db = admin()
  const competenciaDate = competencia ? competenciaToDate(competencia) : null

  // Busca linhas pendentes do tenant (e opcionalmente da competência)
  let qProd = db
    .from('producao')
    .select('id, seguradora_id, referencia, competencia')
    .eq('tenant_id', tenantId)
    .eq('status_vinculacao', 'pendente')

  if (competenciaDate) qProd = qProd.eq('competencia', competenciaDate)

  const { data: linhasPendentes } = await qProd

  if (!linhasPendentes || linhasPendentes.length === 0) return { vinculados: 0, pendentes: 0 }

  let vinculados = 0

  for (const linha of linhasPendentes) {
    // Busca no relatório: mesmo tenant + seguradora + referencia + competencia
    const { data: relImps } = await db
      .from('importacoes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('seguradora_id', linha.seguradora_id)
      .eq('competencia', linha.competencia)
      .limit(1)

    if (!relImps || relImps.length === 0) continue

    const importacaoIds = relImps.map(r => r.id)
    const { data: relLinha } = await db
      .from('importacao_linhas')
      .select('id, valor')
      .in('importacao_id', importacaoIds)
      .eq('referencia', linha.referencia)
      .limit(1)
      .maybeSingle()

    if (!relLinha) continue

    // Verifica divergência de valor
    const { data: prodRow } = await db
      .from('producao')
      .select('comissao')
      .eq('id', linha.id)
      .single()

    const divergente = prodRow
      ? Math.abs((prodRow.comissao - relLinha.valor) / prodRow.comissao) > 0.01
      : false

    await db
      .from('producao')
      .update({
        status_vinculacao: divergente ? 'divergente' : 'vinculado',
        relatorio_linha_id: relLinha.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', linha.id)

    vinculados++
  }

  revalidatePath('/producao')
  return { vinculados, pendentes: linhasPendentes.length - vinculados }
}
