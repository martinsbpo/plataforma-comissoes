'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type RetencaoForm = {
  regime: 'simples_nacional' | 'lucro_presumido_real'
  retem_iss: boolean
  retem_irpj: boolean
  aliquota_irpj?: number | null
}

export type SeguradoraFormData = {
  nome: string
  nome_fantasia: string
  cnpj: string
  codigo_susep: string
  ramos: string[]
  politica_nf: 'exige_antes_pagamento' | 'emite_no_fechamento' | 'nao_emite'
  formato_estorno: 'incluso_relatorio' | 'lancamento_manual'
  observacoes?: string
  retencoes: RetencaoForm[]
}

export async function criarSeguradora(data: SeguradoraFormData) {
  const db = admin()

  const { data: seg, error } = await db
    .from('seguradoras')
    .insert({
      nome: data.nome,
      nome_fantasia: data.nome_fantasia,
      cnpj: data.cnpj,
      codigo_susep: data.codigo_susep,
      ramos: data.ramos,
      politica_nf: data.politica_nf,
      formato_estorno: data.formato_estorno,
      observacoes: data.observacoes || null,
      status: 'ativo',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (data.retencoes.length > 0) {
    const { error: retErr } = await db
      .from('seguradora_retencoes')
      .insert(data.retencoes.map(r => ({
        seguradora_id: seg.id,
        regime: r.regime,
        retem_iss: r.retem_iss,
        retem_irpj: r.retem_irpj,
        aliquota_irpj: r.retem_irpj ? (r.aliquota_irpj ?? null) : null,
      })))

    if (retErr) return { error: retErr.message }
  }

  revalidatePath('/admin/seguradoras')
  return { id: seg.id }
}

export async function atualizarSeguradora(id: string, data: SeguradoraFormData) {
  const db = admin()

  const { error } = await db
    .from('seguradoras')
    .update({
      nome: data.nome,
      nome_fantasia: data.nome_fantasia,
      cnpj: data.cnpj,
      codigo_susep: data.codigo_susep,
      ramos: data.ramos,
      politica_nf: data.politica_nf,
      formato_estorno: data.formato_estorno,
      observacoes: data.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Substitui retenções
  await db.from('seguradora_retencoes').delete().eq('seguradora_id', id)

  if (data.retencoes.length > 0) {
    const { error: retErr } = await db
      .from('seguradora_retencoes')
      .insert(data.retencoes.map(r => ({
        seguradora_id: id,
        regime: r.regime,
        retem_iss: r.retem_iss,
        retem_irpj: r.retem_irpj,
        aliquota_irpj: r.retem_irpj ? (r.aliquota_irpj ?? null) : null,
      })))

    if (retErr) return { error: retErr.message }
  }

  revalidatePath('/admin/seguradoras')
  revalidatePath(`/admin/seguradoras/${id}`)
  return { ok: true }
}

export async function alterarStatusSeguradora(id: string, status: 'ativo' | 'inativo') {
  const db = admin()

  const { error } = await db
    .from('seguradoras')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/seguradoras')
  return { ok: true }
}
