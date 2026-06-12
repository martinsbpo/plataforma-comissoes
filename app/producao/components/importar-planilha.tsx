'use client'

import { useState, useRef } from 'react'

type Props = {
  onImportado: (msg: string) => void
  defaultCompetencia?: string
  tenantId?: string
}

type PreviewData = {
  headers: string[]
  mapping: Record<number, string>
  preview: unknown[][]
}

const CAMPOS_SISTEMA = [
  { value: '', label: '— ignorar —' },
  { value: 'seg_ref', label: 'SEG+REF' },
  { value: 'data', label: 'DATA' },
  { value: 'seguradora', label: 'SEGURADORA' },
  { value: 'segurado', label: 'SEGURADO' },
  { value: 'referencia', label: 'REF SEGURADORA' },
  { value: 'cpf_segurado', label: 'CPF DO SEGURADO' },
  { value: 'grupo_produto', label: 'GRUPO DE PRODUTO' },
  { value: 'produto', label: 'PRODUTO' },
  { value: 'comissao', label: 'COMISSÃO' },
  { value: 'indicador', label: 'INDICADOR' },
  { value: 'pct_indicador', label: '% INDICADOR' },
  { value: 'corretor1', label: 'CORRETOR1' },
  { value: 'pct_corretor1', label: '% CORRETOR1' },
  { value: 'corretor2', label: 'CORRETOR2' },
  { value: 'pct_corretor2', label: '% CORRETOR2' },
  { value: 'impostos_pct', label: 'IMPOSTOS %' },
]

