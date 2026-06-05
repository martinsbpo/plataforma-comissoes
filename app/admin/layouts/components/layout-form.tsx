'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { criarLayout, atualizarLayout, alterarStatusLayout, type MapeamentoInput } from '../actions'

type Seguradora = { id: string; nome_fantasia: string; nome: string }
type GrupoProduto = { id: string; nome: string }
type Produto = { id: string; nome: string; grupo_produto_id: string }

type LayoutExistente = {
  id: string
  seguradora_id: string
  nome: string
  formato: string
  separador: string | null
  separador_custom: string | null
  linha_cabecalho: number | null
  primeira_linha_dados: number | null
  aba_excel: string | null
  encoding: string
  grupo_produto_fixo_id: string | null
  produto_fixo_id: string | null
  extensoes_esperadas: string[] | null
  padrao_nome_arquivo: string | null
  texto_cabecalho: string | null
  observacoes: string | null
  status: string
  mapeamentos: Array<{ campo_sistema: string; coluna_arquivo: string; formato_data: string | null }>
}

type Props = {
  seguradoras: Seguradora[]
  grupos: GrupoProduto[]
  produtos: Produto[]
  layout?: LayoutExistente
}

const CAMPOS_SISTEMA = [
  // Identificação
  { value: 'referencia',          label: 'Referência / Nº Apólice',  isDate: false, group: 'Identificação' },
  { value: 'nome_segurado',       label: 'Nome do Segurado',          isDate: false, group: 'Identificação' },
  { value: 'cpf_segurado',        label: 'CPF do Segurado',           isDate: false, group: 'Identificação' },
  { value: 'data_competencia',    label: 'Data de Competência',       isDate: true,  group: 'Identificação' },
  { value: 'grupo_produto',       label: 'Grupo / Ramo',              isDate: false, group: 'Identificação' },
  { value: 'produto',             label: 'Produto',                   isDate: false, group: 'Identificação' },
  // Valores base
  { value: 'valor_base',          label: 'Valor Base (prêmio)',       isDate: false, group: 'Valores' },
  { value: 'parcela_comissionada',label: 'Parcela Comissionada',      isDate: false, group: 'Valores' },
  // Comissão (carteira)
  { value: 'valor_bruto',         label: 'Valor Comissão (carteira)', isDate: false, group: 'Comissão' },
  { value: 'pct_comissao',        label: '% Comissão (carteira)',     isDate: false, group: 'Comissão' },
  // Angariação
  { value: 'valor_angariacao',    label: 'Valor Angariação',          isDate: false, group: 'Angariação' },
  { value: 'pct_angariacao',      label: '% Angariação',              isDate: false, group: 'Angariação' },
  // Vitalício
  { value: 'valor_vitalicio',     label: 'Valor Vitalício',           isDate: false, group: 'Vitalício' },
  { value: 'pct_vitalicio',       label: '% Vitalício',               isDate: false, group: 'Vitalício' },
  // Estorno
  { value: 'valor_estorno',       label: 'Valor Estorno',             isDate: false, group: 'Estorno' },
  { value: 'pct_estorno',         label: '% Estorno',                 isDate: false, group: 'Estorno' },
  // Incentivo
  { value: 'valor_incentivo',     label: 'Valor Incentivo',           isDate: false, group: 'Incentivo' },
  { value: 'pct_incentivo',       label: '% Incentivo',               isDate: false, group: 'Incentivo' },
  // Bonificação
  { value: 'valor_bonificacao',   label: 'Valor Bonificação',         isDate: false, group: 'Bonificação' },
  { value: 'pct_bonificacao',     label: '% Bonificação',             isDate: false, group: 'Bonificação' },
]

const SEPARADORES = [
  { value: 'tab',    label: 'TAB' },
  { value: ';',      label: 'Ponto e vírgula  ;' },
  { value: ',',      label: 'Vírgula  ,' },
  { value: '#',      label: 'Cerquilha  #' },
  { value: '|',      label: 'Pipe  |' },
  { value: 'custom', label: 'Outro (informar)' },
]

