'use client'

import { useState, useTransition } from 'react'
import { criarParceiro } from '@/app/parceiros/actions'

type Parceiro = { id: string; nome: string; pct_indicador: number | null; pct_corretor1: number | null; pct_corretor2: number | null }

type Props = {
  tenantId: string
  onCriado: (p: Parceiro) => void
}

export function QuickAddParceiro({ tenantId, onCriado }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')

  function handleAbrir() {
    setOpen(true)
    setErro('')
    setNome('')
    setCpf('')
    setEmail('')
  }

  function handleSalvar() {
    if (!nome.trim() || !cpf.trim() || !email.trim()) {
      setErro('Nome, CPF e e-mail são obrigatórios.')
      return
    }
    setErro('')
    startTransition(async () => {
      const result = await criarParceiro({
        tenant_id: tenantId,
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ''),
        email: email.trim(),
        contas: [],
      })
      if ('error' in result && result.error) {
        setErro(result.error.includes('unique') ? 'CPF já cadastrado.' : result.error)
        return
      }
      onCriado({
        id: result.id!,
        nome: nome.trim(),
        pct_indicador: null,
        pct_corretor1: null,
        pct_corretor2: null,
      })
      setOpen(false)
    })
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleAbrir}
        title="Cadastrar novo parceiro"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 hover:border-[#5B7291] hover:text-[#5B7291] transition-colors text-sm leading-none"
      >
        +
      </button>
    )
  }

  return (
    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col gap-2">
      <p className="text-xs font-medium text-blue-700">Novo parceiro</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3">
          <input
            autoFocus
            type="text"
            placeholder="Nome *"
            value={nome}
            onChange={e => setNome(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="CPF *"
            value={cpf}
            onChange={e => setCpf(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <input
            type="email"
            placeholder="E-mail *"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSalvar()}
            className={inputCls}
          />
        </div>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSalvar}
          disabled={pending}
          className="text-xs px-3 py-1 bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-60 transition-colors"
        >
          {pending ? 'Salvando...' : 'Salvar parceiro'}
        </button>
      </div>
    </div>
  )
}
