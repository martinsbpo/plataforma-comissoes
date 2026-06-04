'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ============================================================
// Grupos de Produto
// ============================================================

export async function criarGrupo(nome: string) {
  const db = admin()
  const { data, error } = await db
    .from('grupos_produto')
    .insert({ nome })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { id: data.id }
}

export async function atualizarGrupo(id: string, nome: string) {
  const db = admin()
  const { error } = await db
    .from('grupos_produto')
    .update({ nome, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

export async function inativarGrupo(id: string) {
  const db = admin()

  // Bloqueia se houver produtos ativos vinculados
  const { count } = await db
    .from('produtos')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_produto_id', id)
    .eq('status', 'ativo')

  if ((count ?? 0) > 0) {
    return { error: `Este grupo possui ${count} produto(s) ativo(s). Inative-os primeiro.` }
  }

  const { error } = await db
    .from('grupos_produto')
    .update({ status: 'inativo', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

export async function ativarGrupo(id: string) {
  const db = admin()
  const { error } = await db
    .from('grupos_produto')
    .update({ status: 'ativo', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

// ============================================================
// Produtos
// ============================================================

export async function criarProduto(grupoProdutoId: string, nome: string) {
  const db = admin()
  const { data, error } = await db
    .from('produtos')
    .insert({ grupo_produto_id: grupoProdutoId, nome })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { id: data.id }
}

export async function atualizarProduto(id: string, grupoProdutoId: string, nome: string) {
  const db = admin()
  const { error } = await db
    .from('produtos')
    .update({ grupo_produto_id: grupoProdutoId, nome, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

export async function inativarProduto(id: string) {
  const db = admin()

  // Bloqueia se houver de-paras ativos vinculados
  const { count } = await db
    .from('produto_depara')
    .select('*', { count: 'exact', head: true })
    .eq('produto_id', id)
    .eq('status', 'ativo')

  if ((count ?? 0) > 0) {
    return { error: `Este produto possui ${count} de-para(s) ativo(s). Inative-os primeiro.` }
  }

  const { error } = await db
    .from('produtos')
    .update({ status: 'inativo', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

export async function ativarProduto(id: string) {
  const db = admin()
  const { error } = await db
    .from('produtos')
    .update({ status: 'ativo', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

// ============================================================
// De-Para
// ============================================================

export type DePараFormData = {
  seguradora_id: string
  texto_relatorio: string
  grupo_produto_id: string
  produto_id: string
  observacoes?: string
}

export async function criarDePara(data: DePараFormData) {
  const db = admin()

  // Normaliza para maiúsculas
  const { data: dep, error } = await db
    .from('produto_depara')
    .insert({
      seguradora_id: data.seguradora_id,
      texto_relatorio: data.texto_relatorio.toUpperCase(),
      grupo_produto_id: data.grupo_produto_id,
      produto_id: data.produto_id,
      observacoes: data.observacoes || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { id: dep.id }
}

export async function atualizarDePara(id: string, data: DePараFormData) {
  const db = admin()
  const { error } = await db
    .from('produto_depara')
    .update({
      seguradora_id: data.seguradora_id,
      texto_relatorio: data.texto_relatorio.toUpperCase(),
      grupo_produto_id: data.grupo_produto_id,
      produto_id: data.produto_id,
      observacoes: data.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}

export async function alterarStatusDePara(id: string, status: 'ativo' | 'inativo') {
  const db = admin()
  const { error } = await db
    .from('produto_depara')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/produtos')
  return { ok: true }
}
