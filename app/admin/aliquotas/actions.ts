'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type AliquotaFormData = {
  tenant_id: string
  competencia: string   // 'YYYY-MM' — convertemos para primeiro dia do mês
  aliquota_global: number
  aliquota_iss?: number | null
  observacoes?: string
}

function primeiroDoMes(competencia: string) {
  return `${competencia}-01`
}

export async function salvarAliquota(data: AliquotaFormData) {
  const db = admin()
  const competenciaDate = primeiroDoMes(data.competencia)

  // Verifica se já existe registro para este mês/corretora
  const { data: existente } = await db
    .from('aliquotas_mensais')
    .select('id, periodo_fechado')
    .eq('tenant_id', data.tenant_id)
    .eq('competencia', competenciaDate)
    .single()

  if (existente?.periodo_fechado) {
    return { error: 'Este período já está fechado e não pode ser editado.' }
  }

  const payload = {
    tenant_id: data.tenant_id,
    competencia: competenciaDate,
    aliquota_global: data.aliquota_global,
    aliquota_iss: data.aliquota_iss ?? null,
    observacoes: data.observacoes || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = existente
    ? await db.from('aliquotas_mensais').update(payload).eq('id', existente.id)
    : await db.from('aliquotas_mensais').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/admin/aliquotas')
  return { ok: true }
}
