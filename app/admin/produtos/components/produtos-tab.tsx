'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarProduto, atualizarProduto, inativarProduto, ativarProduto } from '../actions'

type Grupo = { id: string; nome: string }
type Produto = {
  id: string
  nome: string
  status: string
  grupo_produto_id: string
  grupos_produto: { nome: string } | { nome: string }[] | null
}

type Props = {
  produtos: Produto[]
  grupos: Grupo[]
  filtroGrupo?: string
}

export function ProdutosTab({ produtos, grupos, filtroGrupo }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [novoGrupo, setNovoGrupo] = useState(filtroGrupo ?? '')
  const [novoNome, setNovoNome] = useState('')
  const [editando, setEditando] = useState<{ id: string; nome: string; grupo: string } | null>(null)
  const [erro, setErro] = useState('')

  const produtosFiltrados = filtroGrupo
    ? produtos.filter(p => p.grupo_produto_id === filtroGrupo)
    : produtos

  function nomeGrupo(p: Produto) {
    const g = Array.isArray(p.grupos_produto) ? p.grupos_produto[0] : p.grupos_produto
    return g?.nome ?? '—'
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoGrupo || !novoNome.trim()) return
    setErro('')
    startTransition(async () => {
      const result = await criarProduto(novoGrupo, novoNome.trim())
      if ('error' in result) setErro(result.error ?? '')
      else setNovoNome('')
    })
  }

  async function handleAtualizar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setErro('')
    startTransition(async () => {
      const result = await atualizarProduto(editando.id, editando.grupo, editando.nome.trim())
      if ('error' in result) setErro(result.error ?? '')
      else setEditando(null)
    })
  }

  async function handleInativar(id: string) {
    setErro('')
    startTransition(async () => {
      const result = await inativarProduto(id)
      if ('error' in result) setErro(result.error ?? '')
    })
  }

  async function handleAtivar(id: string) {
    startTransition(async () => { await ativarProduto(id) })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Formulário de novo produto */}
      <form onSubmit={handleCriar} className="flex gap-3 flex-wrap">
        <select
          value={novoGrupo}
          onChange={e => setNovoGrupo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
        >
          <option value="">Selecione o grupo...</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <input
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome do produto..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
        />
        <button
          type="submit"
          disabled={isPending || !novoGrupo || !novoNome.trim()}
          className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
        >
          + Adicionar produto
        </button>
      </form>

      {/* Filtro por grupo */}
      <form method="GET" className="flex gap-3">
        <input type="hidden" name="aba" value="produtos" />
        <select
          name="grupo"
          defaultValue={filtroGrupo ?? ''}
          onChange={e => router.push(`/admin/produtos?aba=produtos${e.target.value ? `&grupo=${e.target.value}` : ''}`)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
        >
          <option value="">Todos os grupos</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center">
          {produtosFiltrados.length} produto(s)
        </span>
      </form>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{erro}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Produto</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Grupo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {produtosFiltrados.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {editando?.id === p.id ? (
                    <form onSubmit={handleAtualizar} className="flex gap-2 items-center">
                      <select
                        value={editando.grupo}
                        onChange={e => setEditando({ ...editando, grupo: e.target.value })}
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                      </select>
                      <input
                        value={editando.nome}
                        onChange={e => setEditando({ ...editando, nome: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none"
                        autoFocus
                      />
                      <button type="submit" disabled={isPending} className="text-xs text-[#5B7291] hover:underline disabled:opacity-50">Salvar</button>
                      <button type="button" onClick={() => setEditando(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                    </form>
                  ) : (
                    <span className={p.status === 'inativo' ? 'text-gray-400 line-through' : 'text-gray-900 font-medium'}>
                      {p.nome}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{nomeGrupo(p)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                  {editando?.id !== p.id && (
                    <button
                      onClick={() => setEditando({ id: p.id, nome: p.nome, grupo: p.grupo_produto_id })}
                      className="text-xs text-[#5B7291] hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  {p.status === 'ativo' ? (
                    <button onClick={() => handleInativar(p.id)} disabled={isPending} className="text-xs text-red-500 hover:underline disabled:opacity-50">Inativar</button>
                  ) : (
                    <button onClick={() => handleAtivar(p.id)} disabled={isPending} className="text-xs text-green-600 hover:underline disabled:opacity-50">Ativar</button>
                  )}
                </td>
              </tr>
            ))}
            {produtosFiltrados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
