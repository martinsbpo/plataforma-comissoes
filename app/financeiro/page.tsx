import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import { ApuracaoClient } from './components/apuracao-client'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ corretora?: string; competencia?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) redirect('/acesso-negado')

  const params = await searchParams
  const isBpo = ['bpo_admin', 'bpo_operador'].includes(session.role)
  const isBpoAdmin = session.role === 'bpo_admin'

  const db = admin()

  // Corretoras para seletor (BPO)
  let corretoras: { id: string; nome: string; nome_fantasia: string | null }[] = []
  if (isBpo) {
    const { data } = await db
      .from('tenants')
      .select('id, nome, nome_fantasia')
      .eq('status', 'ativo')
      .order('nome')
    corretoras = data ?? []
  }

  const corretoraId = isBpo ? (params.corretora ?? '') : session.tenantId
  const competencia = params.competencia ?? ''

  // Lookup de dados para ProducaoForm (quick-add inline)
  let seguradoras: { id: string; nome_fantasia: string | null; nome: string }[] = []
  let grupos: { id: string; nome: string }[] = []
  let produtos: { id: string; nome: string; grupo_produto_id: string }[] = []
  let parceiros: { id: string; nome: string; pct_indicador: number | null; pct_corretor1: number | null; pct_corretor2: number | null }[] = []

  if (corretoraId) {
    const [segRes, grupoRes, prodRes, parcRes] = await Promise.all([
      db.from('seguradoras').select('id, nome_fantasia, nome').eq('tenant_id', corretoraId).eq('ativo', true).order('nome'),
      db.from('grupo_produtos').select('id, nome').order('nome'),
      db.from('produtos').select('id, nome, grupo_produto_id').order('nome'),
      db.from('parceiros').select('id, nome, pct_indicador, pct_corretor1, pct_corretor2').eq('tenant_id', corretoraId).eq('ativo', true).order('nome'),
    ])
    seguradoras = segRes.data ?? []
    grupos = grupoRes.data ?? []
    produtos = prodRes.data ?? []
    parceiros = parcRes.data ?? []
  }

  // Apuração existente
  type ApuracaoRow = {
    id: string
    status: string
    aliquota_pct: number
    total_comissao: number
    total_imposto: number
    total_repasses: number
    total_resultado: number
    confirmado_em: string | null
    confirmado_por: string | null
  }

  let apuracaoExistente: {
    id: string
    status: string
    aliquota_pct: number
    total_comissao: number
    total_imposto: number
    total_repasses: number
    total_resultado: number
    confirmado_em: string | null
    confirmado_por_nome: string | null
    linhas: {
      seguradora_id: string
      seguradora_nome: string | null
      referencia: string
      segurado: string
      produto: string | null
      comissao_recebida: number
      imposto_valor: number
      indicador_nome: string | null
      repasse_indicador: number
      corretor1_nome: string | null
      repasse_corretor1: number
      corretor2_nome: string | null
      repasse_corretor2: number
      resultado: number
    }[]
  } | null = null

  if (corretoraId && competencia) {
    const competenciaDate = `${competencia}-01`
    const { data: ap } = await db
      .from('apuracoes')
      .select('id, status, aliquota_pct, total_comissao, total_imposto, total_repasses, total_resultado, confirmado_em, confirmado_por')
      .eq('tenant_id', corretoraId)
      .eq('competencia', competenciaDate)
      .maybeSingle()

    if (ap) {
      const apRow = ap as ApuracaoRow
      // Resolve nome de quem confirmou
      let confirmado_por_nome: string | null = null
      if (apRow.confirmado_por) {
        const { data: u } = await db.from('users').select('nome').eq('id', apRow.confirmado_por).maybeSingle()
        confirmado_por_nome = (u as { nome: string } | null)?.nome ?? null
      }

      const { data: linhas } = await db
        .from('apuracao_linhas')
        .select(`
          seguradora_id, referencia, segurado, produto,
          comissao_recebida, imposto_valor,
          indicador_nome, pct_indicador, repasse_indicador,
          corretor1_nome, pct_corretor1, repasse_corretor1,
          corretor2_nome, pct_corretor2, repasse_corretor2,
          resultado,
          seguradora:seguradora_id(nome_fantasia, nome)
        `)
        .eq('apuracao_id', apRow.id)

      apuracaoExistente = {
        id: apRow.id,
        status: apRow.status,
        aliquota_pct: apRow.aliquota_pct,
        total_comissao: apRow.total_comissao,
        total_imposto: apRow.total_imposto,
        total_repasses: apRow.total_repasses,
        total_resultado: apRow.total_resultado,
        confirmado_em: apRow.confirmado_em,
        confirmado_por_nome,
        linhas: (linhas ?? []).map(l => {
          type SegRow = { nome_fantasia: string | null; nome: string }
          const segRaw = l.seguradora as SegRow | SegRow[] | null
          const seg = Array.isArray(segRaw) ? segRaw[0] ?? null : segRaw
          return {
            seguradora_id: l.seguradora_id,
            seguradora_nome: seg?.nome_fantasia ?? seg?.nome ?? null,
            referencia: l.referencia,
            segurado: l.segurado,
            produto: l.produto,
            comissao_recebida: l.comissao_recebida,
            imposto_valor: l.imposto_valor,
            indicador_nome: l.indicador_nome,
            pct_indicador: l.pct_indicador,
            repasse_indicador: l.repasse_indicador,
            corretor1_nome: l.corretor1_nome,
            pct_corretor1: l.pct_corretor1,
            repasse_corretor1: l.repasse_corretor1,
            corretor2_nome: l.corretor2_nome,
            pct_corretor2: l.pct_corretor2,
            repasse_corretor2: l.repasse_corretor2,
            resultado: l.resultado,
          }
        }),
      }
    }
  }

  // Competência padrão = mês atual
  const hoje = new Date()
  const competenciaDefault = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-6 p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Apuração Mensal</h1>
      </div>

      {/* Seletores */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        {isBpo && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Corretora</label>
            <select
              name="corretora"
              defaultValue={corretoraId}
              className="px-3 py-2 text-sm border-2 border-[#5B7291] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30 min-w-[220px]"
            >
              <option value="">Selecione a corretora...</option>
              {corretoras.map(c => (
                <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Competência</label>
          <input
            type="month"
            name="competencia"
            defaultValue={competencia || competenciaDefault}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors"
        >
          Selecionar
        </button>
      </form>

      {/* Conteúdo principal */}
      {!corretoraId || !competencia ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Selecione a corretora e a competência para iniciar a apuração.</p>
        </div>
      ) : (
        <ApuracaoClient
          tenantId={corretoraId}
          competencia={competencia}
          apuracaoExistente={apuracaoExistente}
          seguradoras={seguradoras}
          grupos={grupos}
          produtos={produtos}
          parceiros={parceiros}
          isBpoAdmin={isBpoAdmin}
        />
      )}
    </div>
  )
}
