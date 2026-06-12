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

export type SaldoParceiro = {
  parceiro_id: string
  parceiro_nome: string
  total_creditos: number
  total_pagamentos: number
  saldo: number
}

export type ExtratoParceiro = {
  parceiro_id: string
  parceiro_nome: string
  saldo: number
  creditos: {
    apuracao_id: string
    competencia: string
    valor: number
  }[]
  pagamentos: {
    id: string
    data_pagamento: string
    valor: number
    descricao: string | null
  }[]
}

// Retorna saldo acumulado de todos os parceiros do tenant
export async function listarSaldosParceiros(tenantId: string): Promise<{ error: string } | SaldoParceiro[]> {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) return { error: 'Sem permissão' }

  const db = admin()

  // Parceiros ativos do tenant
  const { data: parceiros } = await db
    .from('parceiros')
    .select('id, nome')
    .eq('tenant_id', tenantId)
    .eq('status', 'ativo')
    .order('nome')

  if (!parceiros || parceiros.length === 0) return []

  const parceiroIds = parceiros.map(p => p.id)

  // Créditos: soma de repasses por parceiro nas apurações confirmadas
  const { data: creditos } = await db
    .from('apuracao_linhas')
    .select(`
      indicador_id, corretor1_id, corretor2_id,
      repasse_indicador, repasse_corretor1, repasse_corretor2,
      apuracao:apuracao_id(tenant_id, status)
    `)
    .not('apuracao', 'is', null)

  // Pagamentos efetuados
  const { data: pagamentos } = await db
    .from('repasse_pagamentos')
    .select('parceiro_id, valor')
    .eq('tenant_id', tenantId)
    .in('parceiro_id', parceiroIds)

  // Soma créditos por parceiro
  const creditosMap: Record<string, number> = {}
  for (const linha of creditos ?? []) {
    const ap = Array.isArray(linha.apuracao) ? linha.apuracao[0] : linha.apuracao
    if (!ap || ap.tenant_id !== tenantId || ap.status !== 'confirmada') continue
    if (linha.indicador_id && parceiroIds.includes(linha.indicador_id)) {
      creditosMap[linha.indicador_id] = (creditosMap[linha.indicador_id] ?? 0) + Number(linha.repasse_indicador)
    }
    if (linha.corretor1_id && parceiroIds.includes(linha.corretor1_id)) {
      creditosMap[linha.corretor1_id] = (creditosMap[linha.corretor1_id] ?? 0) + Number(linha.repasse_corretor1)
    }
    if (linha.corretor2_id && parceiroIds.includes(linha.corretor2_id)) {
      creditosMap[linha.corretor2_id] = (creditosMap[linha.corretor2_id] ?? 0) + Number(linha.repasse_corretor2)
    }
  }

  // Soma pagamentos por parceiro
  const pagamentosMap: Record<string, number> = {}
  for (const p of pagamentos ?? []) {
    pagamentosMap[p.parceiro_id] = (pagamentosMap[p.parceiro_id] ?? 0) + Number(p.valor)
  }

  return parceiros.map(p => {
    const credito = parseFloat((creditosMap[p.id] ?? 0).toFixed(2))
    const pago = parseFloat((pagamentosMap[p.id] ?? 0).toFixed(2))
    return {
      parceiro_id: p.id,
      parceiro_nome: p.nome,
      total_creditos: credito,
      total_pagamentos: pago,
      saldo: parseFloat((credito - pago).toFixed(2)),
    }
  })
}

