import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { LayoutForm } from '../components/layout-form'

export default async function EditarLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const { id } = await params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: layout }, { data: seguradoras }, { data: grupos }, { data: produtos }] =
    await Promise.all([
      db
        .from('seguradora_layouts')
        .select('*, mapeamentos:layout_mapeamentos(*)')
        .eq('id', id)
        .single(),
      db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome_fantasia'),
      db.from('grupos_produto').select('id, nome').eq('status', 'ativo').order('nome'),
      db.from('produtos').select('id, nome, grupo_produto_id').eq('status', 'ativo').order('nome'),
    ])

  if (!layout) notFound()

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Administração' },
        { label: 'Layouts de Importação', href: '/admin/layouts' },
        { label: layout.nome },
      ]}
    >
      <div className="max-w-4xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{layout.nome}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Versão {layout.versao} ·{' '}
            <span
              className={
                layout.status === 'ativo'
                  ? 'text-green-600'
                  : layout.status === 'arquivado'
                  ? 'text-orange-500'
                  : 'text-gray-400'
              }
            >
              {layout.status.charAt(0).toUpperCase() + layout.status.slice(1)}
            </span>
          </p>
        </div>
        <LayoutForm
          seguradoras={seguradoras ?? []}
          grupos={grupos ?? []}
          produtos={produtos ?? []}
          layout={layout}
        />
      </div>
    </AppLayout>
  )
}
