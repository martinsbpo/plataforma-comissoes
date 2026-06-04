'use client'

import { useState, useTransition } from 'react'
import type { AliquotaFormData } from '../actions'
import { salvarAliquota } from '../actions'

type Corretora = { id: string; nome_fantasia: string | null; nome: string; regime_tributario: string | null }

type Props = {
  corretoras: Corretora[]
  temRetencaoISS: boolean
}

const REGIME_LABEL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido:  'Lucro Presumido',
  lucro_real:       'Lucro Real',
}

export function AliquotaForm({ corretoras, temRetencaoISS }: Props) {
  const [isPending, startTransition] = useTransition()
  const [tenantId, setTenantId] = useState('')
  const [competencia, setCompetencia] = useState('')
  const [aliqGlobal, setAliqGlobal] = useState('')
  const [aliqISS, setAliqISS] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const corretoraAtual = corretoras.find(c => c.id === tenantId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')

    if (!aliqGlobal || parseFloat(aliqGlobal) <= 0) {
      setErro('Alíquota Global é obrigatória.')
      return
    }

    if (temRetencaoISS && !aliqISS) {
      setErro('Alíquota de ISS é obrigatória — há seguradoras com retenção de ISS configurada.')
      return
    }

    startTransition(async () => {
      const payload: AliquotaFormData = {
        tenant_id: tenantId,
        competencia,
        aliquota_global: parseFloat(aliqGlobal),
        aliquota_iss: aliqISS ? parseFloat(aliqISS) : null,
        observacoes: obs || undefined,
      }

      const result = await salvarAliquota(payload)
      if (result.error) {
        setErro(result.error)
        return
      }

      setSucesso('Alíquota registrada com sucesso!')
      setAliqGlobal('')
      setAliqISS('')
      setObs('')
      setTimeout(() => setSucesso(''), 3000)
    })
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-gray-700">Registrar Alíquota do Mês</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Corretora *</label>
          <select
            required
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecione...</option>
            {corretoras.map(c => (
              <option key={c.id} value={c.id}>{c.nome_fantasia ?? c.nome}</option>
            ))}
          </select>
          {corretoraAtual?.regime_tributario && (
            <p className="text-xs text-gray-400 mt-1">
              Regime: {REGIME_LABEL[corretoraAtual.regime_tributario]}
            </p>
          )}
        </div>

        <div>
          <label className={labelCls}>Competência (mês/ano) *</label>
          <input
            required
            type="month"
            value={competencia}
            onChange={e => setCompetencia(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Alíquota Global de Imposto *</label>
          <div className="flex items-center gap-1">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={aliqGlobal}
              onChange={e => setAliqGlobal(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
            <span className="text-sm text-gray-500 shrink-0">%</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Alíquota de ISS do Mês
            {temRetencaoISS && <span className="text-red-400 ml-1">*</span>}
            {!temRetencaoISS && <span className="font-normal text-gray-400 ml-1">(sem retenção configurada)</span>}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={aliqISS}
              onChange={e => setAliqISS(e.target.value)}
              placeholder="0.00"
              disabled={!temRetencaoISS}
              className={`${inputCls} ${!temRetencaoISS ? 'bg-gray-50 text-gray-400' : ''}`}
            />
            <span className="text-sm text-gray-500 shrink-0">%</span>
          </div>
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Observações</label>
          <input
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Ex: alíquota aumentou pois cruzou faixa X do Simples..."
            className={inputCls}
          />
        </div>
      </div>

      {/* Preview do cálculo */}
      {aliqGlobal && (
        <div className="bg-blue-50 rounded-lg p-4 text-xs text-blue-700">
          <p className="font-medium mb-1">Preview do cálculo de repasse:</p>
          <p>Comissão bruta R$10.000 → Imposto ({aliqGlobal}%) = R${(10000 * parseFloat(aliqGlobal) / 100).toFixed(2)} → Base para repasse: R${(10000 * (1 - parseFloat(aliqGlobal) / 100)).toFixed(2)}</p>
        </div>
      )}

      {erro && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-4 py-3">{sucesso}</p>}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#5B7291] text-white text-sm rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Registrar alíquota'}
        </button>
      </div>
    </form>
  )
}
