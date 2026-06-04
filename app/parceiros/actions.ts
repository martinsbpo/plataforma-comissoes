'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type ContaBancaria = {
  id?: string
  banco: string
  agencia: string
  conta: string
  tipo_conta: 'corrente' | 'poupanca'
  chave_pix?: string
  apelido?: string
}

export type ParceiroFormData = {
  tenant_id: string
  nome: string
  cpf: string
  email: string
  telefone?: string
  codigo_susep?: string
  pct_indicador?: number | null
  pct_corretor1?: number | null
  pct_corretor2?: number | null
  observacoes?: string
  contas: ContaBancaria[]
}

export async function criarParceiro(data: ParceiroFormData) {
  const db = admin()

  const { data: p, error } = await db
    .from('parceiros')
    .insert({
      tenant_id: data.tenant_id,
      nome: data.nome,
      cpf: data.cpf,
      email: data.email,
      telefone: data.telefone || null,
      codigo_susep: data.codigo_susep || null,
      pct_indicador: data.pct_indicador ?? null,
      pct_corretor1: data.pct_corretor1 ?? null,
      pct_corretor2: data.pct_corretor2 ?? null,
      observacoes: data.observacoes || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (data.contas.length > 0) {
    const { error: contasErr } = await db
      .from('parceiro_contas_bancarias')
      .insert(data.contas.map(c => ({ ...c, parceiro_id: p.id })))
    if (contasErr) return { error: contasErr.message }
  }

  revalidatePath('/parceiros')
  return { id: p.id }
}

export async function atualizarParceiro(id: string, data: ParceiroFormData) {
  const db = admin()

  const { error } = await db
    .from('parceiros')
    .update({
      nome: data.nome,
      cpf: data.cpf,
      email: data.email,
      telefone: data.telefone || null,
      codigo_susep: data.codigo_susep || null,
      pct_indicador: data.pct_indicador ?? null,
      pct_corretor1: data.pct_corretor1 ?? null,
      pct_corretor2: data.pct_corretor2 ?? null,
      observacoes: data.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await db.from('parceiro_contas_bancarias').delete().eq('parceiro_id', id)

  if (data.contas.length > 0) {
    const { error: contasErr } = await db
      .from('parceiro_contas_bancarias')
      .insert(data.contas.map(({ id: _id, ...c }) => ({ ...c, parceiro_id: id })))
    if (contasErr) return { error: contasErr.message }
  }

  revalidatePath('/parceiros')
  revalidatePath(`/parceiros/${id}`)
  return { ok: true }
}

export async function alterarStatusParceiro(id: string, status: 'ativo' | 'inativo') {
  const db = admin()
  const { error } = await db
    .from('parceiros')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/parceiros')
  return { ok: true }
}
