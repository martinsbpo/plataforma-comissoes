'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmarImportacao, excluirImportacao, resolverLinhaPendente } from '../../actions'

type GrupoProduto = { id: string; nome: string }
type Produto = { id: string; nome: string; grupo_produto_id: string }

type Linha = {
  id: string
  referencia: string
  nome_segurado: string
  cpf_segurado: string | null
  tipo_valor: string
  valor: number
  status_linha: string
  texto_produto_raw: string | null
  grupo_produto_id: string | null
  produto_id: string | null
  grupo_produto?: { nome: string } | null
  produto?: { nome: string } | null
}

type Props = {
  importacao: {
    id: string
    status: string
    total_linhas: number
    total_ok: number
    total_pendentes: number
    valor_total: number
    nome_arquivo: string
    competencia: string
    dia_pagamento: number | null
    confirmado_em: string | null
  }
  linhas: Linha[]
  grupos: GrupoProduto[]
  produtos: Produto[]
  canEdit: boolean
}

const TIPO_LABEL: Record<string, string> = {
  angariacao: 'Angariação',
  vitalicio:  'Vitalício',
  comissao:   'Comissão',
  estorno:    'Estorno',
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ResolverModal({
  linha,
  grupos,
  produtos,
  onSalvar,
  onFechar,
}: {
  linha: Linha
  grupos: GrupoProduto[]
  produtos: Produto[]
  onSalvar: (grupoId: string, produtoId: string, obs: string) => void
  onFechar: () => void
}) {
  const [grupoId, setGrupoId] = useState(linha.grupo_produto_id ?? '')
  const [produtoId, setProdutoId] = useState(linha.produto_id ?? '')
  const [obs, setObs] = useState('')

  const prodsFiltrados = grupoId
    ? produtos.filter((p) => p.grupo_produto_id === grupoId)
    : produtos

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">Resolver pendência</h3>
          <p className="text-sm text-gray-500 mt-1">
            Apólice <strong>{linha.referencia}</strong> — {linha.nome_segurado}
          </p>
          {linha.texto_produto_raw && (
            <p className="text-xs text-amber-600 mt-1">
              Produto no arquivo: <strong>{linha.texto_produto_raw}</strong>
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Grupo de produto *</label>
          <select
            value={grupoId}
            onChange={(e) => { setGrupoId(e.target.value); setProdutoId('') }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Selecione...</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Produto *</label>
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            disabled={!grupoId}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Selecione...</option>
            {prodsFiltrados.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observação (opcional)</label>
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="ex: produto identificado manualmente"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!grupoId || !produtoId}
            onClick={() => onSalvar(grupoId, produtoId, obs)}
            className="px-6 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export function DetalheImportacao({ importacao, linhas: linhasInit, grupos, produtos, canEdit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [linhas, setLinhas] = useState(linhasInit)
  const [linhaSelecionada, setLinhaSelecionada] = useState<Linha | null>(null)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'ok'>('todos')

  const linhasFiltradas = linhas.filter((l) => {
    if (filtroStatus === 'pendente') return l.status_linha !== 'ok'
    if (filtroStatus === 'ok') return l.status_linha === 'ok'
    return true
  })

  const totalPendentes = linhas.filter((l) => l.status_linha !== 'ok').length

  function handleResolver(linha: Linha) {
    setLinhaSelecionada(linha)
  }

  function handleSalvarResolucao(grupoId: string, produtoId: string, obs: string) {
    if (!linhaSelecionada) return
    startTransition(async () => {
      const result = await resolverLinhaPendente(linhaSelecionada.id, grupoId, produtoId, obs)
      if (result.error) { setErro(result.error); return }

      const grupoNome = grupos.find((g) => g.id === grupoId)?.nome ?? ''
      const produtoNome = produtos.find((p) => p.id === produtoId)?.nome ?? ''

      setLinhas((prev) =>
        prev.map((l) =>
          l.id === linhaSelecionada.id
            ? {
                ...l,
                grupo_produto_id: grupoId,
                produto_id: produtoId,
                status_linha: 'ok',
                grupo_produto: { nome: grupoNome },
                produto: { nome: produtoNome },
              }
            : l
        )
      )
      setLinhaSelecionada(null)
    })
  }

  function handleConfirmar() {
    startTransition(async () => {
      const result = await confirmarImportacao(importacao.id)
      if (result.error) { setErro(result.error); return }
      router.refresh()
    })
  }

  function handleExcluir() {
    if (!confirm('Excluir esta importação? Esta ação não pode ser desfeita.')) return
    startTransition(async () => {
      const result = await excluirImportacao(importacao.id)
      if (result.error) { setErro(result.error); return }
      router.push('/seguradoras?aba=historico')
    })
  }

  const isPendente = importacao.status === 'pendente'
  const isConfirmada = importacao.status === 'confirmada'

  return (
    <>
      {linhaSelecionada && (
        <ResolverModal
          linha={linhaSelecionada}
          grupos={grupos}
          produtos={produtos}
          onSalvar={handleSalvarResolucao}
          onFechar={() => setLinhaSelecionada(null)}
        />
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Linhas', value: importacao.total_linhas, cls: 'text-gray-900' },
          { label: 'OK', value: importacao.total_ok - (totalPendentes > 0 ? 0 : 0), cls: 'text-green-600' },
          { label: 'Pendentes', value: totalPendentes, cls: totalPendentes > 0 ? 'text-amber-600' : 'text-gray-300' },
          {
            label: 'Valor total',
            value: formatCurrency(importacao.valor_total),
            cls: 'text-[#5B7291]',
          },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${c.cls}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {totalPendentes > 0 && isPendente && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {totalPendentes} linha{totalPendentes !== 1 ? 's' : ''} com produto não identificado
            </p>
            <p className="text-sm text-amber-600">
              Resolva as pendências antes de confirmar a importação.
            </p>
          </div>
        </div>
      )}

      {isConfirmada && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">✅</span>
          <p className="text-sm text-green-700 font-medium">
            Importação confirmada
            {importacao.confirmado_em && (
              <span className="font-normal text-green-600">
                {' '}em {new Date(importacao.confirmado_em).toLocaleDateString('pt-BR')}
              </span>
            )}
          </p>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {erro}
        </div>
      )}

      {/* Filtro de linhas */}
      <div className="flex gap-2">
        {(['todos', 'pendente', 'ok'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroStatus(f)}
            className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
              filtroStatus === f
                ? 'bg-[#5B7291] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendentes' : 'OK'}
          </button>
        ))}
      </div>

      {/* Tabela de linhas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Apólice</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Segurado</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Produto</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              {canEdit && isPendente && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhasFiltradas.map((l) => (
              <tr key={l.id} className={`hover:bg-gray-50 ${l.status_linha !== 'ok' ? 'bg-amber-50/30' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{l.referencia}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-900">{l.nome_segurado}</p>
                  {l.cpf_segurado && <p className="text-xs text-gray-400">{l.cpf_segurado}</p>}
                </td>
                <td className="px-4 py-3">
                  {l.status_linha === 'ok' ? (
                    <div>
                      <p className="text-gray-700">{l.produto?.nome ?? '—'}</p>
                      <p className="text-xs text-gray-400">{l.grupo_produto?.nome}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-amber-600 text-xs">Não identificado</p>
                      {l.texto_produto_raw && (
                        <p className="text-xs text-gray-400 font-mono">"{l.texto_produto_raw}"</p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {TIPO_LABEL[l.tipo_valor] ?? l.tipo_valor}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${l.tipo_valor === 'estorno' ? 'text-red-600' : 'text-gray-900'}`}>
                  {l.tipo_valor === 'estorno' ? '-' : ''}{formatCurrency(Math.abs(l.valor))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.status_linha === 'ok'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {l.status_linha === 'ok' ? 'OK' : 'Pendente'}
                  </span>
                </td>
                {canEdit && isPendente && (
                  <td className="px-4 py-3 text-right">
                    {l.status_linha !== 'ok' && (
                      <button
                        onClick={() => handleResolver(l)}
                        className="text-xs text-[#5B7291] hover:underline"
                      >
                        Resolver
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhuma linha encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ações */}
      {canEdit && isPendente && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleExcluir}
            disabled={pending}
            className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Excluir importação
          </button>
          <button
            onClick={handleConfirmar}
            disabled={pending || totalPendentes > 0}
            className="px-6 py-2.5 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
          >
            {totalPendentes > 0
              ? `Confirmar (${totalPendentes} pendente${totalPendentes !== 1 ? 's' : ''})`
              : 'Confirmar importação'}
          </button>
        </div>
      )}
    </>
  )
}
