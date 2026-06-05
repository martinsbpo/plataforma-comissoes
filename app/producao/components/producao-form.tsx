'use client'

import { useState, useEffect, useTransition } from 'react'
import { criarProducao, atualizarProducao, ProducaoFormData } from '../actions'

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
  observacoes: string | null
  status_periodo: string
}

type Props = {
  seguradoras: Seguradora[]
  grupos: GrupoProduto[]
  produtos: Produto[]
  parceiros: Parceiro[]
  editRow?: ProducaoRow
  defaultCompetencia?: string
  onClose: () => void
  onSaved: (msg: string) => void
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ProducaoForm({
  seguradoras, grupos, produtos, parceiros,
  editRow, defaultCompetencia, onClose, onSaved,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)

  const [competencia, setCompetencia] = useState(editRow ? editRow.competencia.slice(0, 7) : (defaultCompetencia ?? currentMonth))
  const [data, setData] = useState(editRow?.data ?? today)
  const [seguradoraId, setSeguradoraId] = useState(editRow?.seguradora_id ?? '')
  const [segurado, setSegurado] = useState(editRow?.segurado ?? '')
  const [referencia, setReferencia] = useState(editRow?.referencia ?? '')
  const [cpf, setCpf] = useState(editRow?.cpf_segurado ?? '')
  const [grupoId, setGrupoId] = useState(editRow?.grupo_produto_id ?? '')
  const [produtoId, setProdutoId] = useState(editRow?.produto_id ?? '')
  const [comissao, setComissao] = useState(editRow ? String(editRow.comissao) : '')
  const [indicadorId, setIndicadorId] = useState(editRow?.indicador_id ?? '')
  const [pctIndicador, setPctIndicador] = useState(editRow?.pct_indicador != null ? String(editRow.pct_indicador) : '')
  const [corretor1Id, setCorretor1Id] = useState(editRow?.corretor1_id ?? '')
  const [pctCorretor1, setPctCorretor1] = useState(editRow?.pct_corretor1 != null ? String(editRow.pct_corretor1) : '')
  const [corretor2Id, setCorretor2Id] = useState(editRow?.corretor2_id ?? '')
  const [pctCorretor2, setPctCorretor2] = useState(editRow?.pct_corretor2 != null ? String(editRow.pct_corretor2) : '')
  const [impostosPct, setImpostosPct] = useState(editRow ? String(editRow.impostos_pct) : '')
  const [obs, setObs] = useState(editRow?.observacoes ?? '')

  // Auto-fill % when selecting parceiro
  function handleSelectIndicador(id: string) {
    setIndicadorId(id)
    if (id) {
      const p = parceiros.find(x => x.id === id)
      if (p?.pct_indicador != null) setPctIndicador(String(p.pct_indicador))
    }
  }
  function handleSelectCorretor1(id: string) {
    setCorretor1Id(id)
    if (id) {
      const p = parceiros.find(x => x.id === id)
      if (p?.pct_corretor1 != null) setPctCorretor1(String(p.pct_corretor1))
    }
  }
  function handleSelectCorretor2(id: string) {
    setCorretor2Id(id)
    if (id) {
      const p = parceiros.find(x => x.id === id)
      if (p?.pct_corretor2 != null) setPctCorretor2(String(p.pct_corretor2))
    }
  }
  function handleSelectGrupo(id: string) {
    setGrupoId(id)
    setProdutoId('')
  }

  // Calculated values
  const comissaoNum = parseFloat(comissao) || 0
  const impostosNum = parseFloat(impostosPct) || 0
  const pctIndNum = parseFloat(pctIndicador) || 0
  const pctCor1Num = parseFloat(pctCorretor1) || 0
  const pctCor2Num = parseFloat(pctCorretor2) || 0

  const impostosValor = comissaoNum * (impostosNum / 100)
  const baseRepasse = comissaoNum * (1 - impostosNum / 100)
  const repasseInd = indicadorId ? baseRepasse * (pctIndNum / 100) : 0
  const repasseCor1 = corretor1Id ? baseRepasse * (pctCor1Num / 100) : 0
  const repasseCor2 = corretor2Id ? baseRepasse * (pctCor2Num / 100) : 0
  const resultado = comissaoNum - impostosValor - repasseInd - repasseCor1 - repasseCor2

  const produtosFiltrados = grupoId ? produtos.filter(p => p.grupo_produto_id === grupoId) : produtos

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!seguradoraId || !segurado || !referencia || !comissao || !competencia || !data) {
      setError('Preencha os campos obrigatórios: competência, data, seguradora, segurado, referência e comissão.')
      return
    }

    const payload: ProducaoFormData = {
      competencia,
      data,
      seguradora_id: seguradoraId,
      segurado,
      referencia,
      cpf_segurado: cpf || undefined,
      grupo_produto_id: grupoId || undefined,
      produto_id: produtoId || undefined,
      comissao: comissaoNum,
      indicador_id: indicadorId || undefined,
      pct_indicador: indicadorId && pctIndNum ? pctIndNum : undefined,
      corretor1_id: corretor1Id || undefined,
      pct_corretor1: corretor1Id && pctCor1Num ? pctCor1Num : undefined,
      corretor2_id: corretor2Id || undefined,
      pct_corretor2: corretor2Id && pctCor2Num ? pctCor2Num : undefined,
      impostos_pct: impostosNum,
      observacoes: obs || undefined,
    }

    startTransition(async () => {
      let result
      if (editRow) {
        result = await atualizarProducao(editRow.id, payload)
      } else {
        result = await criarProducao(payload)
      }

      if ('error' in result && result.error) {
        setError(result.error)
        return
      }

      let msg = editRow ? 'Linha atualizada com sucesso.' : 'Linha adicionada com sucesso.'
      if (!editRow && 'duplicata' in result && result.duplicata) {
        msg += ' ⚠️ Referência duplicada neste período.'
      }
      onSaved(msg)
    })
  }

  const inputCls = 'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {editRow ? 'Editar lançamento' : 'Novo lançamento de produção'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {/* Competência */}
            <div>
              <label className={labelCls}>Competência *</label>
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className={inputCls} required />
            </div>

            {/* Data */}
            <div>
              <label className={labelCls}>Data do negócio *</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} required />
            </div>

            {/* Seguradora */}
            <div>
              <label className={labelCls}>Seguradora *</label>
              <select value={seguradoraId} onChange={e => setSeguradoraId(e.target.value)} className={inputCls} required>
                <option value="">Selecione...</option>
                {seguradoras.map(s => (
                  <option key={s.id} value={s.id}>{s.nome_fantasia ?? s.nome}</option>
                ))}
              </select>
            </div>

            {/* Segurado */}
            <div className="col-span-2">
              <label className={labelCls}>Segurado *</label>
              <input type="text" value={segurado} onChange={e => setSegurado(e.target.value)} className={inputCls} placeholder="Nome do segurado" required />
            </div>

            {/* Referência */}
            <div>
              <label className={labelCls}>Ref. Seguradora *</label>
              <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} className={inputCls} placeholder="Nº da apólice" required />
            </div>

            {/* CPF */}
            <div>
              <label className={labelCls}>CPF do segurado</label>
              <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className={inputCls} placeholder="000.000.000-00" />
            </div>

            {/* Grupo */}
            <div>
              <label className={labelCls}>Grupo de produto</label>
              <select value={grupoId} onChange={e => handleSelectGrupo(e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>

            {/* Produto */}
            <div>
              <label className={labelCls}>Produto</label>
              <select value={produtoId} onChange={e => setProdutoId(e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {produtosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            {/* Comissão */}
            <div>
              <label className={labelCls}>Comissão (R$) *</label>
              <input type="number" step="0.01" min="0" value={comissao} onChange={e => setComissao(e.target.value)} className={inputCls} placeholder="0,00" required />
            </div>

            {/* Impostos % */}
            <div>
              <label className={labelCls}>Impostos (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={impostosPct} onChange={e => setImpostosPct(e.target.value)} className={inputCls} placeholder="0,00" />
            </div>
          </div>

          {/* Parceiros */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Parceiros (opcional)</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Indicador</label>
                <select value={indicadorId} onChange={e => handleSelectIndicador(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>% Indicador</label>
                <input type="number" step="0.01" min="0" max="100" value={pctIndicador} onChange={e => setPctIndicador(e.target.value)} className={inputCls} placeholder="0,00" disabled={!indicadorId} />
              </div>
              <div className="flex items-end pb-1">
                <span className="text-sm text-gray-500">{indicadorId ? fmt(repasseInd) : '—'}</span>
              </div>

              <div>
                <label className={labelCls}>Corretor 1</label>
                <select value={corretor1Id} onChange={e => handleSelectCorretor1(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>% Corretor 1</label>
                <input type="number" step="0.01" min="0" max="100" value={pctCorretor1} onChange={e => setPctCorretor1(e.target.value)} className={inputCls} placeholder="0,00" disabled={!corretor1Id} />
              </div>
              <div className="flex items-end pb-1">
                <span className="text-sm text-gray-500">{corretor1Id ? fmt(repasseCor1) : '—'}</span>
              </div>

              <div>
                <label className={labelCls}>Corretor 2</label>
                <select value={corretor2Id} onChange={e => handleSelectCorretor2(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>% Corretor 2</label>
                <input type="number" step="0.01" min="0" max="100" value={pctCorretor2} onChange={e => setPctCorretor2(e.target.value)} className={inputCls} placeholder="0,00" disabled={!corretor2Id} />
              </div>
              <div className="flex items-end pb-1">
                <span className="text-sm text-gray-500">{corretor2Id ? fmt(repasseCor2) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Preview de cálculo */}
          {comissaoNum > 0 && (
            <div className="mt-4 bg-gray-50 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Impostos</span>
                <p className="font-medium">{fmt(impostosValor)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Repasse indicador</span>
                <p className="font-medium">{fmt(repasseInd)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Repasse corretor 1</span>
                <p className="font-medium">{fmt(repasseCor1)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Repasse corretor 2</span>
                <p className="font-medium">{fmt(repasseCor2)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Resultado</span>
                <p className={`font-semibold ${resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(resultado)}</p>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="mt-4">
            <label className={labelCls}>Observações</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={inputCls} placeholder="Opcional..." />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={pending}
            className="px-5 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-60 transition-colors"
          >
            {pending ? 'Salvando...' : editRow ? 'Salvar alterações' : 'Adicionar linha'}
          </button>
        </div>
      </div>
    </div>
  )
}
