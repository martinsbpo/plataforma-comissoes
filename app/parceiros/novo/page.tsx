import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ParceiroForm } from '../components/parceiro-form'

export default async function NovoParceiro() {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'corretora_gestor', 'corretora_operador'].includes(session.role)) redirect('/acesso-negado')

  const isBpo = session.role === 'bpo_admin'
  let corretoras: { id: string; nome: string; nome_fantasia: string | null }[] = []

  if (isBpo) {
    const db = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data } = await db
      .from('tenants')
      .select('id, nome, nome_fantasia')
      .eq('status', 'ativo')
      .order('nome_fantasia')
    corretoras = data ?? []
  }

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Parceiros', href: '/parceiros' },
        { label: 'Novo parceiro' },
      ]}
    >
      <div className="max-w-3xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Novo Parceiro</h1>
          <p className="text-sm text-gray-500 mt-1">{isBpo ? 'Selecione a corretora abaixo' : session.tenantNome}</p>
        </div>
        <ParceiroForm
          tenantId={session.tenantId}
          corretoras={isBpo ? corretoras : undefined}
        />
      </div>
    </AppLayout>
  )
}
