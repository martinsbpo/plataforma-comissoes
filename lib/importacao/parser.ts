import * as XLSX from 'xlsx'
import iconv from 'iconv-lite'
import type { MapeamentoInput } from '@/app/admin/layouts/actions'

export type LinhaParseada = {
  referencia: string
  nome_segurado: string
  cpf_segurado?: string
  data_competencia?: string   // ISO YYYY-MM-DD
  grupo_produto_raw?: string
  produto_raw?: string
  valor_base?: number
  pct_comissao?: number
  valor_angariacao?: number
  valor_vitalicio?: number
  valor_bruto?: number
  valor_estorno?: number
  linha_original: number
  erro?: string
}

export type LayoutConfig = {
  formato: string
  separador?: string | null
  separador_custom?: string | null
  linha_cabecalho?: number | null
  primeira_linha_dados?: number | null
  aba_excel?: string | null
  encoding?: string | null
  mapeamentos: MapeamentoInput[]
}

function getSeparador(layout: LayoutConfig): string {
  if (layout.separador === 'tab') return '\t'
  if (layout.separador === 'custom') return layout.separador_custom ?? ','
  return layout.separador ?? ','
}

function parseDateToISO(raw: string, formato?: string | null): string | undefined {
  if (!raw || raw.trim() === '') return undefined
  const fmt = formato ?? 'DD/MM/YYYY'
  const s = raw.trim()

  if (fmt === 'DD/MM/YYYY') {
    const [d, m, y] = s.split('/')
    if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (fmt === 'MM/YYYY') {
    const [m, y] = s.split('/')
    if (m && y) return `${y}-${m.padStart(2, '0')}-01`
  }
  if (fmt === 'YYYY-MM-DD') return s
  if (fmt === 'YYYYMMDD' && s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  // fallback: tentar ISO
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return undefined
}

function parseNumber(raw: string): number | undefined {
  if (!raw || raw.trim() === '') return undefined
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}

function getColuna(row: string[], headers: string[], coluna_arquivo: string): string {
  const idx = parseInt(coluna_arquivo)
  if (!isNaN(idx)) return row[idx] ?? ''
  // busca por nome no cabeçalho
  const hi = headers.findIndex((h) => h.trim().toUpperCase() === coluna_arquivo.trim().toUpperCase())
  if (hi >= 0) return row[hi] ?? ''
  return ''
}

function mapRow(
  row: string[],
  headers: string[],
  mapeamentos: MapeamentoInput[],
  linhaOriginal: number
): LinhaParseada {
  const get = (campo: string) => {
    const m = mapeamentos.find((x) => x.campo_sistema === campo)
    if (!m || !m.coluna_arquivo) return ''
    return getColuna(row, headers, m.coluna_arquivo)
  }
  const getMap = (campo: string) => mapeamentos.find((x) => x.campo_sistema === campo)

  const referencia = get('referencia')
  const nome_segurado = get('nome_segurado')

  if (!referencia && !nome_segurado) {
    return { referencia: '', nome_segurado: '', linha_original: linhaOriginal, erro: 'linha vazia' }
  }

  const dtMap = getMap('data_competencia')
  const dataRaw = get('data_competencia')

  return {
    referencia: referencia || `L${linhaOriginal}`,
    nome_segurado: nome_segurado || 'N/D',
    cpf_segurado: get('cpf_segurado') || undefined,
    data_competencia: dataRaw ? parseDateToISO(dataRaw, dtMap?.formato_data) : undefined,
    grupo_produto_raw: get('grupo_produto') || undefined,
    produto_raw: get('produto') || undefined,
    valor_base: parseNumber(get('valor_base')),
    pct_comissao: parseNumber(get('pct_comissao')),
    valor_angariacao: parseNumber(get('valor_angariacao')),
    valor_vitalicio: parseNumber(get('valor_vitalicio')),
    valor_bruto: parseNumber(get('valor_bruto')),
    valor_estorno: parseNumber(get('valor_estorno')),
    linha_original: linhaOriginal,
  }
}

export async function parseArquivo(
  buffer: Buffer,
  layout: LayoutConfig
): Promise<LinhaParseada[]> {
  const fmt = layout.formato

  if (fmt === 'xlsx') {
    return parseXlsx(buffer, layout)
  }

  if (fmt === 'csv' || fmt === 'txt') {
    return parseCsvTxt(buffer, layout)
  }

  if (fmt === 'pdf_digital') {
    return parsePdfDigital(buffer, layout)
  }

  throw new Error(`Formato '${fmt}' não suportado nesta versão.`)
}

function parseCsvTxt(buffer: Buffer, layout: LayoutConfig): LinhaParseada[] {
  const encoding = layout.encoding === 'latin1' ? 'latin1' : 'utf8'
  const text = iconv.decode(buffer, encoding)
  const sep = getSeparador(layout)
  const allLines = text.split(/\r?\n/)

  const cabecalhoLinha = (layout.linha_cabecalho ?? 1) - 1
  const dadosLinha = (layout.primeira_linha_dados ?? cabecalhoLinha + 2) - 1

  const headers = allLines[cabecalhoLinha]
    ? allLines[cabecalhoLinha].split(sep)
    : []

  const resultado: LinhaParseada[] = []

  for (let i = dadosLinha; i < allLines.length; i++) {
    const line = allLines[i]
    if (!line || line.trim() === '') continue
    const row = line.split(sep)
    const parsed = mapRow(row, headers, layout.mapeamentos, i + 1)
    if (parsed.erro === 'linha vazia') continue
    resultado.push(parsed)
  }

  return resultado
}

function parseXlsx(buffer: Buffer, layout: LayoutConfig): LinhaParseada[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  let ws: XLSX.WorkSheet | undefined
  if (layout.aba_excel) {
    const idx = parseInt(layout.aba_excel)
    if (!isNaN(idx)) {
      ws = wb.Sheets[wb.SheetNames[idx]]
    } else {
      ws = wb.Sheets[layout.aba_excel]
    }
  }
  ws = ws ?? wb.Sheets[wb.SheetNames[0]]

  if (!ws) throw new Error('Aba não encontrada no arquivo Excel.')

  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]

  const cabecalhoIdx = (layout.linha_cabecalho ?? 1) - 1
  const dadosIdx = (layout.primeira_linha_dados ?? cabecalhoIdx + 2) - 1

  const headers = (rows[cabecalhoIdx] ?? []).map((c) => String(c))
  const resultado: LinhaParseada[] = []

  for (let i = dadosIdx; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? ''))
    const parsed = mapRow(row, headers, layout.mapeamentos, i + 1)
    if (parsed.erro === 'linha vazia') continue
    resultado.push(parsed)
  }

  return resultado
}

async function parsePdfDigital(buffer: Buffer, layout: LayoutConfig): Promise<LinhaParseada[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  const lines = data.text.split('\n').map((l: string) => l.trim()).filter(Boolean)

  // Para PDF digital, sem mapeamento de colunas convencionais:
  // tentamos detectar linhas de dados pelo padrão de campos mapeados
  // Esta é uma implementação de fallback — layouts PDF específicos precisam
  // de configuração customizada
  const sep = getSeparador(layout)
  const cabecalhoIdx = (layout.linha_cabecalho ?? 1) - 1
  const dadosIdx = (layout.primeira_linha_dados ?? cabecalhoIdx + 2) - 1
  const headers = lines[cabecalhoIdx] ? lines[cabecalhoIdx].split(sep) : []

  const resultado: LinhaParseada[] = []
  for (let i = dadosIdx; i < lines.length; i++) {
    const row = lines[i].split(sep)
    const parsed = mapRow(row, headers, layout.mapeamentos, i + 1)
    if (parsed.erro === 'linha vazia') continue
    resultado.push(parsed)
  }

  return resultado
}
