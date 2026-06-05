import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ProducaoTable } from './components/producao-table'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function ProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{
    seguradora?: string
    parceiro?: string
    q?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    redirect('/acesso-negado')
  }

  const params = await searchParams
  const { seguradora, parceiro, q } = params
  const podeEditar = ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)

  const db = admin()

  const [
    { data: seguradoras },
    { data: grupos },
    { data: produtos },
    { data: parceiros },
  ] = await Promise.all([
    db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome_fantasia'),
    db.from('grupos_produto').select('id, nome').order('nome'),
    db.from('produtos').select('id, nome, grupo_produto_id').order('nome'),
    db.from('parceiros').select('id, nome, pct_indicador, pct_corretor1, pct_corretor2')
      .eq('tenant_id', session.tenantId).eq('status', 'ativo').order('nome'),
  ])

  let query = db
    .from('producao')
    .select(`
      id, data, seguradora_id, segurado, referencia, cpf_segurado,
      grupo_produto_id, produto_id, comissao,
      indicador_id, pct_indicador, corretor1_id, pct_corretor1,
      corretor2_id, pct_corretor2, observacoes,
      seguradora:seguradora_id (nome_fantasia, nome),
      indicador:indicador_id (nome),
      corretor1:corretor1_id (nome),
      corretor2:corretor2_id (nome),
      grupo_produto:grupo_produto_id (nome),
      produto:produto_id (nome)
    `)
    .eq('tenant_id', session.tenantId)
    .order('data', { ascending: false })
    .limit(500)

  if (seguradora) query = query.eq('seguradora_id', seguradora)
  if (parceiro) query = query.or(
    `indicador_id.eq.${parceiro},corretor1_id.eq.${parceiro},corretor2_id.eq.${parceiro}`
  )
  if (q) query = query.or(`segurado.ilike.%${q}%,referencia.ilike.%${q}%,cpf_segurado.ilike.%${q}%`)

  const { data: rows } = await query

  const nav = getNavForRole(session.role)
  const temFiltro = !!(seguradora || parceiro || q)

  const exportParams = new URLSearchParams()
  if (seguradora) exportParams.set('seguradora', seguradora)
  if (parceiro) exportParams.set('parceiro', parceiro)
  if (q) exportParams.set('q', q)

  return (
    <AppLayout session={session} nav={nav} breadcrumb={[{ label: 'Produção' }]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Base de Produção</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows?.length ?? 0} negócio{(rows?.length ?? 0) !== 1 ? 's' : ''} {temFiltro ? 'filtrado' : 'cadastrado'} — {session.tenantNome}
          </p>
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <select
            name="seguradora"
            defaultValue={seguradora ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todas as seguradoras</option>
            {(seguradoras ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.nome_fantasia ?? s.nome}</option>
            ))}
          </select>
          <select
            name="parceiro"
            defaultValue={parceiro ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todos os parceiros</option>
            {(parceiros ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Segurado, CPF ou referência..."
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          <button type="submit" className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Filtrar
          </button>
          {temFiltro && (
            <Link href="/producao" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Limpar
            </Link>
          )}
        </form>

        <ProducaoTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows={(rows ?? []) as any}
          seguradoras={seguradoras ?? []}
          grupos={grupos ?? []}
          produtos={produtos ?? []}
          parceiros={parceiros ?? []}
          tenantId={session.tenantId}
          podeEditar={podeEditar}
          exportParams={exportParams.toString()}
        />
      </div>
    </AppLayout>
  )
}
