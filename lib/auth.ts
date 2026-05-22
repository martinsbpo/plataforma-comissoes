import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/permissions'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type UserSession = {
  id: string
  email: string
  nome: string | null
  role: UserRole
  tenantId: string
  tenantNome: string
}

// Retorna a sessão completa do usuário (perfil + tenant ativo)
// Retorna null se não autenticado ou sem vínculo ativo
export async function getSession(): Promise<UserSession | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getAdminClient()

  const { data: link } = await admin
    .from('user_tenant_links')
    .select('role, tenant_id, tenants(nome)')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!link) return null

  const { data: profile } = await admin
    .from('users')
    .select('nome')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email!,
    nome: profile?.nome ?? null,
    role: link.role as UserRole,
    tenantId: link.tenant_id,
    tenantNome: (Array.isArray(link.tenants) ? (link.tenants[0] as { nome: string } | undefined)?.nome : (link.tenants as { nome: string } | null)?.nome) ?? '',
  }
}

// Retorna todos os tenants ativos vinculados ao usuário (para o seletor multi-tenant)
export async function getUserTenants() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = getAdminClient()
  const { data } = await admin
    .from('user_tenant_links')
    .select('tenant_id, role, tenants(id, nome, nome_fantasia, logo_url)')
    .eq('user_id', user.id)
    .eq('status', 'ativo')

  return data ?? []
}
