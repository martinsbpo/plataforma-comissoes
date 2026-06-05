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
    mes_inicio?: string
    mes_fim?: string
    seguradora?: string
    parceiro?: string
    q?: string
    vinculacao?: string
  }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'corretora_operador'].includes(session.role)) {
    redirect('/acesso-negado')
  }

  const params = await searchParams
  const { mes_inicio, mes_fim, seguradora, parceiro, q, vinculacao } = params
  const podeEditar = ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'].includes(session.role)

  const db = admin()

  // Dados de apoio para formulários
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

  // Query principal de produção
  let query = db
    .from('producao')
    .select(`
      id, competencia, data, seguradora_id, segurado, referencia, cpf_segurado,
      grupo_produto_id, produto_id,
      comissao, indicador_id, pct_indicador, corretor1_id, pct_corretor1,
      corretor2_id, pct_corretor2, impostos_pct,
      repasse_indicador, repasse_corretor1, repasse_corretor2, resultado,
      status_vinculacao, status_periodo, observacoes,
      seguradora:seguradora_id (nome_fantasia, nome),
      indicador:indicador_id (nome),
      corretor1:corretor1_id (nome),
      corretor2:corretor2_id (nome),
      grupo_produto:grupo_produto_id (nome),
      produto:produto_id (nome)
    `)
    .eq('tenant_id', session.tenantId)
    .order('competencia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (mes_inicio) query = query.gte('competencia', `${mes_inicio}-01`)
  if (mes_fim) query = query.lte('competencia', `${mes_fim}-01`)
  if (seguradora) query = query.eq('seguradora_id', seguradora)
  if (vinculacao) query = query.eq('status_vinculacao', vinculacao)

  if (parceiro) {
    query = query.or(
      `indicador_id.eq.${parceiro},corretor1_id.eq.${parceiro},corretor2_id.eq.${parceiro}`
    )
  }
  if (q) {
    query = query.or(`segurado.ilike.%${q}%,referencia.ilike.%${q}%,cpf_segurado.ilike.%${q}%`)
  }

  const { data: rows } = await query

  const nav = getNavForRole(session.role)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const temFiltro = !!(mes_inicio || mes_fim || seguradora || parceiro || q || vinculacao)
  const exportParams = new URLSearchParams()
  if (mes_inicio) exportParams.set('mes_inicio', mes_inicio)
  if (mes_fim) exportParams.set('mes_fim', mes_fim)
  if (seguradora) exportParams.set('seguradora', seguradora)
  if (parceiro) exportParams.set('parceiro', parceiro)
  if (q) exportParams.set('q', q)
  if (vinculacao) exportParams.set('vinculacao', vinculacao)

  return (
    <AppLayout session={session} nav={nav} breadcrumb={[{ label: 'Produção' }]}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Base de Produção</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows?.length ?? 0} lançamento{(rows?.length ?? 0) !== 1 ? 's' : ''} {temFiltro ? 'filtrado' : 'total'} — {session.tenantNome}
          </p>
        </div>

        {/* Filtros */}
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">De</label>
            <input
              type="month"
              name="mes_inicio"
              defaultValue={mes_inicio ?? ''}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Até</label>
            <input
              type="month"
              name="mes_fim"
              defaultValue={mes_fim ?? ''}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
            />
          </div>
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
          <select
            name="vinculacao"
            defaultValue={vinculacao ?? ''}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todos os vínculos</option>
            <option value="pendente">⏳ Pendente</option>
            <option value="vinculado">✅ Vinculado</option>
            <option value="divergente">⚠️ Divergente</option>
          </select>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Segurado, CPF ou referência..."
            className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Filtrar
          </button>
          {temFiltro && (
            <Link href="/producao" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Limpar
            </Link>
          )}
        </form>

        {/* Tabela interativa */}
        <ProducaoTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows={(rows ?? []) as any}
          seguradoras={seguradoras ?? []}
          grupos={grupos ?? []}
          produtos={produtos ?? []}
          parceiros={parceiros ?? []}
          tenantId={session.tenantId}
          podeEditar={podeEditar}
          defaultCompetencia={mesAtual}
          exportParams={exportParams.toString()}
        />
      </div>
    </AppLayout>
  )
}
