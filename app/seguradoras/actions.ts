'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function confirmarImportacao(importacaoId: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || !['bpo_admin', 'bpo_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const { error } = await adminDb()
    .from('importacoes')
    .update({
      status: 'confirmada',
      confirmado_por: session.id,
      confirmado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', importacaoId)

  if (error) return { error: error.message }
  revalidatePath('/seguradoras')
  revalidatePath(`/seguradoras/${importacaoId}`)
  return {}
}

export async function excluirImportacao(importacaoId: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || !['bpo_admin', 'bpo_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const db = adminDb()

  const { data: imp } = await db
    .from('importacoes')
    .select('storage_path, status')
    .eq('id', importacaoId)
    .single()

  // Verifica se existe apuração CONFIRMADA vinculada a linhas desta importação
  const { data: apuracaoConfirmada } = await db
    .from('apuracao_linhas')
    .select('apuracao_id, apuracoes!inner(status)')
    .eq('apuracoes.status', 'confirmada')
    .in(
      'importacao_linha_id',
      (await db
        .from('importacao_linhas')
        .select('id')
        .eq('importacao_id', importacaoId)
      ).data?.map((l: { id: string }) => l.id) ?? []
    )
    .limit(1)

  if (apuracaoConfirmada && apuracaoConfirmada.length > 0) {
    return { error: 'Esta importação possui uma apuração confirmada vinculada. Desfaça a apuração antes de excluir.' }
  }

  if (imp?.storage_path) {
    await db.storage.from('importacoes').remove([imp.storage_path])
  }

  const { error } = await db.from('importacoes').delete().eq('id', importacaoId)
  if (error) return { error: error.message }

  revalidatePath('/seguradoras')
  return {}
}

export async function resolverLinhaPendente(
  linhaId: string,
  grupoProdutoId: string,
  produtoId: string,
  observacoes?: string
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || !['bpo_admin', 'bpo_operador'].includes(session.role)) {
    return { error: 'Sem permissão' }
  }

  const { error } = await adminDb()
    .from('importacao_linhas')
    .update({
      grupo_produto_id: grupoProdutoId,
      produto_id: produtoId,
      status_linha: 'ok',
      observacoes: observacoes ?? null,
    })
    .eq('id', linhaId)

  if (error) return { error: error.message }
  revalidatePath('/seguradoras')
  return {}
}
