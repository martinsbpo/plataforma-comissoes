'use client'

import { useState, useTransition } from 'react'
import { ProducaoForm } from './producao-form'
import { ImportarPlanilha } from './importar-planilha'
import { excluirProducao } from '../actions'

type Seguradora = { id: string; nome_fantasia: string | null; nome: string }
type GrupoProduto = { id: string; nome: string }
type Produto = { id: string; nome: string; grupo_produto_id: string }
type Parceiro = { id: string; nome: string; pct_indicador: number | null; pct_corretor1: number | null; pct_corretor2: number | null }

type ProducaoRow = {
  id: string
  data: string
  seguradora_id: string
  segurado: string
  referencia: string
  cpf_segurado: string | null
  grupo_produto_id: string | null
  produto_id: string | null
  comissao: number | null
  indicador_id: string | null
  pct_indicador: number | null
  corretor1_id: string | null
  pct_corretor1: number | null
  corretor2_id: string | null
  pct_corretor2: number | null
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
  exportParams?: string
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const fmtPct = (v: number | null) => v != null ? `${v}%` : '—'

export function ProducaoTable({
  rows, seguradoras, grupos, produtos, parceiros,
  tenantId: _tenantId, podeEditar, exportParams = '',
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
    if (!confirm(`Excluir negócio de ${row.segurado} (${row.referencia})?`)) return
    startTransition(async () => {
      const r = await excluirProducao(row.id)
      if ('error' in r && r.error) showToast('Erro: ' + r.error)
      else showToast('Negócio excluído.')
    })
  }

  return (
    <>
      {/* Ações */}
      <div className="flex items-center gap-3 flex-wrap">
        {podeEditar && (
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors"
          >
            + Novo negócio
          </button>
        )}
        {podeEditar && (
          <ImportarPlanilha onImportado={showToast} />
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
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Data</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Seguradora</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Referência</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Segurado</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Produto</th>
              <th className="text-right px-3 py-2.5 text-gray-600 font-medium">Comissão esp.</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Indicador</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">%</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Corretor 1</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">%</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">Corretor 2</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">%</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => {
              const seg = row.seguradora
              const segNome = seg?.nome_fantasia ?? seg?.nome ?? '—'

              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500">{fmtDate(row.data)}</td>
                  <td className="px-3 py-2 text-gray-700">{segNome}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{row.referencia}</td>
                  <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{row.segurado}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {row.produto?.nome ?? row.grupo_produto?.nome ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {row.comissao != null ? fmt(row.comissao) : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{row.indicador?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{row.indicador_id ? fmtPct(row.pct_indicador) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.corretor1?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{row.corretor1_id ? fmtPct(row.pct_corretor1) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.corretor2?.nome ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{row.corretor2_id ? fmtPct(row.pct_corretor2) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {podeEditar && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(row)} className="text-[#5B7291] hover:underline">Editar</button>
                        <button onClick={() => handleDelete(row)} disabled={pending} className="text-red-400 hover:text-red-600 disabled:opacity-50">Excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Nenhum negócio cadastrado. Use &ldquo;Novo negócio&rdquo; para adicionar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProducaoForm
          seguradoras={seguradoras}
          grupos={grupos}
          produtos={produtos}
          parceiros={parceiros}
          tenantId={_tenantId}
          editRow={editRow}
          onClose={() => setShowForm(false)}
          onSaved={(msg) => { setShowForm(false); showToast(msg) }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </>
  )
}
