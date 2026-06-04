import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { SeguradoraForm } from '../components/seguradora-form'

export default async function NovaSeguradoraPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: grupos } = await db
    .from('grupos_produto')
    .select('id, nome')
    .eq('status', 'ativo')
    .order('nome')

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Administração' },
        { label: 'Seguradoras', href: '/admin/seguradoras' },
        { label: 'Nova seguradora' },
      ]}
    >
      <div className="max-w-3xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nova Seguradora</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro global — vale para todas as corretoras clientes.</p>
        </div>
        <SeguradoraForm grupos={grupos ?? []} />
      </div>
    </AppLayout>
  )
}
