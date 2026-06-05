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
  tenant_id?: string     // explícito quando BPO Admin cadastra para outra corretora
  data: string           // YYYY-MM-DD
  seguradora_id: string
  segurado: string
  referencia: string
  cpf_segurado?: string
  grupo_produto_id?: string
  produto_id?: string
  comissao?: number      // valor esperado (opcional)
  indicador_id?: string
  pct_indicador?: number
  corretor1_id?: string
  pct_corretor1?: number
  corretor2_id?: string
  pct_corretor2?: number
  observacoes?: string
}

export async function criarProducao(formData: ProducaoFormData) {
  const session = await getSession()
  if (!session) return { error: 'Não autenticado' }
  if (!['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const db = admin()
  const tenantId = formData.tenant_id ?? session.tenantId

  // Aviso de duplicata (não bloqueante)
  const { data: dup } = await db
    .from('producao')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('seguradora_id', formData.seguradora_id)
    .eq('referencia', formData.referencia.trim().toUpperCase())
    .limit(1)
    .maybeSingle()

  const { data, error } = await db
    .from('producao')
    .insert({
      tenant_id: tenantId,
      data: formData.data,
      seguradora_id: formData.seguradora_id,
      segurado: formData.segurado,
      referencia: formData.referencia.trim().toUpperCase(),
      cpf_segurado: formData.cpf_segurado || null,
      grupo_produto_id: formData.grupo_produto_id || null,
      produto_id: formData.produto_id || null,
      comissao: formData.comissao ?? null,
      indicador_id: formData.indicador_id || null,
      pct_indicador: formData.pct_indicador ?? null,
      corretor1_id: formData.corretor1_id || null,
      pct_corretor1: formData.pct_corretor1 ?? null,
      corretor2_id: formData.corretor2_id || null,
      pct_corretor2: formData.pct_corretor2 ?? null,
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

  const { data: linha } = await db
    .from('producao')
    .select('tenant_id')
    .eq('id', id)
    .single()

  if (!linha) return { error: 'Registro não encontrado' }
  const isBpo = ['bpo_admin', 'bpo_operador'].includes(session.role)
  if (!isBpo && linha.tenant_id !== session.tenantId) return { error: 'Sem permissão' }

  const { error } = await db
    .from('producao')
    .update({
      data: formData.data,
      seguradora_id: formData.seguradora_id,
      segurado: formData.segurado,
      referencia: formData.referencia.trim().toUpperCase(),
      cpf_segurado: formData.cpf_segurado || null,
      grupo_produto_id: formData.grupo_produto_id || null,
      produto_id: formData.produto_id || null,
      comissao: formData.comissao ?? null,
      indicador_id: formData.indicador_id || null,
      pct_indicador: formData.pct_indicador ?? null,
      corretor1_id: formData.corretor1_id || null,
      pct_corretor1: formData.pct_corretor1 ?? null,
      corretor2_id: formData.corretor2_id || null,
      pct_corretor2: formData.pct_corretor2 ?? null,
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
    .select('tenant_id')
    .eq('id', id)
    .single()

  if (!linha) return { error: 'Registro não encontrado' }
  const isBpoDel = ['bpo_admin', 'bpo_operador'].includes(session.role)
  if (!isBpoDel && linha.tenant_id !== session.tenantId) return { error: 'Sem permissão' }

  const { error } = await db.from('producao').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/producao')
  return { ok: true }
}
