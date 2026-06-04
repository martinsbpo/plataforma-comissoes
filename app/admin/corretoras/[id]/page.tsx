import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CorretoraForm } from '../components/corretora-form'
import { StatusBadge } from '../components/status-badge'

export default async function EditarCorretoraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const { id } = await params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: corretora } = await db
    .from('tenants')
    .select('*')
    .eq('id', id)
    .eq('tenant_type', 'corretora')
    .single()

  if (!corretora) notFound()

  const { data: contas } = await db
    .from('corretora_contas_bancarias')
    .select('id, banco, agencia, conta, apelido')
    .eq('tenant_id', id)
    .order('created_at', { ascending: true })

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Administração' },
        { label: 'Corretoras', href: '/admin/corretoras' },
        { label: corretora.nome_fantasia ?? corretora.nome },
      ]}
    >
      <div className="max-w-3xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{corretora.nome_fantasia ?? corretora.nome}</h1>
            <p className="text-sm text-gray-500 mt-1">{corretora.nome}</p>
          </div>
          <StatusBadge status={corretora.status} />
        </div>
        <CorretoraForm
          id={id}
          initial={{
            nome: corretora.nome,
            nome_fantasia: corretora.nome_fantasia ?? '',
            cnpj: corretora.cnpj ?? '',
            codigo_susep: corretora.codigo_susep ?? '',
            contato_nome: corretora.contato_nome ?? '',
            contato_email: corretora.contato_email ?? '',
            telefone: corretora.telefone ?? '',
            regime_tributario: corretora.regime_tributario,
            data_inicio_contrato: corretora.data_inicio_contrato ?? '',
            data_encerramento_contrato: corretora.data_encerramento_contrato ?? '',
            observacoes_internas: corretora.observacoes_internas ?? '',
            primary_color: corretora.primary_color ?? '#5B7291',
            logo_url: corretora.logo_url ?? '',
            status: corretora.status,
          }}
          contasIniciais={contas ?? []}
          isBpoAdmin={session.role === 'bpo_admin'}
        />
      </div>
    </AppLayout>
  )
}
