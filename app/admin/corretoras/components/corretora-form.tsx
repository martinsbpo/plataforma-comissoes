'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CorretoraFormData, ContaBancaria } from '../actions'
import { criarCorretora, atualizarCorretora, alterarStatusCorretora, uploadLogo } from '../actions'

type Props = {
  id?: string
  initial?: Partial<CorretoraFormData> & { status?: string }
  contasIniciais?: ContaBancaria[]
  isBpoAdmin: boolean
}

const REGIME_OPTIONS = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido',  label: 'Lucro Presumido' },
  { value: 'lucro_real',       label: 'Lucro Real' },
]

function validarCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false
  const calc = (s: string, w: number[]) =>
    w.reduce((acc, wi, i) => acc + parseInt(s[i]) * wi, 0)
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  const d1 = 11 - (calc(n, w1) % 11)
  const d2 = 11 - (calc(n, w2) % 11)
  return parseInt(n[12]) === (d1 >= 10 ? 0 : d1) && parseInt(n[13]) === (d2 >= 10 ? 0 : d2)
}

function formatCNPJ(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 14)
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatTelefone(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export function CorretoraForm({ id, initial, contasIniciais, isBpoAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState(initial?.nome ?? '')
  const [nomeFant, setNomeFant] = useState(initial?.nome_fantasia ?? '')
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? '')
  const [cnpjErro, setCnpjErro] = useState('')
  const [susep, setSusep] = useState(initial?.codigo_susep ?? '')
  const [contatoNome, setContatoNome] = useState(initial?.contato_nome ?? '')
  const [contatoEmail, setContatoEmail] = useState(initial?.contato_email ?? '')
  const [telefone, setTelefone] = useState(initial?.telefone ?? '')
  const [regime, setRegime] = useState(initial?.regime_tributario ?? '')
  const [dataInicio, setDataInicio] = useState(initial?.data_inicio_contrato ?? '')
  const [dataEnc, setDataEnc] = useState(initial?.data_encerramento_contrato ?? '')
  const [obs, setObs] = useState(initial?.observacoes_internas ?? '')
  const [color, setColor] = useState(initial?.primary_color ?? '#5B7291')
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? '')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(initial?.logo_url ?? '')
  const [contas, setContas] = useState<ContaBancaria[]>(
    contasIniciais?.length ? contasIniciais : [{ banco: '', agencia: '', conta: '', apelido: '' }]
  )
  const [erro, setErro] = useState('')
  const [statusAcao, setStatusAcao] = useState('')

  function addConta() {
    setContas(prev => [...prev, { banco: '', agencia: '', conta: '', apelido: '' }])
  }

  function removeConta(i: number) {
    setContas(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateConta(i: number, field: keyof ContaBancaria, value: string) {
    setContas(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!validarCNPJ(cnpj)) {
      setCnpjErro('CNPJ inválido')
      return
    }
    setCnpjErro('')

    if (contas.some(c => !c.banco || !c.agencia || !c.conta)) {
      setErro('Preencha todos os campos obrigatórios das contas bancárias.')
      return
    }

    startTransition(async () => {
      let finalLogoUrl = logoUrl

      if (logoFile) {
        const tempId = id ?? 'novo'
        const result = await uploadLogo(tempId, logoFile)
        if (result.error) { setErro(result.error); return }
        finalLogoUrl = result.url!
        setLogoUrl(finalLogoUrl)
      }

      const payload: CorretoraFormData = {
        nome,
        nome_fantasia: nomeFant,
        cnpj,
        codigo_susep: susep,
        contato_nome: contatoNome,
        contato_email: contatoEmail,
        telefone,
        regime_tributario: regime as CorretoraFormData['regime_tributario'],
        data_inicio_contrato: dataInicio,
        data_encerramento_contrato: dataEnc || undefined,
        observacoes_internas: obs || undefined,
        primary_color: color,
        logo_url: finalLogoUrl || undefined,
        contas,
      }

      const result = id
        ? await atualizarCorretora(id, payload)
        : await criarCorretora(payload)

      if ('error' in result) {
        setErro(result.error ?? 'Erro desconhecido')
        return
      }

      router.push('/admin/corretoras')
    })
  }

  async function handleAlterarStatus(novoStatus: 'ativo' | 'suspenso' | 'inativo') {
    setStatusAcao(novoStatus)
    const result = await alterarStatusCorretora(id!, novoStatus)
    if (result.error) setErro(result.error)
    else router.push('/admin/corretoras')
    setStatusAcao('')
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-3xl">

      {/* Identidade visual — preview em tempo real */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Identidade Visual</h2>
        <div className="flex items-center gap-6">
          {/* Preview mini sidebar */}
          <div
            className="w-14 h-24 rounded-lg flex flex-col items-center justify-center gap-2 shrink-0"
            style={{ backgroundColor: color }}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-8 h-8 rounded object-contain bg-white p-0.5" />
            ) : (
              <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                {(nomeFant || nome || 'C').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="w-8 h-1 rounded bg-white/40" />
            <div className="w-6 h-1 rounded bg-white/20" />
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <div>
              <label className={labelCls}>Logo da corretora</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {logoPreview ? 'Alterar logo' : 'Fazer upload'}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => { setLogoPreview(''); setLogoFile(null); setLogoUrl('') }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Cor primária</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dados Cadastrais */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Dados Cadastrais</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Razão Social *</label>
            <input required value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Nome Fantasia *</label>
            <input required value={nomeFant} onChange={e => setNomeFant(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CNPJ *</label>
            <input
              required
              value={cnpj}
              onChange={e => { setCnpj(formatCNPJ(e.target.value)); setCnpjErro('') }}
              placeholder="00.000.000/0000-00"
              className={`${inputCls} ${cnpjErro ? 'border-red-400' : ''}`}
            />
            {cnpjErro && <p className="text-xs text-red-500 mt-1">{cnpjErro}</p>}
          </div>
          <div>
            <label className={labelCls}>Código SUSEP *</label>
            <input required value={susep} onChange={e => setSusep(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Regime Tributário *</label>
            <select required value={regime} onChange={e => setRegime(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {REGIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Telefone *</label>
            <input
              required
              value={telefone}
              onChange={e => setTelefone(formatTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Contato */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Contato Responsável</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input required value={contatoNome} onChange={e => setContatoNome(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>E-mail *</label>
            <input required type="email" value={contatoEmail} onChange={e => setContatoEmail(e.target.value)} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Contrato */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Contrato</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Data de Início *</label>
            <input required type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Data de Encerramento <span className="font-normal text-gray-400">(vazio = ativo)</span></label>
            <input type="date" value={dataEnc} onChange={e => setDataEnc(e.target.value)} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Dados Bancários */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Dados Bancários</h2>
          <button
            type="button"
            onClick={addConta}
            className="text-xs text-[#5B7291] hover:underline"
          >
            + Adicionar conta
          </button>
        </div>
        {contas.map((conta, i) => (
          <div key={i} className="grid grid-cols-4 gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
            <div>
              <label className={labelCls}>Banco *</label>
              <input
                required
                value={conta.banco}
                onChange={e => updateConta(i, 'banco', e.target.value)}
                placeholder="Ex: Itaú"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Agência *</label>
              <input
                required
                value={conta.agencia}
                onChange={e => updateConta(i, 'agencia', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Conta Corrente *</label>
              <input
                required
                value={conta.conta}
                onChange={e => updateConta(i, 'conta', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Apelido</label>
              <div className="flex gap-2">
                <input
                  value={conta.apelido ?? ''}
                  onChange={e => updateConta(i, 'apelido', e.target.value)}
                  placeholder="Ex: Conta Porto"
                  className={inputCls}
                />
                {contas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeConta(i)}
                    className="px-2 text-red-400 hover:text-red-600 transition-colors text-lg shrink-0"
                    title="Remover conta"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Observações — apenas BPO */}
      {isBpoAdmin && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Observações Internas <span className="text-xs font-normal text-gray-400">(visível apenas para o BPO)</span></h2>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="Particularidades operacionais desta corretora..."
          />
        </section>
      )}

      {erro && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{erro}</p>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : id ? 'Salvar alterações' : 'Cadastrar corretora'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/corretoras')}
          className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancelar
        </button>

        {/* Ações de status — só na edição */}
        {id && initial?.status && (
          <div className="ml-auto flex gap-2">
            {initial.status !== 'ativo' && (
              <button
                type="button"
                onClick={() => handleAlterarStatus('ativo')}
                disabled={!!statusAcao}
                className="px-4 py-2 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {statusAcao === 'ativo' ? 'Ativando...' : 'Ativar'}
              </button>
            )}
            {initial.status !== 'suspenso' && (
              <button
                type="button"
                onClick={() => handleAlterarStatus('suspenso')}
                disabled={!!statusAcao}
                className="px-4 py-2 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
              >
                {statusAcao === 'suspenso' ? 'Suspendendo...' : 'Suspender'}
              </button>
            )}
            {initial.status !== 'inativo' && (
              <button
                type="button"
                onClick={() => handleAlterarStatus('inativo')}
                disabled={!!statusAcao}
                className="px-4 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {statusAcao === 'inativo' ? 'Desativando...' : 'Desativar'}
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
