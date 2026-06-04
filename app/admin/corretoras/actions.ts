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
  apelido?: string
}

export type CorretoraFormData = {
  nome: string
  nome_fantasia: string
  cnpj: string
  codigo_susep: string
  contato_nome: string
  contato_email: string
  telefone: string
  regime_tributario: 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
  data_inicio_contrato: string
  data_encerramento_contrato?: string
  observacoes_internas?: string
  primary_color: string
  logo_url?: string
  contas: ContaBancaria[]
}

export async function criarCorretora(data: CorretoraFormData) {
  const db = admin()

  const { data: tenant, error } = await db
    .from('tenants')
    .insert({
      nome: data.nome,
      nome_fantasia: data.nome_fantasia,
      tenant_type: 'corretora',
      status: 'ativo',
      cnpj: data.cnpj,
      codigo_susep: data.codigo_susep,
      contato_nome: data.contato_nome,
      contato_email: data.contato_email,
      telefone: data.telefone,
      regime_tributario: data.regime_tributario,
      data_inicio_contrato: data.data_inicio_contrato,
      data_encerramento_contrato: data.data_encerramento_contrato || null,
      observacoes_internas: data.observacoes_internas || null,
      primary_color: data.primary_color,
      logo_url: data.logo_url || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (data.contas.length > 0) {
    const { error: contasError } = await db
      .from('corretora_contas_bancarias')
      .insert(data.contas.map(c => ({ ...c, tenant_id: tenant.id })))

    if (contasError) return { error: contasError.message }
  }

  revalidatePath('/admin/corretoras')
  return { id: tenant.id }
}

export async function atualizarCorretora(id: string, data: CorretoraFormData) {
  const db = admin()

  const { error } = await db
    .from('tenants')
    .update({
      nome: data.nome,
      nome_fantasia: data.nome_fantasia,
      cnpj: data.cnpj,
      codigo_susep: data.codigo_susep,
      contato_nome: data.contato_nome,
      contato_email: data.contato_email,
      telefone: data.telefone,
      regime_tributario: data.regime_tributario,
      data_inicio_contrato: data.data_inicio_contrato,
      data_encerramento_contrato: data.data_encerramento_contrato || null,
      observacoes_internas: data.observacoes_internas || null,
      primary_color: data.primary_color,
      logo_url: data.logo_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Substitui todas as contas
  await db.from('corretora_contas_bancarias').delete().eq('tenant_id', id)

  if (data.contas.length > 0) {
    const { error: contasError } = await db
      .from('corretora_contas_bancarias')
      .insert(data.contas.map(({ id: _id, ...c }) => ({ ...c, tenant_id: id })))

    if (contasError) return { error: contasError.message }
  }

  revalidatePath('/admin/corretoras')
  revalidatePath(`/admin/corretoras/${id}`)
  return { ok: true }
}

export async function alterarStatusCorretora(id: string, status: 'ativo' | 'suspenso' | 'inativo') {
  const db = admin()

  const { error } = await db
    .from('tenants')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/corretoras')
  return { ok: true }
}

export async function uploadLogo(tenantId: string, file: File): Promise<{ url?: string; error?: string }> {
  const db = admin()
  const ext = file.name.split('.').pop()
  const path = `corretoras/${tenantId}.${ext}`

  const { error } = await db.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) return { error: error.message }

  const { data } = db.storage.from('logos').getPublicUrl(path)
  return { url: data.publicUrl }
}