export function LayoutForm({ seguradoras, grupos, produtos, layout }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  const [seguradoraId, setSeguradoraId] = useState(layout?.seguradora_id ?? '')
  const [nome, setNome] = useState(layout?.nome ?? '')
  const [formato, setFormato] = useState(layout?.formato ?? 'csv')
  const [separador, setSeparador] = useState(layout?.separador ?? ';')
  const [separadorCustom, setSeparadorCustom] = useState(layout?.separador_custom ?? '')
  const [linhaCabecalho, setLinhaCabecalho] = useState<string>(
    layout?.linha_cabecalho != null ? String(layout.linha_cabecalho) : '1'
  )
  const [primeiraLinhaDados, setPrimeiraLinhaDados] = useState<string>(
    layout?.primeira_linha_dados != null ? String(layout.primeira_linha_dados) : '2'
  )
  const [abaExcel, setAbaExcel] = useState(layout?.aba_excel ?? '')
  const [encoding, setEncoding] = useState(layout?.encoding ?? 'auto')
  const [grupoProdutoFixoId, setGrupoProdutoFixoId] = useState(layout?.grupo_produto_fixo_id ?? '')
  const [produtoFixoId, setProdutoFixoId] = useState(layout?.produto_fixo_id ?? '')
  const [extsEsperadas, setExtsEsperadas] = useState(
    (layout?.extensoes_esperadas ?? []).join(', ')
  )
  const [padraoNome, setPadraoNome] = useState(layout?.padrao_nome_arquivo ?? '')
  const [textoCabecalho, setTextoCabecalho] = useState(layout?.texto_cabecalho ?? '')
  const [observacoes, setObservacoes] = useState(layout?.observacoes ?? '')

  const [mapeamentos, setMapeamentos] = useState<Record<string, MapeamentoInput>>(
    () => {
      const m: Record<string, MapeamentoInput> = {}
      for (const c of CAMPOS_SISTEMA) {
        const existing = layout?.mapeamentos?.find((x) => x.campo_sistema === c.value)
        m[c.value] = {
          campo_sistema: c.value,
          coluna_arquivo: existing?.coluna_arquivo ?? '',
          formato_data: existing?.formato_data ?? (c.isDate ? 'DD/MM/YYYY' : undefined),
        }
      }
      return m
    }
  )

  const produtosFiltrados = grupoProdutoFixoId
    ? produtos.filter((p) => p.grupo_produto_id === grupoProdutoFixoId)
    : produtos

  const isTextoCsv = formato === 'txt' || formato === 'csv'
  const isXlsx = formato === 'xlsx'

  function setMapField(campo: string, field: 'coluna_arquivo' | 'formato_data', value: string) {
    setMapeamentos((prev) => ({
      ...prev,
      [campo]: { ...prev[campo], [field]: value },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const mapeamentosAtivos = Object.values(mapeamentos).filter(
      (m) => m.coluna_arquivo.trim() !== ''
    )

    const input = {
      seguradora_id: seguradoraId,
      nome: nome.trim(),
      formato,
      separador: isTextoCsv ? separador : undefined,
      separador_custom: isTextoCsv && separador === 'custom' ? separadorCustom : undefined,
      linha_cabecalho: linhaCabecalho ? parseInt(linhaCabecalho) : null,
      primeira_linha_dados: primeiraLinhaDados ? parseInt(primeiraLinhaDados) : null,
      aba_excel: isXlsx ? abaExcel || undefined : undefined,
      encoding,
      grupo_produto_fixo_id: grupoProdutoFixoId || null,
      produto_fixo_id: produtoFixoId || null,
      extensoes_esperadas: extsEsperadas
        ? extsEsperadas.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      padrao_nome_arquivo: padraoNome || undefined,
      texto_cabecalho: textoCabecalho || undefined,
      observacoes: observacoes || undefined,
      mapeamentos: mapeamentosAtivos,
    }

    startTransition(async () => {
      const result = layout
        ? await atualizarLayout(layout.id, input)
        : await criarLayout(input)

      if (result.error) {
        setErro(result.error)
        return
      }

      router.push('/admin/layouts')
    })
  }

  async function handleStatus(status: 'ativo' | 'inativo' | 'arquivado') {
    if (!layout) return
    startTransition(async () => {
      const result = await alterarStatusLayout(layout.id, status)
      if (result.error) setErro(result.error)
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Identificação */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Identificação
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Seguradora *</label>
            <select
              value={seguradoraId}
              onChange={(e) => setSeguradoraId(e.target.value)}
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
            <label className={labelCls}>Nome do layout *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="ex: Padrão TXT Mensal"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Formato do arquivo */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Formato do Arquivo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Formato *</label>
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              className={inputCls}
            >
              <option value="csv">CSV</option>
              <option value="txt">TXT (texto delimitado)</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pdf_digital">PDF digital</option>
              <option value="pdf_scan">PDF digitalizado (scan)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Encoding</label>
            <select
              value={encoding}
              onChange={(e) => setEncoding(e.target.value)}
              className={inputCls}
            >
              <option value="auto">Automático</option>
              <option value="utf8">UTF-8</option>
              <option value="latin1">Latin-1 / ISO-8859-1</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Linha do cabeçalho</label>
            <input
              type="number"
              min={1}
              value={linhaCabecalho}
              onChange={(e) => setLinhaCabecalho(e.target.value)}
              placeholder="1"
              className={inputCls}
            />
          </div>
        </div>

        {isTextoCsv && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Separador de colunas</label>
              <select
                value={separador}
                onChange={(e) => setSeparador(e.target.value)}
                className={inputCls}
              >
                {SEPARADORES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {separador === 'custom' && (
              <div>
                <label className={labelCls}>Separador personalizado</label>
                <input
                  value={separadorCustom}
                  onChange={(e) => setSeparadorCustom(e.target.value)}
                  maxLength={5}
                  placeholder="ex: ||"
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>1ª linha de dados</label>
              <input
                type="number"
                min={1}
                value={primeiraLinhaDados}
                onChange={(e) => setPrimeiraLinhaDados(e.target.value)}
                placeholder="2"
                className={inputCls}
              />
            </div>
          </div>
        )}

        {isXlsx && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Aba do Excel (nome ou índice)</label>
              <input
                value={abaExcel}
                onChange={(e) => setAbaExcel(e.target.value)}
                placeholder="ex: Plan1 ou 0"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>1ª linha de dados</label>
              <input
                type="number"
                min={1}
                value={primeiraLinhaDados}
                onChange={(e) => setPrimeiraLinhaDados(e.target.value)}
                placeholder="2"
                className={inputCls}
              />
            </div>
          </div>
        )}
      </section>

      {/* Mapeamento de colunas */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Mapeamento de Colunas
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Informe o nome ou índice (0, 1, 2…) da coluna no arquivo para cada campo. Deixe em branco os campos que o arquivo não possui.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs text-gray-500 font-medium w-1/3">
                  Campo no sistema
                </th>
                <th className="text-left py-2 text-xs text-gray-500 font-medium w-1/3">
                  Coluna no arquivo
                </th>
                <th className="text-left py-2 text-xs text-gray-500 font-medium w-1/3">
                  Formato da data
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const groups = [...new Set(CAMPOS_SISTEMA.map((c) => c.group))]
                return groups.map((g) => (
                  <>
                    <tr key={`g-${g}`}>
                      <td
                        colSpan={3}
                        className="pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {g}
                      </td>
                    </tr>
                    {CAMPOS_SISTEMA.filter((c) => c.group === g).map((c) => (
                      <tr key={c.value} className="border-t border-gray-50">
                        <td className="py-2 pr-4 text-gray-700">{c.label}</td>
                        <td className="py-2 pr-4">
                          <input
                            value={mapeamentos[c.value]?.coluna_arquivo ?? ''}
                            onChange={(e) => setMapField(c.value, 'coluna_arquivo', e.target.value)}
                            placeholder="nome ou índice"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
                          />
                        </td>
                        <td className="py-2">
                          {c.isDate ? (
                            <select
                              value={mapeamentos[c.value]?.formato_data ?? 'DD/MM/YYYY'}
                              onChange={(e) => setMapField(c.value, 'formato_data', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B7291]/30"
                            >
                              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                              <option value="MM/YYYY">MM/YYYY</option>
                              <option value="YYYYMM">YYYYMM (ex: 202605)</option>
                              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                              <option value="YYYYMMDD">YYYYMMDD</option>
                            </select>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </section>

      {/* Produto fixo */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Produto Fixo (opcional)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Use quando o relatório da seguradora não informa o produto — todas as linhas serão associadas ao produto abaixo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Grupo de produto</label>
            <select
              value={grupoProdutoFixoId}
              onChange={(e) => {
                setGrupoProdutoFixoId(e.target.value)
                setProdutoFixoId('')
              }}
              className={inputCls}
            >
              <option value="">Nenhum (produto informado no arquivo)</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Produto</label>
            <select
              value={produtoFixoId}
              onChange={(e) => setProdutoFixoId(e.target.value)}
              disabled={!grupoProdutoFixoId}
              className={inputCls}
            >
              <option value="">Nenhum</option>
              {produtosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Identificação automática */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Identificação Automática (opcional)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Se preenchido, o sistema tentará reconhecer automaticamente qual layout usar ao importar um arquivo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Extensões esperadas</label>
            <input
              value={extsEsperadas}
              onChange={(e) => setExtsEsperadas(e.target.value)}
              placeholder=".txt, .csv"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">Separe por vírgula</p>
          </div>
          <div>
            <label className={labelCls}>Padrão do nome do arquivo</label>
            <input
              value={padraoNome}
              onChange={(e) => setPadraoNome(e.target.value)}
              placeholder="ex: AKAD_*.txt"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">Use * como curinga</p>
          </div>
          <div>
            <label className={labelCls}>Texto obrigatório no conteúdo</label>
            <input
              value={textoCabecalho}
              onChange={(e) => setTextoCabecalho(e.target.value)}
              placeholder="ex: RELATORIO DE COMISSOES"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">Deve aparecer nas primeiras linhas</p>
          </div>
        </div>
      </section>

      {/* Observações */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Observações
        </h2>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Notas internas sobre este layout..."
          className={inputCls}
        />
      </section>

      {erro && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {erro}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {layout && layout.status === 'ativo' && (
            <button
              type="button"
              onClick={() => handleStatus('inativo')}
              disabled={pending}
              className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Desativar
            </button>
          )}
          {layout && layout.status === 'inativo' && (
            <button
              type="button"
              onClick={() => handleStatus('ativo')}
              disabled={pending}
              className="px-4 py-2 text-sm border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              Reativar
            </button>
          )}
          {layout && layout.status !== 'arquivado' && (
            <button
              type="button"
              onClick={() => handleStatus('arquivado')}
              disabled={pending}
              className="px-4 py-2 text-sm border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
            >
              Arquivar
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/layouts')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2 text-sm bg-[#5B7291] text-white rounded-lg hover:bg-[#4a6080] transition-colors disabled:opacity-50"
          >
            {pending ? 'Salvando...' : layout ? 'Salvar alterações' : 'Criar layout'}
          </button>
        </div>
      </div>
    </form>
  )
}
