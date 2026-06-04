import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { GruposTab } from './components/grupos-tab'
import { ProdutosTab } from './components/produtos-tab'
import { DePараTab } from './components/depara-tab'

type Tab = 'grupos' | 'produtos' | 'depara'

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; grupo?: string; seguradora?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'bpo_admin') redirect('/acesso-negado')

  const params = await searchParams
  const aba = (params.aba ?? 'grupos') as Tab

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [{ data: grupos }, { data: produtos }, { data: depara }, { data: seguradoras }] = await Promise.all([
    db.from('grupos_produto').select('id, nome, status').order('nome'),
    db.from('produtos')
      .select('id, nome, status, grupo_produto_id, grupos_produto(nome)')
      .order('nome'),
    db.from('produto_depara')
      .select('id, texto_relatorio, status, observacoes, seguradora_id, grupo_produto_id, produto_id, seguradoras(nome_fantasia), grupos_produto(nome), produtos(nome)')
      .order('texto_relatorio'),
    db.from('seguradoras').select('id, nome_fantasia').eq('status', 'ativo').order('nome_fantasia'),
  ])

  const nav = getNavForRole(session.role)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'grupos',   label: 'Grupos de Produto' },
    { key: 'produtos', label: 'Produtos' },
    { key: 'depara',   label: 'De-Para' },
  ]

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[{ label: 'Administração' }, { label: 'Produtos & De-Para' }]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Produtos & De-Para</h1>
          <p className="text-sm text-gray-500 mt-1">Catálogo de grupos, produtos e mapeamento de relatórios das seguradoras.</p>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-200 gap-1">
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/admin/produtos?aba=${t.key}`}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                aba === t.key
                  ? 'border-[#5B7291] text-[#5B7291]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Conteúdo da aba */}
        {aba === 'grupos' && (
          <GruposTab grupos={grupos ?? []} />
        )}
        {aba === 'produtos' && (
          <ProdutosTab
            produtos={produtos ?? []}
            grupos={(grupos ?? []).filter(g => g.status === 'ativo')}
            filtroGrupo={params.grupo}
          />
        )}
        {aba === 'depara' && (
          <DePараTab
            depara={depara ?? []}
            grupos={(grupos ?? []).filter(g => g.status === 'ativo')}
            produtos={(produtos ?? []).filter(p => p.status === 'ativo')}
            seguradoras={seguradoras ?? []}
            filtroSeguradora={params.seguradora}
            q={params.q}
          />
        )}
      </div>
    </AppLayout>
  )
}
