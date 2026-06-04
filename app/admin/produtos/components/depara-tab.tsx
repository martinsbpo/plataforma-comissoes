'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { DePараFormData } from '../actions'
import { criarDePara, atualizarDePara, alterarStatusDePara } from '../actions'

type Grupo = { id: string; nome: string }
type Produto = { id: string; nome: string; grupo_produto_id: string }
type Seguradora = { id: string; nome_fantasia: string }
type DePara = {
  id: string
  texto_relatorio: string
  status: string
  observacoes: string | null
  seguradora_id: string
  grupo_produto_id: string
  produto_id: string
  seguradoras: { nome_fantasia: string } | { nome_fantasia: string }[] | null
  grupos_produto: { nome: string } | { nome: string }[] | null
  produtos: { nome: string } | { nome: string }[] | null
}

type Props = {
  depara: DePara[]
  grupos: Grupo[]
  produtos: Produto[]
  seguradoras: Seguradora[]
  filtroSeguradora?: string
  q?: string
}

const EMPTY_FORM: DePараFormData = {
  seguradora_id: '',
  texto_relatorio: '',
  grupo_produto_id: '',
  produto_id: '',
  observacoes: '',
}

export function DePараTab({ depara, grupos, produtos, seguradoras, filtroSeguradora, q }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<DePараFormData>(EMPTY_FORM)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erro, setErro] = useState('')

  const produtosFiltrados = form.grupo_produto_id
    ? produtos.filter(p => p.grupo_produto_id === form.grupo_produto_id)
    : produtos

  const deparaFiltrados = depara.filter(d => {
    if (filtroSeguradora && d.seguradora_id !== filtroSeguradora) return false
    if (q) {
      const busca = q.toLowerCase()
      const texto = d.texto_relatorio.toLowerCase()
      return texto.includes(busca)
    }
    return true
  })

  function nomeSeg(d: DePara) {
    const s = Array.isArray(d.seguradoras) ? d.seguradoras[0] : d.seguradoras
    return s?.nome_fantasia ?? '—'
  }
  function nomeGrupo(d: DePara) {
    const g = Array.isArray(d.grupos_produto) ? d.grupos_produto[0] : d.grupos_produto
    return g?.nome ?? '—'
  }
  function nomeProd(d: DePara) {
    const p = Array.isArray(d.produtos) ? d.produtos[0] : d.produtos
    return p?.nome ?? '—'
  }

  function abrirEditar(d: DePara) {
    setForm({
      seguradora_id: d.seguradora_id,
      texto_relatorio: d.texto_relatorio,
      grupo_produto_id: d.grupo_produto_id,
      produto_id: d.produto_id,
      observacoes: d.observacoes ?? '',
    })
    setEditandoId(d.id)
    setMostrarForm(true)
    setErro('')
  }

  function cancelar() {
    setForm(EMPTY_FORM)
    setEditandoId(null)
    setMostrarForm(false)
    setErro('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.seguradora_id || !form.texto_relatorio || !form.grupo_produto_id || !form.produto_id) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    setErro('')
    startTransition(async () => {
      const result = editandoId
        ? await atualizarDePara(editandoId, form)
        : await criarDePara(form)

      if ('error' in result) {
        setErro(result.error ?? 'Erro desconhecido')
        return
      }
      cancelar()
    })
  }

  async function handleAlterarStatus(id: string, status: 'ativo' | 'inativo') {
    startTransition(async () => { await alterarStatusDePara(id, status) })
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'

  return (
    <div className="flex flex-col gap-5">
      {/* Barra superior */}
      <div className="flex flex-wrap gap-3 items-center">
        <form method="GET" className="flex gap-3 flex-1 flex-wrap">
          <input type="hidden" name="aba" value="depara" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar texto/código..."
            className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          />
          <select
            name="seguradora"
            defaultValue={filtroSeguradora ?? ''}
            onChange={e => router.push(`/admin/produtos?aba=depara${e.target.value ? `&seguradora=${e.target.value}` : ''}`)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
          >
            <option value="">Todas as seguradoras</option>
            {seguradoras.map(s => <option key={s.id} value={s.id}>{s.nome_fantasia}</option>)}
          </select>
          <button type="submit" className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Filtrar
          </button>
        </form>
        {!mostrarForm && (
          <button
            onClick={() => { setMostrarForm(true); setEditandoId(null); setForm(EMPTY_FORM) }}
            className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors shrink-0"
          >
            + Novo de-para
          </button>
        )}
      </div>

      {/* Formulário */}
      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-700">
            {editandoId ? 'Editar de-para' : 'Novo de-para'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Seguradora *</label>
              <select
                required
                value={form.seguradora_id}
                onChange={e => setForm(f => ({ ...f, seguradora_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Selecione...</option>
                {seguradoras.map(s => <option key={s.id} value={s.id}>{s.nome_fantasia}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Texto/Código no relatório *{' '}
                <span className="font-normal text-gray-400">(exato como aparece no arquivo)</span>
              </label>
              <input
                required
                value={form.texto_relatorio}
                onChange={e => setForm(f => ({ ...f, texto_relatorio: e.target.value }))}
                placeholder="Ex: MORTE POR ACIDENTE ou 1421"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grupo de Produto *</label>
              <select
                required
                value={form.grupo_produto_id}
                onChange={e => setForm(f => ({ ...f, grupo_produto_id: e.target.value, produto_id: '' }))}
                className={inputCls}
              >
                <option value="">Selecione...</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Produto *</label>
              <select
                required
                value={form.produto_id}
                onChange={e => setForm(f => ({ ...f, produto_id: e.target.value }))}
                disabled={!form.grupo_produto_id}
                className={inputCls}
              >
                <option value="">Selecione...</option>
                {produtosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
              <input
                value={form.observacoes ?? ''}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Opcional..."
                className={inputCls}
              />
            </div>
          </div>
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar de-para'}
            </button>
            <button type="button" onClick={cancelar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Seguradora</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Texto no relatório</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Grupo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Produto</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deparaFiltrados.map(d => (
              <tr key={d.id} className={`hover:bg-gray-50 ${d.status === 'inativo' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-gray-600">{nomeSeg(d)}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-800 max-w-[200px] truncate" title={d.texto_relatorio}>
                  {d.texto_relatorio}
                </td>
                <td className="px-4 py-3 text-gray-600">{nomeGrupo(d)}</td>
                <td className="px-4 py-3 text-gray-600">{nomeProd(d)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    d.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {d.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                  <button onClick={() => abrirEditar(d)} className="text-xs text-[#5B7291] hover:underline">Editar</button>
                  {d.status === 'ativo' ? (
                    <button onClick={() => handleAlterarStatus(d.id, 'inativo')} disabled={isPending} className="text-xs text-red-500 hover:underline disabled:opacity-50">Inativar</button>
                  ) : (
                    <button onClick={() => handleAlterarStatus(d.id, 'ativo')} disabled={isPending} className="text-xs text-green-600 hover:underline disabled:opacity-50">Ativar</button>
                  )}
                </td>
              </tr>
            ))}
            {deparaFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Nenhum de-para encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
