import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const FORMATO_LABEL: Record<string, string> = {
  txt:         'TXT',
  csv:         'CSV',
  xlsx:        'Excel',
  pdf_digital: 'PDF digital',
  pdf_scan:    'PDF scan',
}

const STATUS_STYLE: Record<string, string> = {
  ativo:     'bg-green-100 text-green-700',
  inativo:   'bg-gray-100 text-gray-500',
  arquivado: 'bg-orange-100 text-orange-600',
}

export default async function LayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ seguradora?: string; status?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const params = await searchParams
  const { seguradora, status, q } = params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: seguradoras }, layoutsRes] = await Promise.all([
    db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome_fantasia'),
    (() => {
      let query = db
        .from('seguradora_layouts')
        .select(`
          id, nome, formato, status, versao,
          seguradora:seguradora_id (id, nome_fantasia, nome),
          mapeamentos:layout_mapeamentos(count)
        `)
        .order('status', { ascending: true })
        .order('nome', { ascending: true })

      if (seguradora) query = query.eq('seguradora_id', seguradora)
      if (status) query = query.eq('status', status)
      if (q) query = query.ilike('nome', `%${q}%`)

      return query
    })(),
  ])

  const layouts = layoutsRes.data ?? []
  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Administração' }, { label: 'Layouts de Importação' }]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Layouts de Importação</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure como ler os relatórios de cada seguradora.
            </p>
          </div>
          <Link
            href="/admin/layouts/novo"
            className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors"
          >
            + Novo layout
          </Link>
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          <select
            name="seguradora"
            defaultValue={seguradora ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todas as seguradoras</option>
            {(seguradoras ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome_fantasia || s.nome}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="arquivado">Arquivado</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Filtrar
          </button>
          {(seguradora || status || q) && (
            <Link
              href="/admin/layouts"
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
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Layout</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Seguradora</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Formato</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Campos mapeados</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {layouts.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{l.nome}</p>
                    <p className="text-xs text-gray-400">v{l.versao}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {l.seguradora?.nome_fantasia || l.seguradora?.nome}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {FORMATO_LABEL[l.formato] ?? l.formato}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {l.mapeamentos?.[0]?.count ?? 0} campo{l.mapeamentos?.[0]?.count !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_STYLE[l.status] ?? 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/layouts/${l.id}`}
                      className="text-xs text-[#5B7291] hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {layouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum layout cadastrado.{' '}
                    <Link href="/admin/layouts/novo" className="text-[#5B7291] hover:underline">
                      Criar o primeiro
                    </Link>
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