// Retorna extrato detalhado de um parceiro
export async function buscarExtratoParceiro(tenantId: string, parceiroId: string): Promise<{ error: string } | ExtratoParceiro> {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) return { error: 'Sem permissão' }

  const db = admin()

  const { data: parceiro } = await db
    .from('parceiros')
    .select('id, nome')
    .eq('id', parceiroId)
    .eq('tenant_id', tenantId)
    .single()

  if (!parceiro) return { error: 'Parceiro não encontrado' }

  // Créditos: apurações confirmadas onde este parceiro aparece
  const { data: linhas } = await db
    .from('apuracao_linhas')
    .select(`
      indicador_id, corretor1_id, corretor2_id,
      repasse_indicador, repasse_corretor1, repasse_corretor2,
      apuracao:apuracao_id(id, competencia, tenant_id, status)
    `)
    .or(`indicador_id.eq.${parceiroId},corretor1_id.eq.${parceiroId},corretor2_id.eq.${parceiroId}`)

  // Agrega créditos por apuração
  const creditosPorApuracao: Record<string, { apuracao_id: string; competencia: string; valor: number }> = {}
  for (const linha of linhas ?? []) {
    const ap = Array.isArray(linha.apuracao) ? linha.apuracao[0] : linha.apuracao
    if (!ap || ap.tenant_id !== tenantId || ap.status !== 'confirmada') continue
    if (!creditosPorApuracao[ap.id]) {
      creditosPorApuracao[ap.id] = { apuracao_id: ap.id, competencia: ap.competencia, valor: 0 }
    }
    if (linha.indicador_id === parceiroId) creditosPorApuracao[ap.id].valor += Number(linha.repasse_indicador)
    if (linha.corretor1_id === parceiroId) creditosPorApuracao[ap.id].valor += Number(linha.repasse_corretor1)
    if (linha.corretor2_id === parceiroId) creditosPorApuracao[ap.id].valor += Number(linha.repasse_corretor2)
  }

  const creditos = Object.values(creditosPorApuracao)
    .map(c => ({ ...c, valor: parseFloat(c.valor.toFixed(2)) }))
    .sort((a, b) => a.competencia.localeCompare(b.competencia))

  // Pagamentos
  const { data: pagamentos } = await db
    .from('repasse_pagamentos')
    .select('id, data_pagamento, valor, descricao')
    .eq('tenant_id', tenantId)
    .eq('parceiro_id', parceiroId)
    .order('data_pagamento', { ascending: true })

  const totalCreditos = creditos.reduce((s, c) => s + c.valor, 0)
  const totalPagamentos = (pagamentos ?? []).reduce((s, p) => s + Number(p.valor), 0)

  return {
    parceiro_id: parceiro.id,
    parceiro_nome: parceiro.nome,
    saldo: parseFloat((totalCreditos - totalPagamentos).toFixed(2)),
    creditos,
    pagamentos: (pagamentos ?? []).map(p => ({
      id: p.id,
      data_pagamento: p.data_pagamento,
      valor: parseFloat(Number(p.valor).toFixed(2)),
      descricao: p.descricao,
    })),
  }
}

// Registra um pagamento avulso
export async function registrarPagamento(
  tenantId: string,
  parceiroId: string,
  valor: number,
  dataPagamento: string,
  descricao?: string
): Promise<{ error: string } | { ok: true }> {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) return { error: 'Sem permissão' }
  if (valor <= 0) return { error: 'Valor deve ser maior que zero' }

  const db = admin()
  const { error } = await db.from('repasse_pagamentos').insert({
    tenant_id: tenantId,
    parceiro_id: parceiroId,
    valor,
    data_pagamento: dataPagamento,
    descricao: descricao || null,
    registrado_por: session.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/repasses')
  return { ok: true }
}

// Registra pagamentos em lote (vários parceiros, mesma data)
export async function registrarPagamentosLote(
  tenantId: string,
  pagamentos: { parceiro_id: string; valor: number }[],
  dataPagamento: string
): Promise<{ error: string } | { ok: true; count: number }> {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) return { error: 'Sem permissão' }
  if (pagamentos.length === 0) return { error: 'Nenhum parceiro selecionado' }

  const db = admin()
  const rows = pagamentos.map(p => ({
    tenant_id: tenantId,
    parceiro_id: p.parceiro_id,
    valor: p.valor,
    data_pagamento: dataPagamento,
    descricao: 'Pagamento em lote',
    registrado_por: session.id,
  }))

  const { error } = await db.from('repasse_pagamentos').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/financeiro/repasses')
  return { ok: true, count: rows.length }
}

// Remove um pagamento (apenas bpo_admin)
export async function removerPagamento(tenantId: string, pagamentoId: string): Promise<{ error: string } | { ok: true }> {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (session.role !== 'bpo_admin') return { error: 'Apenas BPO Admin pode remover pagamentos' }

  const db = admin()
  const { error } = await db
    .from('repasse_pagamentos')
    .delete()
    .eq('id', pagamentoId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/repasses')
  return { ok: true }
}
