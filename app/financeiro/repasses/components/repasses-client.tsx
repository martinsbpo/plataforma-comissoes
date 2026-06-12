'use client'

import { useState, useTransition } from 'react'
import {
  SaldoParceiro,
  ExtratoParceiro,
  buscarExtratoParceiro,
  registrarPagamento,
  registrarPagamentosLote,
  removerPagamento,
} from '../actions'

type Props = {
  tenantId: string
  saldos: SaldoParceiro[]
  parceiros: { id: string; nome: string }[]
  isBpoAdmin: boolean
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function RepassesClient({ tenantId, saldos, parceiros, isBpoAdmin }: Props) {
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Extrato modal
  const [extrato, setExtrato] = useState<ExtratoParceiro | null>(null)
  const [loadingExtrato, setLoadingExtrato] = useState(false)

  // Pagamento avulso
  const [modalAvulso, setModalAvulso] = useState(false)
  const [avulsoParceiroId, setAvulsoParceiroId] = useState('')
  const [avulsoValor, setAvulsoValor] = useState('')
  const [avulsoData, setAvulsoData] = useState(new Date().toISOString().slice(0, 10))
  const [avulsoDescricao, setAvulsoDescricao] = useState('')

  // Pagamento em lote
  const [modalLote, setModalLote] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loteData, setLoteData] = useState(new Date().toISOString().slice(0, 10))
  const [confirmandoLote, setConfirmandoLote] = useState(false)

  const msg = (texto: string, tipo: 'ok' | 'erro') => {
    if (tipo === 'ok') { setSucesso(texto); setErro(null) }
    else { setErro(texto); setSucesso(null) }
    setTimeout(() => { setSucesso(null); setErro(null) }, 4000)
  }

  async function abrirExtrato(parceiroId: string) {
    setLoadingExtrato(true)
    const res = await buscarExtratoParceiro(tenantId, parceiroId)
    setLoadingExtrato(false)
    if ('error' in res) { msg(res.error, 'erro'); return }
    setExtrato(res)
  }

  function handleAvulsoSubmit() {
    const valor = parseFloat(avulsoValor.replace(',', '.'))
    if (!avulsoParceiroId || !valor || valor <= 0 || !avulsoData) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    startTransition(async () => {
      const res = await registrarPagamento(tenantId, avulsoParceiroId, valor, avulsoData, avulsoDescricao)
      if ('error' in res) { msg(res.error, 'erro'); return }
      msg('Pagamento registrado com sucesso.', 'ok')
      setModalAvulso(false)
      setAvulsoParceiroId('')
      setAvulsoValor('')
      setAvulsoDescricao('')
    })
  }

  function handleLoteConfirmar() {
    const pagamentos = saldos
      .filter(s => selecionados.has(s.parceiro_id) && s.saldo > 0)
      .map(s => ({ parceiro_id: s.parceiro_id, valor: s.saldo }))

    if (pagamentos.length === 0 || !loteData) {
      setErro('Selecione ao menos um parceiro e informe a data.')
      return
    }
    startTransition(async () => {
      const res = await registrarPagamentosLote(tenantId, pagamentos, loteData)
      if ('error' in res) { msg(res.error, 'erro'); return }
      msg(`${res.count} pagamento(s) registrado(s) com sucesso.`, 'ok')
      setModalLote(false)
      setSelecionados(new Set())
      setConfirmandoLote(false)
    })
  }

  async function handleRemoverPagamento(pagamentoId: string) {
    if (!confirm('Remover este pagamento?')) return
    const res = await removerPagamento(tenantId, pagamentoId)
    if ('error' in res) { msg(res.error, 'erro'); return }
    msg('Pagamento removido.', 'ok')
    if (extrato) abrirExtrato(extrato.parceiro_id)
  }

  const comSaldo = saldos.filter(s => s.saldo > 0)
  const semSaldo = saldos.filter(s => s.saldo <= 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Feedback */}
      {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-2">{sucesso}</p>}

      {/* Ações */}
      <div className="flex gap-3">
        <button
          onClick={() => setModalAvulso(true)}
          className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors"
        >
          + Pagamento avulso
        </button>
        {comSaldo.length > 0 && (
          <button
            onClick={() => { setModalLote(true); setSelecionados(new Set(comSaldo.map(s => s.parceiro_id))) }}
            className="px-4 py-2 text-sm border border-[#5B7291] text-[#5B7291] rounded-lg hover:bg-[#5B7291]/5 transition-colors"
          >
            Registrar pagamentos em lote
          </button>
        )}
      </div>

      {saldos.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Nenhum parceiro encontrado para esta corretora.</p>
        </div>
      ) : (
        <>
          {/* Parceiros com saldo a pagar */}
          {comSaldo.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-sm font-semibold text-amber-800">A pagar ({comSaldo.length})</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Parceiro</th>
                    <th className="text-right px-4 py-2">Créditos</th>
                    <th className="text-right px-4 py-2">Pagamentos</th>
                    <th className="text-right px-4 py-2 font-bold text-gray-700">Saldo</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comSaldo.map(s => (
                    <tr key={s.parceiro_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.parceiro_nome}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(s.total_creditos)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(s.total_pagamentos)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmt(s.saldo)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => abrirExtrato(s.parceiro_id)}
                          className="text-xs text-[#5B7291] hover:underline"
                        >
                          Ver extrato
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Parceiros sem saldo */}
          {semSaldo.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-600">Sem saldo a pagar ({semSaldo.length})</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Parceiro</th>
                    <th className="text-right px-4 py-2">Créditos</th>
                    <th className="text-right px-4 py-2">Pagamentos</th>
                    <th className="text-right px-4 py-2">Saldo</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {semSaldo.map(s => (
                    <tr key={s.parceiro_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-700">{s.parceiro_nome}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(s.total_creditos)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(s.total_pagamentos)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${s.saldo < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {fmt(s.saldo)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => abrirExtrato(s.parceiro_id)}
                          className="text-xs text-[#5B7291] hover:underline"
                        >
                          Ver extrato
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: pagamento avulso */}
      {modalAvulso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-gray-900">Registrar pagamento avulso</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Parceiro *</label>
                <select
                  value={avulsoParceiroId}
                  onChange={e => setAvulsoParceiroId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">Selecione...</option>
                  {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Valor (R$) *</label>
                <input
                  type="text"
                  value={avulsoValor}
                  onChange={e => setAvulsoValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Data do pagamento *</label>
                <input
                  type="date"
                  value={avulsoData}
                  onChange={e => setAvulsoData(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Descrição</label>
                <input
                  type="text"
                  value={avulsoDescricao}
                  onChange={e => setAvulsoDescricao(e.target.value)}
                  placeholder="Ex: Pagamento referência 05/2026"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            </div>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalAvulso(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
              <button
                onClick={handleAvulsoSubmit}
                disabled={pending}
                className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Registrar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: pagamento em lote */}
      {modalLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-gray-900">Registrar pagamentos em lote</h2>
            {!confirmandoLote ? (
              <>
                <p className="text-sm text-gray-500">Selecione os parceiros que serão pagos. O valor a pagar é o saldo acumulado de cada um.</p>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {comSaldo.map(s => (
                    <label key={s.parceiro_id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selecionados.has(s.parceiro_id)}
                        onChange={e => {
                          const novo = new Set(selecionados)
                          e.target.checked ? novo.add(s.parceiro_id) : novo.delete(s.parceiro_id)
                          setSelecionados(novo)
                        }}
                        className="rounded"
                      />
                      <span className="flex-1 text-sm text-gray-900">{s.parceiro_nome}</span>
                      <span className="text-sm font-semibold text-amber-700">{fmt(s.saldo)}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setModalLote(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
                  <button
                    onClick={() => { if (selecionados.size > 0) setConfirmandoLote(true) }}
                    disabled={selecionados.size === 0}
                    className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-50"
                  >
                    Próximo ({selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''})
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Informe a data em que os pagamentos foram realizados. Essa data vale para todos os selecionados.</p>
                <div>
                  <label className="text-xs font-medium text-gray-600">Data do pagamento *</label>
                  <input
                    type="date"
                    value={loteData}
                    onChange={e => setLoteData(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {comSaldo.filter(s => selecionados.has(s.parceiro_id)).map(s => (
                    <div key={s.parceiro_id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="text-gray-700">{s.parceiro_nome}</span>
                      <span className="font-semibold text-amber-700">{fmt(s.saldo)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-semibold text-gray-900 text-right">
                  Total: {fmt(comSaldo.filter(s => selecionados.has(s.parceiro_id)).reduce((acc, s) => acc + s.saldo, 0))}
                </p>
                {erro && <p className="text-xs text-red-600">{erro}</p>}
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setConfirmandoLote(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Voltar</button>
                  <button
                    onClick={handleLoteConfirmar}
                    disabled={pending || !loteData}
                    className="px-4 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-50"
                  >
                    {pending ? 'Registrando...' : 'Confirmar pagamentos'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: extrato do parceiro */}
      {(loadingExtrato || extrato) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {loadingExtrato ? (
              <p className="text-sm text-gray-500 text-center py-8">Carregando extrato...</p>
            ) : extrato ? (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{extrato.parceiro_nome}</h2>
                    <p className={`text-sm font-semibold mt-1 ${extrato.saldo >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                      Saldo: {fmt(extrato.saldo)}
                    </p>
                  </div>
                  <button onClick={() => setExtrato(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                {/* Créditos */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Créditos — apurações confirmadas</p>
                  {extrato.creditos.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum crédito ainda.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Competência</th>
                          <th className="text-right px-3 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {extrato.creditos.map(c => (
                          <tr key={c.apuracao_id}>
                            <td className="px-3 py-2 text-gray-700">
                              {(() => { const [y, m] = c.competencia.split('-'); return `${m}/${y}` })()}
                            </td>
                            <td className="px-3 py-2 text-right text-green-700 font-medium">+ {fmt(c.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagamentos */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pagamentos efetuados</p>
                  {extrato.pagamentos.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum pagamento registrado.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Data</th>
                          <th className="text-left px-3 py-2">Descrição</th>
                          <th className="text-right px-3 py-2">Valor</th>
                          {isBpoAdmin && <th className="px-3 py-2"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {extrato.pagamentos.map(p => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 text-gray-700">{fmtDate(p.data_pagamento)}</td>
                            <td className="px-3 py-2 text-gray-500">{p.descricao ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-red-600 font-medium">− {fmt(p.valor)}</td>
                            {isBpoAdmin && (
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleRemoverPagamento(p.id)}
                                  className="text-xs text-red-400 hover:text-red-600"
                                >
                                  Remover
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
