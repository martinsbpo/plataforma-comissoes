import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export default async function UsuariosPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'corretora_gestor'].includes(session.role)) redirect('/acesso-negado')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const query = admin
    .from('user_tenant_links')
    .select('id, role, status, created_at, users(email, nome), tenants(nome_fantasia, nome)')
    .order('created_at', { ascending: false })

  if (session.role === 'corretora_gestor') {
    query.eq('tenant_id', session.tenantId)
  }

  const { data: vinculos } = await query
  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Administração' }, { label: 'Usuários' }]}
    >
      <div className="max-w-4xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Gestão de Usuários</h1>
            <p className="text-sm text-gray-500 mt-1">
              {session.role === 'bpo_admin'
                ? 'Todos os usuários da plataforma'
                : `Usuários da ${session.tenantNome}`}
            </p>
          </div>
          <button className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors">
            Convidar usuário
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuário</th>
                {session.role === 'bpo_admin' && (
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Corretora</th>
                )}
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Perfil</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(vinculos ?? []).map((v) => {
                const user = v.users as { email: string; nome: string | null } | null
                const tenant = v.tenants as { nome: string; nome_fantasia: string | null } | null
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{user?.nome ?? '—'}</p>
                      <p className="text-xs text-gray-400">{user?.email}</p>
                    </td>
                    {session.role === 'bpo_admin' && (
                      <td className="px-4 py-3 text-gray-600">
                        {tenant?.nome_fantasia ?? tenant?.nome ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {v.role.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        v.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {v.status === 'ativo' && (
                        <button className="text-xs text-red-500 hover:underline">Desativar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!vinculos || vinculos.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
