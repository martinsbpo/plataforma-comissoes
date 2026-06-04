'use client'

import { useState, useTransition } from 'react'
import { criarGrupo, atualizarGrupo, inativarGrupo, ativarGrupo } from '../actions'

type Grupo = { id: string; nome: string; status: string }

export function GruposTab({ grupos }: { grupos: Grupo[] }) {
  const [isPending, startTransition] = useTransition()
  const [novoNome, setNovoNome] = useState('')
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null)
  const [erro, setErro] = useState('')

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    setErro('')
    startTransition(async () => {
      const result = await criarGrupo(novoNome.trim())
      if ('error' in result) setErro(result.error ?? '')
      else setNovoNome('')
    })
  }

  async function handleAtualizar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setErro('')
    startTransition(async () => {
      const result = await atualizarGrupo(editando.id, editando.nome.trim())
      if ('error' in result) setErro(result.error ?? '')
      else setEditando(null)
    })
  }

  async function handleInativar(id: string) {
    setErro('')
    startTransition(async () => {
      const result = await inativarGrupo(id)
      if ('error' in result) setErro(result.error ?? '')
    })
  }

  async function handleAtivar(id: string) {
    startTransition(async () => {
      await ativarGrupo(id)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Formulário de novo grupo */}
      <form onSubmit={handleCriar} className="flex gap-3">
        <input
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome do novo grupo..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
        />
        <button
          type="submit"
          disabled={isPending || !novoNome.trim()}
          className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
        >
          + Adicionar grupo
        </button>
      </form>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{erro}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Grupo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {grupos.map(g => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {editando?.id === g.id ? (
                    <form onSubmit={handleAtualizar} className="flex gap-2">
                      <input
                        value={editando.nome}
                        onChange={e => setEditando({ ...editando, nome: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
                        autoFocus
                      />
                      <button type="submit" disabled={isPending} className="text-xs text-[#5B7291] hover:underline disabled:opacity-50">Salvar</button>
                      <button type="button" onClick={() => setEditando(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                    </form>
                  ) : (
                    <span className={g.status === 'inativo' ? 'text-gray-400 line-through' : 'text-gray-900 font-medium'}>
                      {g.nome}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    g.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {g.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                  {editando?.id !== g.id && (
                    <button
                      onClick={() => setEditando({ id: g.id, nome: g.nome })}
                      className="text-xs text-[#5B7291] hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  {g.status === 'ativo' ? (
                    <button
                      onClick={() => handleInativar(g.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      Inativar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAtivar(g.id)}
                      disabled={isPending}
                      className="text-xs text-green-600 hover:underline disabled:opacity-50"
                    >
                      Ativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {grupos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhum grupo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
