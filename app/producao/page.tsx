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
    corretora?: string
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
  const isBpo = ['bpo_admin', 'bpo_operador', 'bpo_visualizador'].includes(session.role)
  const podeEditar = ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)

  // Corretora ativa no contexto: BPO Admin escolhe via param, outros usam o próprio tenant
  const corretoraId = isBpo ? (params.corretora ?? '') : session.tenantId

  const db = admin()

  // Busca corretoras só para BPO
  const corretoras = isBpo
    ? (await db.from('tenants').select('id, nome, nome_fantasia').eq('status', 'ativo').order('nome_fantasia')).data ?? []
    : []

  const corretoraAtual = isBpo
    ? corretoras.find(c => c.id === corretoraId)
    : null

  const [
    { data: seguradoras },
    { data: grupos },
    { data: produtos },
    { data: parceiros },
  ] = await Promise.all([
    db.from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome_fantasia'),
    db.from('grupos_produto').select('id, nome').order('nome'),
    db.from('produtos').select('id, nome, grupo_produto_id').order('nome'),
    corretoraId
      ? db.from('parceiros').select('id, nome, pct_indicador, pct_corretor1, pct_corretor2')
          .eq('tenant_id', corretoraId).eq('status', 'ativo').order('nome')
      : Promise.resolve({ data: [] }),
  ])

  // Produção: só carrega se uma corretora estiver selecionada
  let rows: unknown[] = []
  if (corretoraId) {
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
      .eq('tenant_id', corretoraId)
      .order('data', { ascending: false })
      .limit(500)

    if (seguradora) query = query.eq('seguradora_id', seguradora)
    if (parceiro) query = query.or(
      `indicador_id.eq.${parceiro},corretor1_id.eq.${parceiro},corretor2_id.eq.${parceiro}`
    )
    if (q) query = query.or(`segurado.ilike.%${q}%,referencia.ilike.%${q}%,cpf_segurado.ilike.%${q}%`)

    const { data } = await query
    rows = data ?? []
  }

  const nav = getNavForRole(session.role)
  const temFiltro = !!(seguradora || parceiro || q)

  const exportParams = new URLSearchParams()
  if (corretoraId) exportParams.set('corretora', corretoraId)
  if (seguradora) exportParams.set('seguradora', seguradora)
  if (parceiro) exportParams.set('parceiro', parceiro)
  if (q) exportParams.set('q', q)

  const nomeCorretora = isBpo
    ? (corretoraAtual ? (corretoraAtual.nome_fantasia ?? corretoraAtual.nome) : null)
    : session.tenantNome

  return (
    <AppLayout session={session} nav={nav} breadcrumb={[{ label: 'Produção' }]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Base de Produção</h1>
          <p className="text-sm text-gray-500 mt-1">
            {nomeCorretora
              ? `${rows.length} negócio${rows.length !== 1 ? 's' : ''} ${temFiltro ? 'filtrado' : 'cadastrado'} — ${nomeCorretora}`
              : 'Selecione uma corretora para visualizar a produção'}
          </p>
        </div>

        {/* Seletor de corretora (BPO) + filtros */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          {isBpo && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Corretora</label>
              <select
                name="corretora"
                defaultValue={corretoraId}
                className="px-3 py-2 text-sm border-2 border-[#5B7291] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30 font-medium"
              >
                <option value="">Selecione a corretora...</option>
                {corretoras.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
                ))}
              </select>
            </div>
          )}

          {corretoraId && (
            <>
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
            </>
          )}

          <button type="submit" className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            {corretoraId ? 'Filtrar' : 'Selecionar'}
          </button>
          {(temFiltro) && (
            <Link
              href={corretoraId ? `/producao?corretora=${corretoraId}` : '/producao'}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Limpar filtros
            </Link>
          )}
        </form>

        {corretoraId ? (
          <ProducaoTable
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rows={rows as any}
            seguradoras={seguradoras ?? []}
            grupos={grupos ?? []}
            produtos={produtos ?? []}
            parceiros={(parceiros ?? []) as { id: string; nome: string; pct_indicador: number | null; pct_corretor1: number | null; pct_corretor2: number | null }[]}
            tenantId={corretoraId}
            podeEditar={podeEditar}
            exportParams={exportParams.toString()}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
            Selecione uma corretora para visualizar e gerenciar a produção.
          </div>
        )}
      </div>
    </AppLayout>
  )
}
