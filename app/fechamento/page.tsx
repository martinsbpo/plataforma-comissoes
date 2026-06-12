import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { FechamentoClient } from './components/fechamento-client'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ corretora?: string; competencia?: string; seguradora?: string; segurado?: string; parceiro?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) redirect('/acesso-negado')

  const params = await searchParams
  const db = admin()
  const isBpo = ['bpo_admin', 'bpo_operador'].includes(session.role)

  // Corretoras para seletor
  let corretoras: { id: string; nome: string; nome_fantasia: string | null }[] = []
  if (isBpo) {
    const { data } = await db.from('tenants').select('id, nome, nome_fantasia').eq('status', 'ativo').order('nome')
    corretoras = data ?? []
  }

  const corretoraId = isBpo ? (params.corretora ?? '') : session.tenantId

  type Linha = {
    competencia: string
    seguradora_id: string
    seguradora_nome: string | null
    referencia: string
    segurado: string
    produto: string | null
    comissao_recebida: number
    aliquota_pct: number
    imposto_valor: number
    indicador_nome: string | null
    pct_indicador: number | null
    repasse_indicador: number
    corretor1_nome: string | null
    pct_corretor1: number | null
    repasse_corretor1: number
    corretor2_nome: string | null
    pct_corretor2: number | null
    repasse_corretor2: number
    resultado: number
  }

  let linhas: Linha[] = []
  let seguradoras: { id: string; nome: string }[] = []
  let parceiros: { id: string; nome: string }[] = []
  let competencias: string[] = []

  if (corretoraId) {
    // Busca apurações confirmadas
    const { data: apuracoes } = await db
      .from('apuracoes')
      .select('id, competencia')
      .eq('tenant_id', corretoraId)
      .eq('status', 'confirmada')
      .order('competencia', { ascending: false })

    if (apuracoes && apuracoes.length > 0) {
      competencias = apuracoes.map(a => a.competencia)
      const apuracaoIds = apuracoes.map(a => a.id)
      const compMap: Record<string, string> = Object.fromEntries(apuracoes.map(a => [a.id, a.competencia]))

      // Busca todas as linhas das apurações confirmadas
      let query = db
        .from('apuracao_linhas')
        .select(`
          apuracao_id, seguradora_id, referencia, segurado, produto,
          comissao_recebida, aliquota_pct, imposto_valor,
          indicador_nome, pct_indicador, repasse_indicador,
          corretor1_nome, pct_corretor1, repasse_corretor1,
          corretor2_nome, pct_corretor2, repasse_corretor2,
          resultado,
          seguradora:seguradora_id(nome_fantasia, nome)
        `)
        .in('apuracao_id', apuracaoIds)
        .order('referencia')

      if (params.seguradora) query = query.eq('seguradora_id', params.seguradora)
      if (params.segurado) query = query.ilike('segurado', `%${params.segurado}%`)

      const { data: raw } = await query

      type SegRow = { nome_fantasia: string | null; nome: string }
      linhas = (raw ?? []).map(l => {
        const seg = Array.isArray(l.seguradora) ? l.seguradora[0] : l.seguradora as SegRow | null
        return {
          competencia: compMap[l.apuracao_id],
          seguradora_id: l.seguradora_id,
          seguradora_nome: seg?.nome_fantasia ?? seg?.nome ?? null,
          referencia: l.referencia,
          segurado: l.segurado,
          produto: l.produto,
          comissao_recebida: Number(l.comissao_recebida),
          aliquota_pct: Number(l.aliquota_pct),
          imposto_valor: Number(l.imposto_valor),
          indicador_nome: l.indicador_nome,
          pct_indicador: l.pct_indicador ? Number(l.pct_indicador) : null,
          repasse_indicador: Number(l.repasse_indicador),
          corretor1_nome: l.corretor1_nome,
          pct_corretor1: l.pct_corretor1 ? Number(l.pct_corretor1) : null,
          repasse_corretor1: Number(l.repasse_corretor1),
          corretor2_nome: l.corretor2_nome,
          pct_corretor2: l.pct_corretor2 ? Number(l.pct_corretor2) : null,
          repasse_corretor2: Number(l.repasse_corretor2),
          resultado: Number(l.resultado),
        }
      })

      // Filtro por competência (client-side após fetch)
      if (params.competencia) {
        linhas = linhas.filter(l => l.competencia === `${params.competencia}-01`)
      }

      // Filtro por parceiro (indicador ou corretor)
      if (params.parceiro) {
        linhas = linhas.filter(l =>
          l.indicador_nome?.toLowerCase().includes(params.parceiro!.toLowerCase()) ||
          l.corretor1_nome?.toLowerCase().includes(params.parceiro!.toLowerCase()) ||
          l.corretor2_nome?.toLowerCase().includes(params.parceiro!.toLowerCase())
        )
      }

      // Listas para filtros
      const { data: segs } = await db
        .from('seguradoras').select('id, nome_fantasia, nome').eq('status', 'ativo').order('nome')
      seguradoras = (segs ?? []).map(s => ({ id: s.id, nome: s.nome_fantasia ?? s.nome }))

      const { data: parcs } = await db
        .from('parceiros').select('id, nome').eq('tenant_id', corretoraId).eq('status', 'ativo').order('nome')
      parceiros = parcs ?? []
    }
  }

  const nav = getNavForRole(session.role)

  return (
    <AppLayout session={session} nav={nav} breadcrumb={[{ label: 'Produção Apurada' }]}>
      <div className="flex flex-col gap-6 p-6 max-w-screen-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">Produção Apurada</h1>

        {/* Seletor de corretora */}
        {isBpo && (
          <form method="GET" className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Corretora</label>
              <select
                name="corretora"
                defaultValue={corretoraId}
                className="px-3 py-2 text-sm border-2 border-[#5B7291] rounded-lg focus:outline-none min-w-[200px]"
              >
                <option value="">Selecione...</option>
                {corretoras.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080]">
              Selecionar
            </button>
          </form>
        )}

        {!corretoraId ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm">Selecione a corretora para visualizar a produção apurada.</p>
          </div>
        ) : competencias.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm">Nenhuma apuração confirmada encontrada para esta corretora.</p>
          </div>
        ) : (
          <FechamentoClient
            linhas={linhas}
            seguradoras={seguradoras}
            parceiros={parceiros}
            competencias={competencias}
            corretoraId={corretoraId}
            filtros={{
              competencia: params.competencia ?? '',
              seguradora: params.seguradora ?? '',
              segurado: params.segurado ?? '',
              parceiro: params.parceiro ?? '',
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}
