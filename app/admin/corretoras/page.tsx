import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { StatusBadge } from './components/status-badge'

const REGIME_LABEL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

export default async function CorretorasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; regime?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const params = await searchParams
  const { status, regime, q } = params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = db
    .from('tenants')
    .select('id, nome, nome_fantasia, cnpj, regime_tributario, status, data_inicio_contrato, logo_url, primary_color')
    .eq('tenant_type', 'corretora')
    .order('nome_fantasia', { ascending: true })

  if (status) query = query.eq('status', status)
  if (regime) query = query.eq('regime_tributario', regime)
  if (q) query = query.or(`nome.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q}%`)

  const { data: corretoras } = await query
  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Administração' }, { label: 'Corretoras' }]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Corretoras</h1>
            <p className="text-sm text-gray-500 mt-1">
              {corretoras?.length ?? 0} corretora{(corretoras?.length ?? 0) !== 1 ? 's' : ''} cadastrada{(corretoras?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/admin/corretoras/nova"
            className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors"
          >
            + Nova corretora
          </Link>
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou CNPJ..."
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativa</option>
            <option value="suspenso">Suspensa</option>
            <option value="inativo">Inativa</option>
          </select>
          <select
            name="regime"
            defaultValue={regime ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todos os regimes</option>
            <option value="simples_nacional">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Filtrar
          </button>
          {(status || regime || q) && (
            <Link
              href="/admin/corretoras"
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Limpar
            </Link>
          )}
        </form>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Corretora</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">CNPJ</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Regime</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Início</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(corretoras ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt={c.nome_fantasia ?? c.nome}
                          className="w-7 h-7 rounded object-contain bg-gray-100 p-0.5 shrink-0"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: c.primary_color ?? '#5B7291' }}
                        >
                          {(c.nome_fantasia ?? c.nome).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{c.nome_fantasia ?? c.nome}</p>
                        {c.nome_fantasia && (
                          <p className="text-xs text-gray-400">{c.nome}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.cnpj ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.regime_tributario ? REGIME_LABEL[c.regime_tributario] : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.data_inicio_contrato
                      ? new Date(c.data_inicio_contrato + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/corretoras/${c.id}`}
                      className="text-xs text-[#5B7291] hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {(!corretoras || corretoras.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhuma corretora encontrada.
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
