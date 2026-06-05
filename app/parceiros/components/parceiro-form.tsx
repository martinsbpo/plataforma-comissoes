'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ParceiroFormData, ContaBancaria } from '../actions'
import { criarParceiro, atualizarParceiro, alterarStatusParceiro } from '../actions'

type Props = {
  id?: string
  tenantId: string
  corretoras?: { id: string; nome: string; nome_fantasia: string | null }[]
  initial?: Partial<ParceiroFormData> & { status?: string }
  contasIniciais?: ContaBancaria[]
}

function validarCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
  const calc = (s: string, len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(s[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 || r === 11 ? 0 : r
  }
  return calc(n, 9) === parseInt(n[9]) && calc(n, 10) === parseInt(n[10])
}

function formatCPF(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  return n
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatTelefone(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export function ParceiroForm({ id, tenantId, corretoras, initial, contasIniciais }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId)

  const [nome, setNome] = useState(initial?.nome ?? '')
  const [cpf, setCpf] = useState(initial?.cpf ?? '')
  const [cpfErro, setCpfErro] = useState('')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [telefone, setTelefone] = useState(initial?.telefone ?? '')
  const [susep, setSusep] = useState(initial?.codigo_susep ?? '')
  const [pctInd, setPctInd] = useState(initial?.pct_indicador?.toString() ?? '')
  const [pctC1, setPctC1] = useState(initial?.pct_corretor1?.toString() ?? '')
  const [pctC2, setPctC2] = useState(initial?.pct_corretor2?.toString() ?? '')
  const [obs, setObs] = useState(initial?.observacoes ?? '')
  const [contas, setContas] = useState<ContaBancaria[]>(
    contasIniciais?.length ? contasIniciais : [{ banco: '', agencia: '', conta: '', tipo_conta: 'corrente' }]
  )
  const [erro, setErro] = useState('')
  const [statusAcao, setStatusAcao] = useState('')

  function addConta() {
    setContas(prev => [...prev, { banco: '', agencia: '', conta: '', tipo_conta: 'corrente' }])
  }

  function removeConta(i: number) {
    setContas(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateConta(i: number, field: keyof ContaBancaria, value: string) {
    setContas(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!validarCPF(cpf)) {
      setCpfErro('CPF inválido')
      return
    }
    setCpfErro('')

    if (contas.some(c => !c.banco || !c.agencia || !c.conta)) {
      setErro('Preencha todos os campos obrigatórios das contas bancárias.')
      return
    }

    startTransition(async () => {
      const payload: ParceiroFormData = {
        tenant_id: selectedTenantId,
        nome,
        cpf,
        email,
        telefone: telefone || undefined,
        codigo_susep: susep || undefined,
        pct_indicador: pctInd ? parseFloat(pctInd) : null,
        pct_corretor1: pctC1 ? parseFloat(pctC1) : null,
        pct_corretor2: pctC2 ? parseFloat(pctC2) : null,
        observacoes: obs || undefined,
        contas,
      }

      const result = id
        ? await atualizarParceiro(id, payload)
        : await criarParceiro(payload)

      if ('error' in result) {
        setErro(result.error ?? 'Erro desconhecido')
        return
      }

      router.push('/parceiros')
    })
  }

  async function handleAlterarStatus(novoStatus: 'ativo' | 'inativo') {
    setStatusAcao(novoStatus)
    const result = await alterarStatusParceiro(id!, novoStatus)
    if (result.error) setErro(result.error)
    else router.push('/parceiros')
    setStatusAcao('')
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-3xl">

      {/* Seletor de corretora (apenas BPO Admin) */}
      {corretoras && corretoras.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Corretora</h2>
          <div>
            <label className={labelCls}>Corretora *</label>
            <select
              required
              value={selectedTenantId}
              onChange={e => setSelectedTenantId(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione a corretora...</option>
              {corretoras.map(c => (
                <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
              ))}
            </select>
          </div>
        </section>
      )}

      {/* Dados pessoais */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Dados Pessoais</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Nome Completo *</label>
            <input required value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CPF *</label>
            <input
              required
              value={cpf}
              onChange={e => { setCpf(formatCPF(e.target.value)); setCpfErro('') }}
              placeholder="000.000.000-00"
              className={`${inputCls} ${cpfErro ? 'border-red-400' : ''}`}
            />
            {cpfErro && <p className="text-xs text-red-500 mt-1">{cpfErro}</p>}
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input
              value={telefone}
              onChange={e => setTelefone(formatTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>E-mail *</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Código SUSEP <span className="font-normal text-gray-400">(opcional)</span></label>
            <input value={susep} onChange={e => setSusep(e.target.value)} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Percentuais sugeridos */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Percentuais Sugeridos</h2>
          <p className="text-xs text-gray-400 mt-1">
            Opcionais — aparecem pré-preenchidos no lançamento de produção, mas podem ser alterados por negócio.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Indicador', value: pctInd, set: setPctInd },
            { label: 'Corretor 1', value: pctC1, set: setPctC1 },
            { label: 'Corretor 2', value: pctC2, set: setPctC2 },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className={labelCls}>% como {label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
                <span className="text-sm text-gray-500 shrink-0">%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dados bancários */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Dados Bancários</h2>
          <button type="button" onClick={addConta} className="text-xs text-[#5B7291] hover:underline">
            + Adicionar conta
          </button>
        </div>
        {contas.map((conta, i) => (
          <div key={i} className="grid grid-cols-3 gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
            <div>
              <label className={labelCls}>Banco *</label>
              <input required value={conta.banco} onChange={e => updateConta(i, 'banco', e.target.value)} placeholder="Ex: Itaú" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Agência *</label>
              <input required value={conta.agencia} onChange={e => updateConta(i, 'agencia', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Conta Corrente *</label>
              <input required value={conta.conta} onChange={e => updateConta(i, 'conta', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={conta.tipo_conta} onChange={e => updateConta(i, 'tipo_conta', e.target.value)} className={inputCls}>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Chave PIX</label>
              <input value={conta.chave_pix ?? ''} onChange={e => updateConta(i, 'chave_pix', e.target.value)} placeholder="CPF, e-mail, telefone..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apelido</label>
              <div className="flex gap-2">
                <input value={conta.apelido ?? ''} onChange={e => updateConta(i, 'apelido', e.target.value)} placeholder="Ex: Conta principal" className={inputCls} />
                {contas.length > 1 && (
                  <button type="button" onClick={() => removeConta(i)} className="px-2 text-red-400 hover:text-red-600 text-lg shrink-0" title="Remover">×</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Observações */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Observações</h2>
        <textarea
          value={obs}
          onChange={e => setObs(e.target.value)}
          rows={3}
          className={inputCls}
          placeholder="Ex: prefere PIX, conta conjunta..."
        />
      </section>

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{erro}</p>}

      {/* Ações */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : id ? 'Salvar alterações' : 'Cadastrar parceiro'}
        </button>
        <button type="button" onClick={() => router.push('/parceiros')} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
          Cancelar
        </button>

        {id && initial?.status && (
          <div className="ml-auto">
            {initial.status === 'ativo' ? (
              <button
                type="button"
                onClick={() => handleAlterarStatus('inativo')}
                disabled={!!statusAcao}
                className="px-4 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {statusAcao === 'inativo' ? 'Desativando...' : 'Inativar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAlterarStatus('ativo')}
                disabled={!!statusAcao}
                className="px-4 py-2 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {statusAcao === 'ativo' ? 'Ativando...' : 'Ativar'}
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
