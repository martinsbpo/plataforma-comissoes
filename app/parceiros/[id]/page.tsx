import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ParceiroForm } from '../components/parceiro-form'

export default async function EditarParceiro({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'corretora_gestor', 'corretora_operador'].includes(session.role)) redirect('/acesso-negado')

  const { id } = await params

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: parceiro } = await db
    .from('parceiros')
    .select('*')
    .eq('id', id)
    .single()

  if (!parceiro) notFound()

  // Corretora só pode editar seus próprios parceiros
  if (!['bpo_admin'].includes(session.role) && parceiro.tenant_id !== session.tenantId) {
    redirect('/acesso-negado')
  }

  const { data: contas } = await db
    .from('parceiro_contas_bancarias')
    .select('id, banco, agencia, conta, tipo_conta, chave_pix, apelido')
    .eq('parceiro_id', id)
    .order('created_at')

  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Parceiros', href: '/parceiros' },
        { label: parceiro.nome },
      ]}
    >
      <div className="max-w-3xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{parceiro.nome}</h1>
            <p className="text-sm text-gray-500 mt-1">{parceiro.email}</p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            parceiro.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {parceiro.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <ParceiroForm
          id={id}
          tenantId={parceiro.tenant_id}
          initial={{
            nome: parceiro.nome,
            cpf: parceiro.cpf,
            email: parceiro.email,
            telefone: parceiro.telefone ?? '',
            codigo_susep: parceiro.codigo_susep ?? '',
            pct_indicador: parceiro.pct_indicador,
            pct_corretor1: parceiro.pct_corretor1,
            pct_corretor2: parceiro.pct_corretor2,
            observacoes: parceiro.observacoes ?? '',
            status: parceiro.status,
          }}
          contasIniciais={contas ?? []}
        />
      </div>
    </AppLayout>
  )
}
