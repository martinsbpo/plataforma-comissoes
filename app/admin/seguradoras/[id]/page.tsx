import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { SeguradoraForm } from '../components/seguradora-form'

export default async function EditarSeguradoraPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const { id } = await params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: seg } = await db
    .from('seguradoras')
    .select('*')
    .eq('id', id)
    .single()

  if (!seg) notFound()

  const [{ data: retencoes }, { data: grupos }] = await Promise.all([
    db.from('seguradora_retencoes')
      .select('regime, retem_iss, retem_irpj, aliquota_irpj')
      .eq('seguradora_id', id),
    db.from('grupos_produto')
      .select('id, nome')
      .eq('status', 'ativo')
      .order('nome'),
  ])

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Administração' },
        { label: 'Seguradoras', href: '/admin/seguradoras' },
        { label: seg.nome_fantasia },
      ]}
    >
      <div className="max-w-3xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{seg.nome_fantasia}</h1>
            <p className="text-sm text-gray-500 mt-1">{seg.nome}</p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            seg.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {seg.status === 'ativo' ? 'Ativa' : 'Inativa'}
          </span>
        </div>
        <SeguradoraForm
          id={id}
          initial={{
            nome: seg.nome,
            nome_fantasia: seg.nome_fantasia,
            cnpj: seg.cnpj,
            codigo_susep: seg.codigo_susep,
            ramos: seg.ramos ?? [],
            politica_nf: seg.politica_nf,
            formato_estorno: seg.formato_estorno,
            observacoes: seg.observacoes ?? '',
            status: seg.status,
          }}
          retencoesIniciais={retencoes ?? []}
          grupos={grupos ?? []}
        />
      </div>
    </AppLayout>
  )
}
