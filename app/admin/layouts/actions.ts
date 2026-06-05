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

export type MapeamentoInput = {
  campo_sistema: string
  coluna_arquivo: string
  formato_data?: string
}

export type LayoutInput = {
  seguradora_id: string
  nome: string
  formato: string
  separador?: string
  separador_custom?: string
  linha_cabecalho?: number | null
  primeira_linha_dados?: number | null
  aba_excel?: string
  encoding: string
  grupo_produto_fixo_id?: string | null
  produto_fixo_id?: string | null
  extensoes_esperadas?: string[]
  padrao_nome_arquivo?: string
  texto_cabecalho?: string
  observacoes?: string
  mapeamentos: MapeamentoInput[]
}

export async function criarLayout(input: LayoutInput): Promise<{ error?: string; id?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'bpo_admin') return { error: 'Sem permissão' }

  const db = adminDb()
  const { mapeamentos, ...layoutData } = input

  const { data: layout, error } = await db
    .from('seguradora_layouts')
    .insert({
      ...layoutData,
      linha_cabecalho: layoutData.linha_cabecalho ?? null,
      primeira_linha_dados: layoutData.primeira_linha_dados ?? null,
      grupo_produto_fixo_id: layoutData.grupo_produto_fixo_id || null,
      produto_fixo_id: layoutData.produto_fixo_id || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (mapeamentos.length > 0) {
    const { error: mapError } = await db.from('layout_mapeamentos').insert(
      mapeamentos.map((m) => ({ ...m, layout_id: layout.id }))
    )
    if (mapError) {
      await db.from('seguradora_layouts').delete().eq('id', layout.id)
      return { error: mapError.message }
    }
  }

  revalidatePath('/admin/layouts')
  return { id: layout.id }
}

export async function atualizarLayout(
  id: string,
  input: LayoutInput
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'bpo_admin') return { error: 'Sem permissão' }

  const db = adminDb()
  const { mapeamentos, ...layoutData } = input

  const { error } = await db
    .from('seguradora_layouts')
    .update({
      ...layoutData,
      linha_cabecalho: layoutData.linha_cabecalho ?? null,
      primeira_linha_dados: layoutData.primeira_linha_dados ?? null,
      grupo_produto_fixo_id: layoutData.grupo_produto_fixo_id || null,
      produto_fixo_id: layoutData.produto_fixo_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Substituir mapeamentos por completo
  await db.from('layout_mapeamentos').delete().eq('layout_id', id)
  if (mapeamentos.length > 0) {
    const { error: mapError } = await db.from('layout_mapeamentos').insert(
      mapeamentos.map((m) => ({ ...m, layout_id: id }))
    )
    if (mapError) return { error: mapError.message }
  }

  revalidatePath('/admin/layouts')
  revalidatePath(`/admin/layouts/${id}`)
  return {}
}

export async function alterarStatusLayout(
  id: string,
  status: 'ativo' | 'inativo' | 'arquivado'
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'bpo_admin') return { error: 'Sem permissão' }

  const { error } = await adminDb()
    .from('seguradora_layouts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/layouts')
  revalidatePath(`/admin/layouts/${id}`)
  return {}
}
