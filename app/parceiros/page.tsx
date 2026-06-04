import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function formatCPF(cpf: string) {
  const n = cpf.replace(/\D/g, '')
  return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

export default async function ParceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; tenant?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')

  const isBpo = ['bpo_admin', 'bpo_operador', 'bpo_visualizador'].includes(session.role)
  const podeEditar = ['bpo_admin', 'corretora_gestor', 'corretora_operador'].includes(session.role)

  if (!podeEditar && !isBpo) redirect('/acesso-negado')

  const params = await searchParams
  const { status, q, tenant } = params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = db
    .from('parceiros')
    .select('id, nome, cpf, email, status, tenant_id, tenants(nome_fantasia, nome)')
    .order('nome')

  if (!isBpo) {
    query = query.eq('tenant_id', session.tenantId)
  } else if (tenant) {
    query = query.eq('tenant_id', tenant)
  }

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,cpf.ilike.%${q}%`)

  const { data: parceiros } = await query

  // Para o filtro por corretora (BPO Admin)
  let corretoras: { id: string; nome_fantasia: string | null; nome: string }[] = []
  if (isBpo) {
    const { data } = await db
      .from('tenants')
      .select('id, nome_fantasia, nome')
      .eq('tenant_type', 'corretora')
      .eq('status', 'ativo')
      .order('nome_fantasia')
    corretoras = data ?? []
  }

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Parceiros' }]}
    >
      <div className="max-w-4xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Parceiros</h1>
            <p className="text-sm text-gray-500 mt-1">
              {parceiros?.length ?? 0} parceiro{(parceiros?.length ?? 0) !== 1 ? 's' : ''} cadastrado{(parceiros?.length ?? 0) !== 1 ? 's' : ''}
              {!isBpo && ` — ${session.tenantNome}`}
            </p>
          </div>
          {podeEditar && (
            <Link
              href="/parceiros/novo"
              className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors"
            >
              + Novo parceiro
            </Link>
          )}
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou CPF..."
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          {isBpo && (
            <select
              name="tenant"
              defaultValue={tenant ?? ''}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
            >
              <option value="">Todas as corretoras</option>
              {corretoras.map(c => (
                <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
              ))}
            </select>
          )}
          <select
            name="status"
            defaultValue={status ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
          <button type="submit" className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Filtrar
          </button>
          {(status || q || tenant) && (
            <Link href="/parceiros" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Limpar
            </Link>
          )}
        </form>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Parceiro</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">CPF</th>
                {isBpo && <th className="text-left px-4 py-3 text-gray-600 font-medium">Corretora</th>}
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(parceiros ?? []).map((p) => {
                const tenant = (Array.isArray(p.tenants) ? p.tenants[0] : p.tenants) as { nome: string; nome_fantasia: string | null } | null
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.nome}</p>
                      <p className="text-xs text-gray-400">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{formatCPF(p.cpf)}</td>
                    {isBpo && (
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {tenant?.nome_fantasia ?? tenant?.nome ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {podeEditar && (
                        <Link href={`/parceiros/${p.id}`} className="text-xs text-[#5B7291] hover:underline">
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!parceiros || parceiros.length === 0) && (
                <tr>
                  <td colSpan={isBpo ? 5 : 4} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum parceiro encontrado.
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
