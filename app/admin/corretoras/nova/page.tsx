import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { CorretoraForm } from '../components/corretora-form'

export default async function NovaCorretoraPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Administração' },
        { label: 'Corretoras', href: '/admin/corretoras' },
        { label: 'Nova corretora' },
      ]}
    >
      <div className="max-w-3xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nova Corretora</h1>
          <p className="text-sm text-gray-500 mt-1">Preencha os dados para cadastrar uma nova corretora cliente.</p>
        </div>
        <CorretoraForm isBpoAdmin={session.role === 'bpo_admin'} />
      </div>
    </AppLayout>
  )
}
