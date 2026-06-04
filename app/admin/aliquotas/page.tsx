import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { AliquotaForm } from './components/aliquota-form'

const REGIME_LABEL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido:  'Lucro Presumido',
  lucro_real:       'Lucro Real',
}

function formatCompetencia(dateStr: string) {
  const [year, month] = dateStr.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[parseInt(month) - 1]}/${year}`
}

export default async function AliquotasPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; mes?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) redirect('/acesso-negado')

  const params = await searchParams

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: corretoras }, { data: aliquotasRaw }] = await Promise.all([
    db.from('tenants')
      .select('id, nome_fantasia, nome, regime_tributario')
      .eq('tenant_type', 'corretora')
      .eq('status', 'ativo')
      .order('nome_fantasia'),
    db.from('aliquotas_mensais')
      .select('id, tenant_id, competencia, aliquota_global, aliquota_iss, observacoes, periodo_fechado, tenants(nome_fantasia, nome, regime_tributario)')
      .order('competencia', { ascending: false })
      .order('tenant_id'),
  ])

  // Verifica quais corretoras têm retenção de ISS ativa
  const { data: retencoesISS } = await db
    .from('seguradora_retencoes')
    .select('regime')
    .eq('retem_iss', true)

  const temRetencaoISS = (retencoesISS?.length ?? 0) > 0

  let aliquotas = aliquotasRaw ?? []
  if (params.tenant) aliquotas = aliquotas.filter(a => a.tenant_id === params.tenant)
  if (params.mes) aliquotas = aliquotas.filter(a => a.competencia.startsWith(params.mes!))

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Administração' }, { label: 'Alíquotas Mensais' }]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Alíquotas Mensais</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registre as alíquotas de imposto por corretora e competência para cálculo de repasse.
          </p>
        </div>

        {/* Formulário de registro */}
        <AliquotaForm
          corretoras={corretoras ?? []}
          temRetencaoISS={temRetencaoISS}
        />

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3">
          <select
            name="tenant"
            defaultValue={params.tenant ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todas as corretoras</option>
            {(corretoras ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
            ))}
          </select>
          <input
            type="month"
            name="mes"
            defaultValue={params.mes ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          <button type="submit" className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Filtrar
          </button>
          {(params.tenant || params.mes) && (
            <a href="/admin/aliquotas" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Limpar
            </a>
          )}
        </form>

        {/* Histórico */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Corretora</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Competência</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Regime</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Alíquota Global</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">ISS</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Período</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aliquotas.map(a => {
                const tenant = (Array.isArray(a.tenants) ? a.tenants[0] : a.tenants) as {
                  nome: string; nome_fantasia: string | null; regime_tributario: string | null
                } | null
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {tenant?.nome_fantasia ?? tenant?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatCompetencia(a.competencia)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {tenant?.regime_tributario ? REGIME_LABEL[tenant.regime_tributario] : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">
                      {a.aliquota_global}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {a.aliquota_iss != null ? `${a.aliquota_iss}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {a.periodo_fechado ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Fechado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Aberto
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {aliquotas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhuma alíquota registrada ainda.
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
