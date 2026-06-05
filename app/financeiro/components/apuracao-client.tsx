'use client'

import { useState, useTransition } from 'react'
import { calcularApuracao, confirmarApuracao, reabrirApuracao, ResultadoCalculo, LinhaSemProducao } from '../actions'
import { ProducaoForm } from '@/app/producao/components/producao-form'
import { criarProducao } from '@/app/producao/actions'

type Seguradora = { id: string; nome_fantasia: string | null; nome: string }
type GrupoProduto = { id: string; nome: string }
type Produto = { id: string; nome: string; grupo_produto_id: string }
type Parceiro = { id: string; nome: string; pct_indicador: number | null; pct_corretor1: number | null; pct_corretor2: number | null }

type ApuracaoExistente = {
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
}

type Props = {
  tenantId: string
  competencia: string
  apuracaoExistente: ApuracaoExistente | null
  seguradoras: Seguradora[]
  grupos: GrupoProduto[]
  produtos: Produto[]
  parceiros: Parceiro[]
  isBpoAdmin: boolean
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number | null) => v != null ? `${v}%` : '—'

export function ApuracaoClient({
  tenantId, competencia, apuracaoExistente,
  seguradoras, grupos, produtos, parceiros, isBpoAdmin,
}: Props) {
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null)
  const [apuracao, setApuracao] = useState<ApuracaoExistente | null>(apuracaoExistente)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [pending, startTransition] = useTransition()

  // Quick-add produção a partir de linha sem produção
  const [cadastrandoLinha, setCadastrandoLinha] = useState<LinhaSemProducao | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 5000)
  }

  function handleCalcular() {
    setErro('')
    setResultado(null)
    startTransition(async () => {
      const r = await calcularApuracao(tenantId, competencia)
      if ('error' in r) { setErro(r.error); return }
      setResultado(r)
    })
  }

  function handleConfirmar() {
    if (!resultado) return
    if (resultado.sem_aliquota) { setErro('Cadastre a alíquota de imposto antes de confirmar.'); return }
    startTransition(async () => {
      const r = await confirmarApuracao(tenantId, competencia, resultado)
      if ('error' in r && r.error) { setErro(r.error); return }
      showToast('Apuração confirmada com sucesso!')
      setResultado(null)
      // Recarrega a página para mostrar apuração confirmada
      window.location.reload()
    })
  }

  function handleReabrir() {
    startTransition(async () => {
      const r = await reabrirApuracao(tenantId, competencia)
      if ('error' in r && r.error) { setErro(r.error); return }
      setApuracao(null)
      showToast('Apuração reaberta.')
    })
  }

  // Após cadastrar produção inline, recalcula
  async function handleProducaoCadastrada(msg: string) {
    setCadastrandoLinha(null)
    showToast(msg + ' Recalculando...')
    const r = await calcularApuracao(tenantId, competencia)
    if ('error' in r) { setErro(r.error); return }
    setResultado(r)
  }

  const linhasConfirmadas = apuracao?.linhas ?? []

  // Modo somente leitura (apuração confirmada)
  if (apuracao?.status === 'confirmada') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            ✅ Confirmada
          </span>
          {apuracao.confirmado_em && (
            <span className="text-xs text-gray-400">
              em {new Date(apuracao.confirmado_em).toLocaleDateString('pt-BR')}
              {apuracao.confirmado_por_nome ? ` por ${apuracao.confirmado_por_nome}` : ''}
            </span>
          )}
          {isBpoAdmin && (
            <button
              onClick={handleReabrir}
              disabled={pending}
              className="ml-auto px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Reabrir apuração
            </button>
          )}
        </div>

        <Totais
          total_comissao={apuracao.total_comissao}
          total_imposto={apuracao.total_imposto}
          total_repasses={apuracao.total_repasses}
          total_resultado={apuracao.total_resultado}
          aliquota_pct={apuracao.aliquota_pct}
          count={linhasConfirmadas.length}
        />

        <TabelaVinculadas linhas={linhasConfirmadas} readonly />

        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  // Modo cálculo
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleCalcular}
          disabled={pending}
          className="px-5 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] disabled:opacity-60 transition-colors"
        >
          {pending ? 'Calculando...' : resultado ? 'Recalcular' : 'Calcular apuração'}
        </button>
        {resultado && !resultado.sem_aliquota && (
          <button
            onClick={handleConfirmar}
            disabled={pending}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            Confirmar apuração
          </button>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {resultado?.sem_aliquota && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          ⚠️ Alíquota de imposto não cadastrada para esta competência — vá em Administração → Alíquotas Mensais antes de confirmar.
        </div>
      )}

      {resultado && (
        <>
          <Totais
            total_comissao={resultado.total_comissao}
            total_imposto={resultado.total_imposto}
            total_repasses={resultado.total_repasses}
            total_resultado={resultado.total_resultado}
            aliquota_pct={resultado.aliquota_pct}
            count={resultado.vinculadas.length}
          />

          {resultado.vinculadas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Vinculados — {resultado.vinculadas.length} negócio{resultado.vinculadas.length !== 1 ? 's' : ''}
              </h2>
              <TabelaVinculadas linhas={resultado.vinculadas} />
            </div>
          )}

          {resultado.sem_producao.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-700 mb-3">
                ⚠️ Sem produção cadastrada — {resultado.sem_producao.length} negócio{resultado.sem_producao.length !== 1 ? 's' : ''}
              </h2>
              <div className="bg-white rounded-xl border border-amber-200 overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-amber-50 border-b border-amber-100">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Seguradora</th>
                      <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Referência</th>
                      <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Segurado</th>
                      <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Comissão</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resultado.sem_producao.map(linha => (
                      <tr key={linha.importacao_linha_id} className="hover:bg-amber-50/50">
                        <td className="px-3 py-2 text-gray-700">{linha.seguradora_nome}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{linha.referencia}</td>
                        <td className="px-3 py-2 text-gray-700">{linha.segurado}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(linha.comissao_recebida)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setCadastrandoLinha(linha)}
                            className="text-xs text-[#5B7291] hover:underline"
                          >
                            + Cadastrar produção
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal quick-add produção */}
      {cadastrandoLinha && (
        <ProducaoForm
          seguradoras={seguradoras}
          grupos={grupos}
          produtos={produtos}
          parceiros={parceiros}
          tenantId={tenantId}
          editRow={undefined}
          preFill={{
            seguradora_id: cadastrandoLinha.seguradora_id,
            referencia: cadastrandoLinha.referencia,
            segurado: cadastrandoLinha.segurado,
            comissao: cadastrandoLinha.comissao_recebida,
          }}
          onClose={() => setCadastrandoLinha(null)}
          onSaved={handleProducaoCadastrada}
        />
      )}

      {toast && <Toast msg={toast} />}
    </div>
  )
}

function Totais({ total_comissao, total_imposto, total_repasses, total_resultado, aliquota_pct, count }: {
  total_comissao: number; total_imposto: number; total_repasses: number; total_resultado: number; aliquota_pct: number; count: number
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: 'Comissão recebida', valor: total_comissao, sub: `${count} negócio${count !== 1 ? 's' : ''}` },
        { label: `Impostos (${aliquota_pct}%)`, valor: total_imposto, sub: 'deduzido da base' },
        { label: 'Total repasses', valor: total_repasses, sub: 'para parceiros' },
        { label: 'Resultado corretora', valor: total_resultado, sub: 'líquido', destaque: true },
      ].map(c => (
        <div key={c.label} className={`bg-white rounded-xl border p-4 ${c.destaque ? 'border-[#5B7291]/40' : 'border-gray-200'}`}>
          <p className="text-xs text-gray-500">{c.label}</p>
          <p className={`text-lg font-semibold mt-1 ${c.destaque ? 'text-[#5B7291]' : 'text-gray-900'}`}>{fmt(c.valor)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

function TabelaVinculadas({ linhas, readonly = false }: { linhas: { seguradora_nome?: string | null; seguradora_id?: string; referencia: string; segurado: string; produto: string | null; comissao_recebida: number; imposto_valor: number; indicador_nome: string | null; repasse_indicador: number; corretor1_nome: string | null; repasse_corretor1: number; corretor2_nome: string | null; repasse_corretor2: number; resultado: number }[]; readonly?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border overflow-x-auto ${readonly ? 'border-gray-200' : 'border-gray-200'}`}>
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Seguradora</th>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Referência</th>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Segurado</th>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Produto</th>
            <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Comissão</th>
            <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Imposto</th>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Indicador</th>
            <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Rep. Ind.</th>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Corretor 1</th>
            <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Rep. Cor1</th>
            <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Corretor 2</th>
            <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Rep. Cor2</th>
            <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.map((l, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-700">{l.seguradora_nome ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-gray-700">{l.referencia}</td>
              <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{l.segurado}</td>
              <td className="px-3 py-2 text-gray-500">{l.produto ?? '—'}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(l.comissao_recebida)}</td>
              <td className="px-3 py-2 text-right text-gray-500">{fmt(l.imposto_valor)}</td>
              <td className="px-3 py-2 text-gray-600">{l.indicador_nome ?? '—'}</td>
              <td className="px-3 py-2 text-right text-gray-700">{l.indicador_nome ? fmt(l.repasse_indicador) : '—'}</td>
              <td className="px-3 py-2 text-gray-600">{l.corretor1_nome ?? '—'}</td>
              <td className="px-3 py-2 text-right text-gray-700">{l.corretor1_nome ? fmt(l.repasse_corretor1) : '—'}</td>
              <td className="px-3 py-2 text-gray-600">{l.corretor2_nome ?? '—'}</td>
              <td className="px-3 py-2 text-right text-gray-700">{l.corretor2_nome ? fmt(l.repasse_corretor2) : '—'}</td>
              <td className={`px-3 py-2 text-right font-semibold ${l.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(l.resultado)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg max-w-sm">
      {msg}
    </div>
  )
}
