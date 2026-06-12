'use client'

import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

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

type Props = {
  linhas: Linha[]
  seguradoras: { id: string; nome: string }[]
  parceiros: { id: string; nome: string }[]
  competencias: string[]
  corretoraId: string
  filtros: { competencia: string; seguradora: string; segurado: string; parceiro: string }
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtComp = (s: string) => { const [y, m] = s.split('-'); return `${m}/${y}` }
const fmtPct = (v: number | null) => v != null ? `${v.toFixed(2)}%` : '—'

export function FechamentoClient({ linhas, seguradoras, parceiros, competencias, corretoraId, filtros }: Props) {
  const router = useRouter()

  function aplicarFiltro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const params = new URLSearchParams()
    params.set('corretora', corretoraId)
    const comp = fd.get('competencia') as string
    const seg = fd.get('seguradora') as string
    const segurado = fd.get('segurado') as string
    const parceiro = fd.get('parceiro') as string
    if (comp) params.set('competencia', comp)
    if (seg) params.set('seguradora', seg)
    if (segurado) params.set('segurado', segurado)
    if (parceiro) params.set('parceiro', parceiro)
    router.push(`/fechamento?${params.toString()}`)
  }

  function exportarExcel() {
    const dados = linhas.map(l => ({
      'Competência': fmtComp(l.competencia),
      'Seguradora': l.seguradora_nome ?? '',
      'Referência': l.referencia,
      'Segurado': l.segurado,
      'Produto': l.produto ?? '',
      'Comissão': l.comissao_recebida,
      'Alíquota %': l.aliquota_pct,
      'Imposto': l.imposto_valor,
      'Indicador': l.indicador_nome ?? '',
      '% Indicador': l.pct_indicador ?? '',
      'Rep. Indicador': l.repasse_indicador,
      'Corretor 1': l.corretor1_nome ?? '',
      '% Corretor 1': l.pct_corretor1 ?? '',
      'Rep. Corretor 1': l.repasse_corretor1,
      'Corretor 2': l.corretor2_nome ?? '',
      '% Corretor 2': l.pct_corretor2 ?? '',
      'Rep. Corretor 2': l.repasse_corretor2,
      'Resultado': l.resultado,
    }))
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produção Apurada')
    const sufixo = filtros.competencia ? `_${filtros.competencia}` : ''
    XLSX.writeFile(wb, `producao_apurada${sufixo}.xlsx`)
  }

  // Totais
  const totalComissao = linhas.reduce((s, l) => s + l.comissao_recebida, 0)
  const totalImposto = linhas.reduce((s, l) => s + l.imposto_valor, 0)
  const totalRepasses = linhas.reduce((s, l) => s + l.repasse_indicador + l.repasse_corretor1 + l.repasse_corretor2, 0)
  const totalResultado = linhas.reduce((s, l) => s + l.resultado, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <form onSubmit={aplicarFiltro} className="flex flex-wrap gap-3 items-end bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Competência</label>
          <select
            name="competencia"
            defaultValue={filtros.competencia}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-[140px]"
          >
            <option value="">Todas</option>
            {competencias.map(c => (
              <option key={c} value={c.slice(0, 7)}>{fmtComp(c)}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Seguradora</label>
          <select
            name="seguradora"
            defaultValue={filtros.seguradora}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-[160px]"
          >
            <option value="">Todas</option>
            {seguradoras.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Segurado</label>
          <input
            type="text"
            name="segurado"
            defaultValue={filtros.segurado}
            placeholder="Nome do segurado..."
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-[180px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Parceiro</label>
          <select
            name="parceiro"
            defaultValue={filtros.parceiro}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-[160px]"
          >
            <option value="">Todos</option>
            {parceiros.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080]">
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => router.push(`/fechamento?corretora=${corretoraId}`)}
            className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Limpar
          </button>
        </div>

        <div className="ml-auto">
          {linhas.length > 0 && (
            <button
              type="button"
              onClick={exportarExcel}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Exportar Excel
            </button>
          )}
        </div>
      </form>

      {/* Resumo */}
      {linhas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Comissões', valor: totalComissao, cor: 'text-gray-900' },
            { label: 'Total Impostos', valor: totalImposto, cor: 'text-red-600' },
            { label: 'Total Repasses', valor: totalRepasses, cor: 'text-amber-700' },
            { label: 'Resultado Líquido', valor: totalResultado, cor: 'text-green-700' },
          ].map(card => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-base font-semibold mt-1 ${card.cor}`}>{fmt(card.valor)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela */}
      {linhas.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Nenhum registro encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2">Comp.</th>
                <th className="text-left px-3 py-2">Seguradora</th>
                <th className="text-left px-3 py-2">Referência</th>
                <th className="text-left px-3 py-2">Segurado</th>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-right px-3 py-2">Comissão</th>
                <th className="text-right px-3 py-2">Imposto</th>
                <th className="text-left px-3 py-2">Indicador</th>
                <th className="text-right px-3 py-2">%</th>
                <th className="text-right px-3 py-2">Rep. Ind.</th>
                <th className="text-left px-3 py-2">Corretor 1</th>
                <th className="text-right px-3 py-2">%</th>
                <th className="text-right px-3 py-2">Rep. Cor1</th>
                <th className="text-left px-3 py-2">Corretor 2</th>
                <th className="text-right px-3 py-2">%</th>
                <th className="text-right px-3 py-2">Rep. Cor2</th>
                <th className="text-right px-3 py-2 font-bold text-gray-700">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((l, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-gray-500">{fmtComp(l.competencia)}</td>
                  <td className="px-3 py-2 text-gray-700">{l.seguradora_nome ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{l.referencia}</td>
                  <td className="px-3 py-2 text-gray-700">{l.segurado}</td>
                  <td className="px-3 py-2 text-gray-500">{l.produto ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{fmt(l.comissao_recebida)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{fmt(l.imposto_valor)}</td>
                  <td className="px-3 py-2 text-gray-600">{l.indicador_nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmtPct(l.pct_indicador)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{l.repasse_indicador > 0 ? fmt(l.repasse_indicador) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{l.corretor1_nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmtPct(l.pct_corretor1)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{l.repasse_corretor1 > 0 ? fmt(l.repasse_corretor1) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{l.corretor2_nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmtPct(l.pct_corretor2)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{l.repasse_corretor2 > 0 ? fmt(l.repasse_corretor2) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(l.resultado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-sm font-semibold">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-gray-600">Total ({linhas.length} registros)</td>
                <td className="px-3 py-2 text-right text-gray-900">{fmt(totalComissao)}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmt(totalImposto)}</td>
                <td colSpan={2} className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-amber-700">{fmt(linhas.reduce((s, l) => s + l.repasse_indicador, 0))}</td>
                <td colSpan={2} className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-amber-700">{fmt(linhas.reduce((s, l) => s + l.repasse_corretor1, 0))}</td>
                <td colSpan={2} className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-amber-700">{fmt(linhas.reduce((s, l) => s + l.repasse_corretor2, 0))}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmt(totalResultado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
