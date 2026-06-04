'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { SeguradoraFormData, RetencaoForm } from '../actions'
import { criarSeguradora, atualizarSeguradora, alterarStatusSeguradora } from '../actions'

type Grupo = { id: string; nome: string }

type Props = {
  id?: string
  initial?: Partial<SeguradoraFormData> & { status?: string }
  retencoesIniciais?: RetencaoForm[]
  grupos?: Grupo[]
}

const POLITICA_NF_OPTIONS = [
  { value: 'exige_antes_pagamento', label: 'Exige NF antes do pagamento' },
  { value: 'emite_no_fechamento',   label: 'Emite NF no fechamento do mês' },
  { value: 'nao_emite',             label: 'Não emite NF (informa manualmente)' },
]

const ESTORNO_OPTIONS = [
  { value: 'incluso_relatorio',  label: 'Incluso no relatório (linha negativa)' },
  { value: 'lancamento_manual',  label: 'Não inclui — lançamento manual' },
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

const DEFAULT_RETENCOES: RetencaoForm[] = [
  { regime: 'simples_nacional',      retem_iss: false, retem_irpj: false, aliquota_irpj: null },
  { regime: 'lucro_presumido_real',  retem_iss: false, retem_irpj: false, aliquota_irpj: null },
]

export function SeguradoraForm({ id, initial, retencoesIniciais, grupos = [] }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState(initial?.nome ?? '')
  const [nomeFant, setNomeFant] = useState(initial?.nome_fantasia ?? '')
  const [cnpj, setCnpj] = useState(initial?.cnpj ?? '')
  const [cnpjErro, setCnpjErro] = useState('')
  const [susep, setSusep] = useState(initial?.codigo_susep ?? '')
  const [ramosSelecionados, setRamosSelecionados] = useState<string[]>(initial?.ramos ?? [])
  const [politicaNf, setPoliticaNf] = useState(initial?.politica_nf ?? '')
  const [formatoEstorno, setFormatoEstorno] = useState(initial?.formato_estorno ?? '')
  const [obs, setObs] = useState(initial?.observacoes ?? '')

  const [retencoes, setRetencoes] = useState<RetencaoForm[]>(() => {
    if (retencoesIniciais && retencoesIniciais.length > 0) return retencoesIniciais
    return DEFAULT_RETENCOES
  })

  const [erro, setErro] = useState('')
  const [statusAcao, setStatusAcao] = useState('')

  function updateRetencao(regime: RetencaoForm['regime'], field: keyof RetencaoForm, value: boolean | number | null) {
    setRetencoes(prev => prev.map(r =>
      r.regime === regime ? { ...r, [field]: value } : r
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!validarCNPJ(cnpj)) {
      setCnpjErro('CNPJ inválido')
      return
    }
    setCnpjErro('')

    const lpReal = retencoes.find(r => r.regime === 'lucro_presumido_real')
    if (lpReal?.retem_irpj && !lpReal.aliquota_irpj) {
      setErro('Informe a alíquota de IRPJ para Lucro Presumido/Real.')
      return
    }

    startTransition(async () => {
      const payload: SeguradoraFormData = {
        nome,
        nome_fantasia: nomeFant,
        cnpj,
        codigo_susep: susep,
        ramos: ramosSelecionados,
        politica_nf: politicaNf as SeguradoraFormData['politica_nf'],
        formato_estorno: formatoEstorno as SeguradoraFormData['formato_estorno'],
        observacoes: obs || undefined,
        retencoes,
      }

      const result = id
        ? await atualizarSeguradora(id, payload)
        : await criarSeguradora(payload)

      if ('error' in result) {
        setErro(result.error ?? 'Erro desconhecido')
        return
      }

      router.push('/admin/seguradoras')
    })
  }

  async function handleAlterarStatus(novoStatus: 'ativo' | 'inativo') {
    setStatusAcao(novoStatus)
    const result = await alterarStatusSeguradora(id!, novoStatus)
    if (result.error) setErro(result.error)
    else router.push('/admin/seguradoras')
    setStatusAcao('')
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  const REGIME_LABEL: Record<string, string> = {
    simples_nacional:     'Simples Nacional',
    lucro_presumido_real: 'Lucro Presumido / Lucro Real',
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-3xl">

      {/* Dados Gerais */}
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
          <div className="col-span-2">
            <label className={labelCls}>
              Ramos que opera *{' '}
              <span className="font-normal text-gray-400">(selecione todos que se aplicam)</span>
            </label>
            {grupos.length > 0 ? (
              <div className="flex flex-wrap gap-3 mt-1">
                {grupos.map(g => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ramosSelecionados.includes(g.nome)}
                      onChange={e => {
                        setRamosSelecionados(prev =>
                          e.target.checked ? [...prev, g.nome] : prev.filter(r => r !== g.nome)
                        )
                      }}
                      className="rounded border-gray-300 text-[#5B7291]"
                    />
                    <span className="text-sm text-gray-700">{g.nome}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                Nenhum grupo cadastrado ainda.{' '}
                <a href="/admin/produtos?aba=grupos" className="text-[#5B7291] hover:underline">Cadastrar grupos</a>
              </p>
            )}
            {ramosSelecionados.length === 0 && (
              <p className="text-xs text-red-400 mt-1">Selecione pelo menos um ramo.</p>
            )}
          </div>
        </div>
      </section>

      {/* Operacional */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Operacional</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Política de NF *</label>
            <select required value={politicaNf} onChange={e => setPoliticaNf(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {POLITICA_NF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Formato de estorno *</label>
            <select required value={formatoEstorno} onChange={e => setFormatoEstorno(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {ESTORNO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Observações <span className="font-normal text-gray-400">(padrão de pagamento, particularidades)</span></label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="Ex: paga todo dia 5, envia relatório até dia 10..."
            />
          </div>
        </div>
      </section>

      {/* Retenções */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Regras de Retenção</h2>
          <p className="text-xs text-gray-400 mt-1">
            Define se esta seguradora retém impostos na fonte ao pagar a corretora, por regime tributário.
          </p>
        </div>

        {retencoes.map((ret) => {
          const isSimples = ret.regime === 'simples_nacional'
          return (
            <div key={ret.regime} className="border border-gray-100 rounded-lg p-4 flex flex-col gap-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {REGIME_LABEL[ret.regime]}
              </p>

              <div className="flex flex-wrap gap-6">
                {/* Retém ISS */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ret.retem_iss}
                    onChange={e => updateRetencao(ret.regime, 'retem_iss', e.target.checked)}
                    className="rounded border-gray-300 text-[#5B7291]"
                  />
                  <span className="text-sm text-gray-700">Retém ISS</span>
                  <span className="text-xs text-gray-400">(alíquota informada no fechamento mensal)</span>
                </label>

                {/* Retém IRPJ — não se aplica ao Simples */}
                {!isSimples && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ret.retem_irpj}
                      onChange={e => {
                        updateRetencao(ret.regime, 'retem_irpj', e.target.checked)
                        if (!e.target.checked) updateRetencao(ret.regime, 'aliquota_irpj', null)
                      }}
                      className="rounded border-gray-300 text-[#5B7291]"
                    />
                    <span className="text-sm text-gray-700">Retém IRPJ</span>
                  </label>
                )}
              </div>

              {/* Alíquota IRPJ */}
              {!isSimples && ret.retem_irpj && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 font-medium w-28">Alíquota IRPJ *</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={ret.aliquota_irpj ?? ''}
                      onChange={e => updateRetencao(ret.regime, 'aliquota_irpj', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
                      placeholder="0.00"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              )}

              {isSimples && (
                <p className="text-xs text-gray-400 italic">
                  Simples Nacional: IRPJ não aplicável (recolhido pelo próprio regime).
                </p>
              )}
            </div>
          )
        })}

        {/* Exemplo de cálculo */}
        <div className="bg-blue-50 rounded-lg p-4 text-xs text-blue-700">
          <p className="font-medium mb-1">Como o sistema usa essas regras:</p>
          <p>No fechamento mensal, o BPO informa a alíquota de ISS do mês. O sistema calcula automaticamente o valor esperado no extrato bancário:</p>
          <p className="mt-1 font-mono">
            Valor líquido = Comissão bruta − (ISS retido, se houver) − (IRPJ retido, se houver)
          </p>
        </div>
      </section>

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
          {isPending ? 'Salvando...' : id ? 'Salvar alterações' : 'Cadastrar seguradora'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/seguradoras')}
          className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
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
                {statusAcao === 'inativo' ? 'Desativando...' : 'Desativar'}
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
