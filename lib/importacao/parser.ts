import * as XLSX from 'xlsx'
import iconv from 'iconv-lite'
import type { MapeamentoInput } from '@/app/admin/layouts/actions'

export type LinhaParseada = {
  referencia: string
  nome_segurado: string
  cpf_segurado?: string
  data_competencia?: string        // ISO YYYY-MM-DD
  grupo_produto_raw?: string
  produto_raw?: string
  valor_base?: number
  parcela_comissionada?: number
  // Valores por tipo
  valor_angariacao?: number
  pct_angariacao?: number
  valor_vitalicio?: number
  pct_vitalicio?: number
  valor_bruto?: number             // comissão carteira
  pct_comissao?: number
  valor_estorno?: number
  pct_estorno?: number
  valor_incentivo?: number
  pct_incentivo?: number
  valor_bonificacao?: number
  pct_bonificacao?: number
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
  const fmt = (formato ?? 'DD/MM/YYYY').trim()
  const s = raw.trim()

  if (fmt === 'DD/MM/YYYY') {
    const [d, m, y] = s.split('/')
    if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (fmt === 'MM/YYYY') {
    const [m, y] = s.split('/')
    if (m && y) return `${y}-${m.padStart(2, '0')}-01`
  }
  if (fmt === 'YYYYMM' && s.length === 6) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-01`
  }
  if (fmt === 'YYYY-MM-DD') return s
  if (fmt === 'YYYYMMDD' && s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  // fallback ISO
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return undefined
}

function parseNumber(raw: string): number | undefined {
  if (!raw || raw.trim() === '') return undefined
  let s = raw.trim().replace(/R\$\s*/g, '').replace('%', '').trim()
  if (!s) return undefined

  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // Formato brasileiro: 1.007,12 → remover ponto de milhar, trocar vírgula
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // Só vírgula: 204,97
    s = s.replace(',', '.')
  }
  // Só ponto (ex: 20.00 da Icatu) ou sem separador → já está correto

  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

function getColuna(row: string[], headers: string[], coluna_arquivo: string): string {
  const idx = parseInt(coluna_arquivo)
  if (!isNaN(idx)) return row[idx] ?? ''
  const hi = headers.findIndex(
    (h) => h.trim().toUpperCase() === coluna_arquivo.trim().toUpperCase()
  )
  if (hi >= 0) return row[hi] ?? ''
  return ''
}

function mapRow(
  row: string[],
  headers: string[],
  mapeamentos: MapeamentoInput[],
  linhaOriginal: number
): LinhaParseada {
  const get = (campo: string): string => {
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
    parcela_comissionada: parseNumber(get('parcela_comissionada')),
    valor_angariacao: parseNumber(get('valor_angariacao')),
    pct_angariacao: parseNumber(get('pct_angariacao')),
    valor_vitalicio: parseNumber(get('valor_vitalicio')),
    pct_vitalicio: parseNumber(get('pct_vitalicio')),
    valor_bruto: parseNumber(get('valor_bruto')),
    pct_comissao: parseNumber(get('pct_comissao')),
    valor_estorno: parseNumber(get('valor_estorno')),
    pct_estorno: parseNumber(get('pct_estorno')),
    valor_incentivo: parseNumber(get('valor_incentivo')),
    pct_incentivo: parseNumber(get('pct_incentivo')),
    valor_bonificacao: parseNumber(get('valor_bonificacao')),
    pct_bonificacao: parseNumber(get('pct_bonificacao')),
    linha_original: linhaOriginal,
  }
}

function stripBom(text: string): string {
  return text.replace(/^﻿/, '')
}

export async function parseArquivo(
  buffer: Buffer,
  layout: LayoutConfig
): Promise<LinhaParseada[]> {
  const fmt = layout.formato

  if (fmt === 'xlsx') return parseXlsx(buffer, layout)
  if (fmt === 'csv' || fmt === 'txt') return parseCsvTxt(buffer, layout)
  if (fmt === 'pdf_digital') return parsePdfDigital(buffer, layout)

  throw new Error(`Formato '${fmt}' não suportado nesta versão.`)
}

function parseCsvTxt(buffer: Buffer, layout: LayoutConfig): LinhaParseada[] {
  const enc = layout.encoding === 'latin1' ? 'latin1' : 'utf8'
  const text = stripBom(iconv.decode(buffer, enc))
  const sep = getSeparador(layout)
  const allLines = text.split(/\r?\n/)

  const cabecalhoIdx = (layout.linha_cabecalho ?? 1) - 1
  const dadosIdx = (layout.primeira_linha_dados ?? cabecalhoIdx + 2) - 1

  const headers = allLines[cabecalhoIdx]
    ? allLines[cabecalhoIdx].split(sep).map((h) => h.trim())
    : []

  const resultado: LinhaParseada[] = []

  for (let i = dadosIdx; i < allLines.length; i++) {
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
    ws = !isNaN(idx) ? wb.Sheets[wb.SheetNames[idx]] : wb.Sheets[layout.aba_excel]
  }
  ws = ws ?? wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Aba não encontrada no arquivo Excel.')

  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]

  const cabecalhoIdx = (layout.linha_cabecalho ?? 1) - 1
  const dadosIdx = (layout.primeira_linha_dados ?? cabecalhoIdx + 2) - 1

  const headers = (rows[cabecalhoIdx] ?? []).map((c) => String(c).trim())
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

  const sep = getSeparador(layout)
  const cabecalhoIdx = (layout.linha_cabecalho ?? 1) - 1
  const dadosIdx = (layout.primeira_linha_dados ?? cabecalhoIdx + 2) - 1
  const headers = lines[cabecalhoIdx] ? lines[cabecalhoIdx].split(sep).map((h: string) => h.trim()) : []

  const resultado: LinhaParseada[] = []
  for (let i = dadosIdx; i < lines.length; i++) {
    const row = lines[i].split(sep)
    const parsed = mapRow(row, headers, layout.mapeamentos, i + 1)
    if (parsed.erro === 'linha vazia') continue
    resultado.push(parsed)
  }

  return resultado
}
