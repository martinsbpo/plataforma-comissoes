import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { LayoutForm } from '../components/layout-form'

export default async function NovoLayoutPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: seguradoras }, { data: grupos }, { data: produtos }] = await Promise.all([
    db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome_fantasia'),
    db.from('grupos_produto').select('id, nome').eq('status', 'ativo').order('nome'),
    db.from('produtos').select('id, nome, grupo_produto_id').eq('status', 'ativo').order('nome'),
  ])

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Administração' },
        { label: 'Layouts de Importação', href: '/admin/layouts' },
        { label: 'Novo layout' },
      ]}
    >
      <div className="max-w-4xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Novo Layout de Importação</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure como o sistema deve ler o relatório desta seguradora.
          </p>
        </div>
        <LayoutForm
          seguradoras={seguradoras ?? []}
          grupos={grupos ?? []}
          produtos={produtos ?? []}
        />
      </div>
    </AppLayout>
  )
}
