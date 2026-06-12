import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { listarSaldosParceiros } from './actions'
import { RepassesClient } from './components/repasses-client'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function RepassesPage({
  searchParams,
}: {
  searchParams: Promise<{ corretora?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) redirect('/acesso-negado')

  const params = await searchParams
  const db = admin()
  const isBpo = ['bpo_admin', 'bpo_operador'].includes(session.role)

  let corretoras: { id: string; nome: string; nome_fantasia: string | null }[] = []
  if (isBpo) {
    const { data } = await db
      .from('tenants')
      .select('id, nome, nome_fantasia')
      .eq('status', 'ativo')
      .order('nome')
    corretoras = data ?? []
  }

  const corretoraId = isBpo ? (params.corretora ?? '') : session.tenantId

  let saldos = null
  let parceiros: { id: string; nome: string }[] = []

  if (corretoraId) {
    const resultado = await listarSaldosParceiros(corretoraId)
    if (!('error' in resultado)) {
      saldos = resultado
    }

    const { data } = await db
      .from('parceiros')
      .select('id, nome')
      .eq('tenant_id', corretoraId)
      .eq('status', 'ativo')
      .order('nome')
    parceiros = data ?? []
  }

  const nav = getNavForRole(session.role)

  return (
    <AppLayout session={session} nav={nav} breadcrumb={[{ label: 'Repasses a Parceiros' }]}>
      <div className="flex flex-col gap-6 p-6 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Repasses a Parceiros</h1>
        </div>

        {/* Seletor de corretora */}
        {isBpo && (
          <form method="GET" className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Corretora</label>
              <select
                name="corretora"
                defaultValue={corretoraId}
                className="px-3 py-2 text-sm border-2 border-[#5B7291] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30 min-w-[220px]"
              >
                <option value="">Selecione a corretora...</option>
                {corretoras.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors"
            >
              Selecionar
            </button>
          </form>
        )}

        {!corretoraId ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm">Selecione a corretora para visualizar os repasses.</p>
          </div>
        ) : (
          <RepassesClient
            tenantId={corretoraId}
            saldos={saldos ?? []}
            parceiros={parceiros}
            isBpoAdmin={session.role === 'bpo_admin'}
          />
        )}
      </div>
    </AppLayout>
  )
}
