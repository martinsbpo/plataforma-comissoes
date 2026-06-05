import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { UploadImportacao } from './components/upload-importacao'

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente:     { label: 'Pendente',    cls: 'bg-yellow-100 text-yellow-700' },
  confirmada:   { label: 'Confirmada',  cls: 'bg-green-100 text-green-700' },
  com_estorno:  { label: 'C/ Estorno',  cls: 'bg-orange-100 text-orange-600' },
  manual:       { label: 'Manual',      cls: 'bg-blue-100 text-blue-700' },
}

export default async function SeguradorasImportacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; seguradora?: string; status?: string; mes?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'bpo_operador', 'bpo_visualizador'].includes(session.role)) {
    redirect('/acesso-negado')
  }

  const params = await searchParams
  const aba = params.aba ?? 'historico'
  const canUpload = ['bpo_admin', 'bpo_operador'].includes(session.role)

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: seguradoras }, { data: layouts }, historico] = await Promise.all([
    db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome_fantasia'),
    db.from('seguradora_layouts').select('id, nome, formato, seguradora_id').eq('status', 'ativo').order('nome'),
    (() => {
      let q = db
        .from('importacoes')
        .select(`
          id, competencia, nome_arquivo, formato, status,
          total_linhas, total_ok, total_pendentes, valor_total,
          created_at,
          seguradora:seguradora_id (nome_fantasia, nome)
        `)
        .eq('tenant_id', session.tenantId)
        .order('competencia', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (params.seguradora) q = q.eq('seguradora_id', params.seguradora)
      if (params.status) q = q.eq('status', params.status)
      if (params.mes) q = q.eq('competencia', params.mes + '-01')
      return q
    })(),
  ])

  const importacoes = historico.data ?? []
  const nav = getNavForRole(session.role)

  const abas = [
    ...(canUpload ? [{ value: 'upload', label: 'Importar arquivo' }] : []),
    { value: 'historico', label: 'Histórico de importações' },
  ]

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Relatórios de Seguradoras' }]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Relatórios de Seguradoras</h1>
          <p className="text-sm text-gray-500 mt-1">
            Importe os relatórios de comissões mensais das seguradoras.
          </p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-gray-200">
          {abas.map((a) => (
            <Link
              key={a.value}
              href={`/seguradoras?aba=${a.value}`}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                aba === a.value
                  ? 'text-[#5B7291] border-b-2 border-[#5B7291] -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>

        {/* Conteúdo das abas */}
        {aba === 'upload' && canUpload && (
          <UploadImportacao
            seguradoras={seguradoras ?? []}
            layouts={layouts ?? []}
          />
        )}

        {aba === 'historico' && (
          <div className="flex flex-col gap-4">
            {/* Filtros */}
            <form method="GET" className="flex flex-wrap gap-3">
              <input type="hidden" name="aba" value="historico" />
              <select
                name="seguradora"
                defaultValue={params.seguradora ?? ''}
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
                defaultValue={params.status ?? ''}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
              >
                <option value="">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="confirmada">Confirmada</option>
                <option value="com_estorno">Com estorno</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Filtrar
              </button>
            </form>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Competência</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Seguradora</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Arquivo</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Linhas</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Pendentes</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor total</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importacoes.map((imp: any) => {
                    const st = STATUS_LABEL[imp.status] ?? { label: imp.status, cls: 'bg-gray-100 text-gray-500' }
                    return (
                      <tr key={imp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatDate(imp.competencia)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {imp.seguradora?.nome_fantasia || imp.seguradora?.nome}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[200px]" title={imp.nome_arquivo}>
                          {imp.nome_arquivo}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{imp.total_linhas}</td>
                        <td className="px-4 py-3 text-right">
                          {imp.total_pendentes > 0 ? (
                            <span className="text-amber-600 font-medium">{imp.total_pendentes}</span>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                          {formatCurrency(imp.valor_total)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/seguradoras/${imp.id}`}
                            className="text-xs text-[#5B7291] hover:underline"
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                  {importacoes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                        Nenhuma importação encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