export function ImportarPlanilha({ onImportado, defaultCompetencia, tenantId }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'upload' | 'mapeamento' | 'confirmando'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [competencia, setCompetencia] = useState(defaultCompetencia ?? new Date().toISOString().slice(0, 7))
  const [linhaInicio, setLinhaInicio] = useState(1)
  const [duplicataAcao, setDuplicataAcao] = useState<'ignorar' | 'sobrescrever'>('ignorar')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [resultado, setResultado] = useState<{ importadas: number; ignoradas: number; alertas: number; sem_imposto: boolean; erros?: { row: number; motivo: string }[]; alertasDetalhe?: { row: number; campo: string; valor: string }[] } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  function handleClose() {
    setOpen(false)
    setStep('upload')
    setArquivo(null)
    setPreviewData(null)
    setMapping({})
    setResultado(null)
    setError('')
  }

  async function handlePreview() {
    if (!arquivo || !competencia) { setError('Selecione o arquivo e informe a competência.'); return }
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('arquivo', arquivo)
      fd.append('competencia', competencia)
      fd.append('linha_inicio', String(linhaInicio))
      fd.append('preview', 'true')
      if (tenantId) fd.append('tenant_id', tenantId)

      const res = await fetch('/api/producao/importar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao processar arquivo'); return }

      setPreviewData(data)
      setMapping(data.mapping)
      setStep('mapeamento')
    } catch {
      setError('Erro ao enviar arquivo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleImportar() {
    if (!arquivo || !previewData) return
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('arquivo', arquivo)
      fd.append('competencia', competencia)
      fd.append('linha_inicio', String(linhaInicio))
      fd.append('mapeamento', JSON.stringify(mapping))
      fd.append('duplicata_acao', duplicataAcao)
      if (tenantId) fd.append('tenant_id', tenantId)

      const res = await fetch('/api/producao/importar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro na importação'); return }

      setResultado({ importadas: data.importadas, ignoradas: data.ignoradas, alertas: data.alertas?.length ?? 0, sem_imposto: data.sem_imposto, erros: data.erros, alertasDetalhe: data.alertas })
      setStep('confirmando')

      if (data.importadas > 0) {
        onImportado(`${data.importadas} linha(s) importada(s) com sucesso.${data.sem_imposto ? ' ⚠️ Imposto não encontrado para o período — confira a alíquota.' : ''}`)
      }
    } catch {
      setError('Erro ao enviar para importação.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Importar planilha
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Importar planilha de produção</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
              {step === 'upload' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Competência *</label>
                      <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Linha de início dos dados</label>
                      <input type="number" min={1} value={linhaInicio} onChange={e => setLinhaInicio(parseInt(e.target.value) || 1)} className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Arquivo (.xlsx, .xls, .csv) *</label>
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-[#5B7291]/50 transition-colors"
                      onClick={() => inputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const f = e.dataTransfer.files[0]
                        if (f) setArquivo(f)
                      }}
                    >
                      {arquivo ? (
                        <p className="text-sm text-gray-700 font-medium">{arquivo.name}</p>
                      ) : (
                        <>
                          <p className="text-sm text-gray-400">Arraste o arquivo aqui ou clique para selecionar</p>
                          <p className="text-xs text-gray-300 mt-1">xlsx, xls, csv — máx 10MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => setArquivo(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </>
              )}

              {step === 'mapeamento' && previewData && (
                <>
                  <p className="text-sm text-gray-600">Verifique o mapeamento de colunas detectado automaticamente. Ajuste se necessário.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-2 py-1.5 text-gray-500 font-medium">#</th>
                          <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Coluna no arquivo</th>
                          <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Campo no sistema</th>
                          <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Prévia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {previewData.headers.map((h, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                            <td className="px-2 py-1 font-mono text-gray-700">{h}</td>
                            <td className="px-2 py-1">
                              <select
                                value={mapping[i] ?? ''}
                                onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value }))}
                                className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none"
                              >
                                {CAMPOS_SISTEMA.map(c => (
                                  <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 text-gray-400 max-w-[100px] truncate">
                              {String(previewData.preview[0]?.[i] ?? '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duplicatas (mesma referência no período)</label>
                    <select value={duplicataAcao} onChange={e => setDuplicataAcao(e.target.value as 'ignorar' | 'sobrescrever')} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
                      <option value="ignorar">Ignorar duplicatas</option>
                      <option value="sobrescrever">Sobrescrever duplicatas</option>
                    </select>
                  </div>
                </>
              )}

              {step === 'confirmando' && resultado && (
                <div className="py-4">
                  <div className="text-center mb-4">
                    <p className="text-4xl mb-2">{resultado.importadas > 0 ? '✅' : '⚠️'}</p>
                    <p className="text-base font-semibold text-gray-900">{resultado.importadas} linha(s) importada(s)</p>
                    <p className="text-sm text-gray-500 mt-1">{resultado.ignoradas} ignorada(s) por erro ou duplicata</p>
                    {resultado.sem_imposto && (
                      <p className="text-sm text-red-500 mt-2">⚠️ Alíquota de imposto não cadastrada para este período — confira em Administração &gt; Alíquotas Mensais.</p>
                    )}
                  </div>
                  {resultado.erros && resultado.erros.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-red-600 mb-1">Erros ({resultado.erros.length}):</p>
                      <div className="max-h-40 overflow-y-auto border border-red-100 rounded-lg bg-red-50 px-3 py-2 space-y-1">
                        {resultado.erros.slice(0, 20).map((e, i) => (
                          <p key={i} className="text-xs text-red-700">Linha {e.row}: {e.motivo}</p>
                        ))}
                        {resultado.erros.length > 20 && <p className="text-xs text-red-400">...e mais {resultado.erros.length - 20} erros</p>}
                      </div>
                    </div>
                  )}
                  {resultado.alertasDetalhe && resultado.alertasDetalhe.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-amber-600 mb-1">Alertas — não reconhecidos ({resultado.alertasDetalhe.length}):</p>
                      <div className="max-h-32 overflow-y-auto border border-amber-100 rounded-lg bg-amber-50 px-3 py-2 space-y-1">
                        {resultado.alertasDetalhe.slice(0, 15).map((a, i) => (
                          <p key={i} className="text-xs text-amber-700">Linha {a.row} — {a.campo}: "{a.valor}"</p>
                        ))}
                        {resultado.alertasDetalhe.length > 15 && <p className="text-xs text-amber-400">...e mais {resultado.alertasDetalhe.length - 15}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={handleClose} type="button" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                {step === 'confirmando' ? 'Fechar' : 'Cancelar'}
              </button>
              {step === 'upload' && (
                <button onClick={handlePreview} disabled={loading || !arquivo} className="px-5 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-60 transition-colors">
                  {loading ? 'Processando...' : 'Próximo: mapeamento'}
                </button>
              )}
              {step === 'mapeamento' && (
                <>
                  <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    Voltar
                  </button>
                  <button onClick={handleImportar} disabled={loading} className="px-5 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] disabled:opacity-60 transition-colors">
                    {loading ? 'Importando...' : 'Confirmar importação'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
