'use client'

import { useState, useTransition } from 'react'
import { ProducaoForm } from './producao-form'
import { ImportarPlanilha } from './importar-planilha'
import { excluirProducao, revincularpProducao } from '../actions'

type Seguradora = { id: string; nome_fantasia: string | null; nome: string }
type GrupoProduto = { id: string; nome: string }
type Produto = { id: string; nome: string; grupo_produto_id: string }
type Parceiro = { id: string; nome: string; pct_indicador: number | null; pct_corretor1: number | null; pct_corretor2: number | null }

type ProducaoRow = {
  id: string
  competencia: string
  data: string
  seguradora_id: string
  segurado: string
  referencia: string
  cpf_segurado: string | null
  grupo_produto_id: string | null
  produto_id: string | null
  comissao: number
  indicador_id: string | null
  pct_indicador: number | null
  corretor1_id: string | null
  pct_corretor1: number | null
  corretor2_id: string | null
  pct_corretor2: number | null
  impostos_pct: number
  repasse_indicador: number
  repasse_corretor1: number
  repasse_corretor2: number
  resultado: number
  status_vinculacao: string
  status_periodo: string
  observacoes: string | null
  seguradora: { nome_fantasia: string | null; nome: string } | null
  indicador: { nome: string } | null
  corretor1: { nome: string } | null
  corretor2: { nome: string } | null
  grupo_produto: { nome: string } | null
  produto: { nome: string } | null
}

type Props = {
  rows: ProducaoRow[]
  seguradoras: Seguradora[]
  grupos: GrupoProduto[]
  produtos: Produto[]
  parceiros: Parceiro[]
  tenantId: string
  podeEditar: boolean
  defaultCompetencia?: string
  exportParams?: string
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const fmtMes = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

const VINC_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
  pendente:   { label: 'Pendente',   cls: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  vinculado:  { label: 'Vinculado',  cls: 'bg-green-100 text-green-700',   icon: '✅' },
  divergente: { label: 'Divergente', cls: 'bg-amber-100 text-amber-700',   icon: '⚠️' },
}

export function ProducaoTable({
  rows, seguradoras, grupos, produtos, parceiros,
  tenantId, podeEditar, defaultCompetencia, exportParams = '',
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState<ProducaoRow | undefined>()
  const [toast, setToast] = useState('')
  const [pending, startTransition] = useTransition()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  function handleEdit(row: ProducaoRow) {
    setEditRow(row)
    setShowForm(true)
  }

  function handleNew() {
    setEditRow(undefined)
    setShowForm(true)
  }

  function handleDelete(row: ProducaoRow) {
    if (row.status_periodo === 'fechado') return
    if (!confirm(`Excluir lançamento de ${row.segurado} (${row.referencia})?`)) return
    startTransition(async () => {
      const r = await excluirProducao(row.id)
      if ('error' in r && r.error) showToast('Erro: ' + r.error)
      else showToast('Lançamento excluído.')
    })
  }

  function handleRevincular() {
    startTransition(async () => {
      const r = await revincularpProducao(tenantId)
      if ('error' in r && r.error) showToast('Erro: ' + r.error)
      else showToast(`Vinculação concluída: ${r.vinculados} vinculado(s), ${r.pendentes} pendente(s).`)
    })
  }

  return (
    <>
      {/* Header actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {podeEditar && (
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors"
          >
            + Nova linha
          </button>
        )}
        <button
          onClick={handleRevincular}
          disabled={pending}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          Revincular
        </button>
        {podeEditar && (
          <ImportarPlanilha
            defaultCompetencia={defaultCompetencia}
            onImportado={showToast}
          />
        )}
        <a
          href={`/api/producao/exportar${exportParams ? '?' + exportParams : ''}`}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Exportar Excel
        </a>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Ref.</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Compet.</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Data</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Seguradora</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Segurado</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Produto</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Comissão</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Indicador</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Rep. Ind.</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Corretor 1</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Rep. Cor1</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Corretor 2</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Rep. Cor2</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Impostos</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Resultado</th>
              <th className="text-center px-3 py-2.5 text-gray-600 font-medium">Vínculo</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => {
              const seg = row.seguradora
              const segNome = seg?.nome_fantasia ?? seg?.nome ?? '—'
              const vinc = VINC_BADGE[row.status_vinculacao] ?? VINC_BADGE.pendente
              const fechado = row.status_periodo === 'fechado'
              const impostosValor = row.comissao * (row.impostos_pct / 100)

              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-700">{row.referencia}</td>
                  <td className="px-3 py-2 text-gray-500">{fmtMes(row.competencia)}</td>
                  <td className="px-3 py-2 text-gray-500">{fmtDate(row.data)}</td>
                  <td className="px-3 py-2 text-gray-700">{segNome}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{row.segurado}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {row.produto ? row.produto.nome : row.grupo_produto ? row.grupo_produto.nome : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(row.comissao)}</td>
                  <td className="px-3 py-2 text-gray-600">{row.indicador?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{row.indicador_id ? fmt(row.repasse_indicador) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.corretor1?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{row.corretor1_id ? fmt(row.repasse_corretor1) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.corretor2?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{row.corretor2_id ? fmt(row.repasse_corretor2) : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmt(impostosValor)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${row.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(row.resultado)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${vinc.cls}`}>
                      {vinc.icon} {vinc.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {podeEditar && (
                      <div className="flex items-center justify-end gap-2">
                        {fechado ? (
                          <span className="text-xs text-gray-400" title="Período fechado">🔒</span>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(row)} className="text-[#5B7291] hover:underline text-xs">Editar</button>
                            <button onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-600 text-xs">Excluir</button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={17} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Nenhum lançamento encontrado. Use &ldquo;Nova linha&rdquo; para adicionar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal form */}
      {showForm && (
        <ProducaoForm
          seguradoras={seguradoras}
          grupos={grupos}
          produtos={produtos}
          parceiros={parceiros}
          editRow={editRow}
          defaultCompetencia={defaultCompetencia}
          onClose={() => setShowForm(false)}
          onSaved={(msg) => {
            setShowForm(false)
            showToast(msg)
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </>
  )
}
