'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Seguradora = { id: string; nome_fantasia: string; nome: string }
type Layout = { id: string; nome: string; formato: string; seguradora_id: string }

type ResultadoProcessamento = {
  importacao_id: string
  total_linhas: number
  total_ok: number
  total_pendentes: number
  valor_total: number
}

type AvisoCompetencia = {
  aviso_competencia: true
  total_divergentes: number
  total_linhas: number
  competencia_declarada: string
  competencias_no_arquivo: string[]
}

type Props = {
  seguradoras: Seguradora[]
  layouts: Layout[]
  tenantId: string
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function competenciaOpcoes() {
  const hoje = new Date()
  const opcoes = []
  for (let i = 0; i < 13; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const label = `${MESES[d.getMonth()]} ${d.getFullYear()}`
    opcoes.push({ value: iso, label })
  }
  return opcoes
}

export function UploadImportacao({ seguradoras, layouts, tenantId }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const [etapa, setEtapa] = useState<'declaracao' | 'processando' | 'resultado'>('declaracao')
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<ResultadoProcessamento | null>(null)
  const [aviso, setAviso] = useState<AvisoCompetencia | null>(null)

  const [seguradoraId, setSeguradoraId] = useState('')
  const [layoutId, setLayoutId] = useState('')
  const [competencia, setCompetencia] = useState(competenciaOpcoes()[1].value)
  const [diaPagamento, setDiaPagamento] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [progressos, setProgressos] = useState<{ nome: string; status: 'aguardando' | 'processando' | 'ok' | 'erro'; msg?: string }[]>([])

  const layoutsFiltrados = layouts.filter((l) => l.seguradora_id === seguradoraId)

  function handleSeguradoraChange(id: string) {
    setSeguradoraId(id)
    setLayoutId('')
  }

  function handleArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setArquivos(files)
    setErro('')
  }

  function removerArquivo(idx: number) {
    setArquivos(prev => prev.filter((_, i) => i !== idx))
  }

  async function enviarArquivo(arquivo: File, forceCompetencia = false): Promise<{ ok: boolean; data: ResultadoProcessamento | AvisoCompetencia | { error: string } }> {
    const fd = new FormData()
    fd.append('arquivo', arquivo)
    fd.append('layout_id', layoutId)
    fd.append('seguradora_id', seguradoraId)
    fd.append('competencia', competencia)
    fd.append('tenant_id', tenantId)
    if (diaPagamento) fd.append('dia_pagamento', diaPagamento)
    if (forceCompetencia) fd.append('force', 'true')

    try {
      const resp = await fetch('/api/importacoes/processar', { method: 'POST', body: fd })
      const data = await resp.json()
      return { ok: resp.ok, data }
    } catch {
      return { ok: false, data: { error: 'Erro de conexão' } }
    }
  }

  async function handleProcessar(e: React.FormEvent) {
    e.preventDefault()
    if (arquivos.length === 0) { setErro('Selecione ao menos um arquivo'); return }
    if (!seguradoraId) { setErro('Selecione a seguradora'); return }
    if (!layoutId) { setErro('Selecione o layout'); return }

    setErro('')

    if (arquivos.length === 1) {
      // Fluxo original para arquivo único (mantém aviso de competência)
      setEtapa('processando')
      const { ok, data } = await enviarArquivo(arquivos[0], false)
      if (!ok) {
        setErro((data as { error: string }).error ?? 'Erro ao processar arquivo')
        setEtapa('declaracao')
        return
      }
      if ((data as AvisoCompetencia).aviso_competencia) {
        setAviso(data as AvisoCompetencia)
        setEtapa('declaracao')
        return
      }
      setResultado(data as ResultadoProcessamento)
      setEtapa('resultado')
      return
    }

    // Múltiplos arquivos: processa em sequência com progresso
    setProgressos(arquivos.map(f => ({ nome: f.name, status: 'aguardando' })))
    setEtapa('processando')

    const resultados: ResultadoProcessamento[] = []
    for (let i = 0; i < arquivos.length; i++) {
      setProgressos(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'processando' } : p))
      const { ok, data } = await enviarArquivo(arquivos[i], true) // force=true em lote para não parar
      if (!ok || (data as { error?: string }).error) {
        setProgressos(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'erro', msg: (data as { error?: string }).error ?? 'Erro' } : p))
      } else {
        const r = data as ResultadoProcessamento
        resultados.push(r)
        setProgressos(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'ok', msg: `${r.total_ok} linhas OK` } : p))
      }
    }

    // Agrega resultados
    if (resultados.length > 0) {
      setResultado({
        importacao_id: resultados[resultados.length - 1].importacao_id,
        total_linhas: resultados.reduce((s, r) => s + r.total_linhas, 0),
        total_ok: resultados.reduce((s, r) => s + r.total_ok, 0),
        total_pendentes: resultados.reduce((s, r) => s + r.total_pendentes, 0),
        valor_total: resultados.reduce((s, r) => s + r.valor_total, 0),
      })
      setEtapa('resultado')
    } else {
      setErro('Nenhum arquivo foi processado com sucesso.')
      setEtapa('declaracao')
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  if (etapa === 'processando') {
    return (
      <div className="flex flex-col gap-4 py-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-3 border-[#5B7291] border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-gray-600 font-medium">Processando arquivos...</p>
        </div>
        {progressos.length > 0 && (
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {progressos.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="text-base">
                  {p.status === 'aguardando' ? '⏳' : p.status === 'processando' ? '🔄' : p.status === 'ok' ? '✅' : '❌'}
                </span>
                <span className="flex-1 text-gray-700 truncate">{p.nome}</span>
                <span className="text-xs text-gray-400">{p.msg ?? p.status}</span>
              </div>
            ))}
          </div>
        )}
        {progressos.length === 0 && <p className="text-xs text-gray-400 text-center">{arquivos[0]?.name}</p>}
      </div>
    )
  }

  if (etapa === 'resultado' && resultado) {
    const temPendentes = resultado.total_pendentes > 0
    return (
      <div className="flex flex-col gap-6">
        {/* Resumo */}
        <div className={`rounded-xl border p-6 ${temPendentes ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{temPendentes ? '⚠️' : '✅'}</span>
            <div>
              <p className="font-semibold text-gray-900">
                {temPendentes ? 'Arquivo processado com pendências' : 'Arquivo processado com sucesso'}
              </p>
              <p className="text-sm text-gray-500">{arquivo?.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{resultado.total_linhas}</p>
              <p className="text-xs text-gray-500 mt-1">Linhas lidas</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{resultado.total_ok}</p>
              <p className="text-xs text-gray-500 mt-1">OK</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${temPendentes ? 'text-amber-600' : 'text-gray-300'}`}>
                {resultado.total_pendentes}
              </p>
              <p className="text-xs text-gray-500 mt-1">Pendentes</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-[#5B7291]">
                {resultado.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-gray-500 mt-1">Valor total</p>
            </div>
          </div>
        </div>

        {temPendentes && (
          <div className="bg-white border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-1">
              {resultado.total_pendentes} linha{resultado.total_pendentes !== 1 ? 's' : ''} com produto não identificado
            </p>
            <p className="text-sm text-amber-600">
              Acesse a importação para resolver os itens pendentes antes de confirmar.
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              setEtapa('declaracao')
              setResultado(null)
              setArquivos([])
              setProgressos([])
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Importar outro arquivo
          </button>
          <button
            onClick={() => router.push(`/seguradoras/${resultado.importacao_id}`)}
            className="px-6 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors"
          >
            {temPendentes ? 'Resolver pendências' : 'Ver importação'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleProcessar} className="flex flex-col gap-6">
      {/* Declaração */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Declaração da importação
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Seguradora *</label>
            <select
              value={seguradoraId}
              onChange={(e) => handleSeguradoraChange(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Selecione...</option>
              {seguradoras.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome_fantasia || s.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Competência (mês de referência) *</label>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className={inputCls}
            >
              {competenciaOpcoes().map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Layout de leitura *</label>
            <select
              value={layoutId}
              onChange={(e) => setLayoutId(e.target.value)}
              required
              disabled={!seguradoraId}
              className={inputCls}
            >
              <option value="">
                {seguradoraId
                  ? layoutsFiltrados.length === 0
                    ? 'Nenhum layout cadastrado para esta seguradora'
                    : 'Selecione o layout...'
                  : 'Selecione a seguradora primeiro'}
              </option>
              {layoutsFiltrados.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
            {seguradoraId && layoutsFiltrados.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Cadastre um layout em{' '}
                <a href="/admin/layouts/novo" className="underline">
                  Administração → Layouts
                </a>{' '}
                antes de importar.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Dia de pagamento (opcional)</label>
            <input
              type="number"
              min={1}
              max={31}
              value={diaPagamento}
              onChange={(e) => setDiaPagamento(e.target.value)}
              placeholder="ex: 15"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">Dia em que a seguradora pagou</p>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Arquivo
        </h2>
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-[#5B7291]/40 hover:bg-gray-50 transition-colors">
          <input
            ref={fileRef}
            type="file"
            onChange={handleArquivos}
            accept=".csv,.txt,.xlsx,.xls,.pdf"
            multiple
            className="sr-only"
          />
          <span className="text-3xl">{arquivos.length > 0 ? '📄' : '📂'}</span>
          {arquivos.length > 0 ? (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                {arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos selecionados`}
              </p>
              <p className="text-xs text-gray-400 mt-1">Clique para trocar</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Clique para selecionar um ou mais arquivos</p>
              <p className="text-xs text-gray-400 mt-1">CSV, TXT, XLSX, PDF — você pode selecionar vários de uma vez</p>
            </div>
          )}
        </label>
        {arquivos.length > 1 && (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
            {arquivos.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-gray-400">📄</span>
                <span className="flex-1 text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
                <button type="button" onClick={() => removerArquivo(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de aviso de competência divergente */}
      {aviso && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h3 className="font-semibold text-gray-900">Competência divergente</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Você declarou a competência{' '}
                  <strong>{aviso.competencia_declarada.replace('-', '/')}</strong>, mas{' '}
                  <strong>{aviso.total_divergentes}</strong> linha
                  {aviso.total_divergentes !== 1 ? 's' : ''} do arquivo
                  {aviso.total_divergentes !== 1 ? ' têm' : ' tem'} data diferente:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {aviso.competencias_no_arquivo.map((c) => (
                    <span key={c} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-mono">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Deseja continuar mesmo assim? Todas as linhas serão lançadas em{' '}
                  <strong>{aviso.competencia_declarada.replace('-', '/')}</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAviso(null)}
                className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setAviso(null); enviarArquivo(true) }}
                className="px-6 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {erro && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {erro}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || arquivos.length === 0 || !layoutId}
          className="px-8 py-2.5 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
        >
          {arquivos.length > 1 ? `Processar ${arquivos.length} arquivos` : 'Processar arquivo'}
        </button>
      </div>
    </form>
  )
}
