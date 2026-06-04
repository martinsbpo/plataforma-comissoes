import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const POLITICA_NF_LABEL: Record<string, string> = {
  exige_antes_pagamento: 'Exige NF antes do pagamento',
  emite_no_fechamento:   'Emite NF no fechamento',
  nao_emite:             'Não emite NF',
}

export default async function SeguradorasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const params = await searchParams
  const { status, q } = params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = db
    .from('seguradoras')
    .select('id, nome, nome_fantasia, cnpj, ramos, politica_nf, status')
    .order('nome_fantasia', { ascending: true })

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q}%`)

  const { data: seguradoras } = await query
  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Administração' }, { label: 'Seguradoras' }]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Seguradoras</h1>
            <p className="text-sm text-gray-500 mt-1">
              {seguradoras?.length ?? 0} seguradora{(seguradoras?.length ?? 0) !== 1 ? 's' : ''} cadastrada{(seguradoras?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/admin/seguradoras/nova"
            className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors"
          >
            + Nova seguradora
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
            <option value="inativo">Inativa</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Filtrar
          </button>
          {(status || q) && (
            <Link
              href="/admin/seguradoras"
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
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Seguradora</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">CNPJ</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Ramos</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Política de NF</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(seguradoras ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.nome_fantasia}</p>
                    <p className="text-xs text-gray-400">{s.nome}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.cnpj}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.ramos ?? []).slice(0, 3).map((r: string) => (
                        <span key={r} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{r}</span>
                      ))}
                      {(s.ramos ?? []).length > 3 && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
                          +{s.ramos.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {POLITICA_NF_LABEL[s.politica_nf] ?? s.politica_nf}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status === 'ativo' ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/seguradoras/${s.id}`}
                      className="text-xs text-[#5B7291] hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {(!seguradoras || seguradoras.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhuma seguradora encontrada.
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
