import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const seguradora = searchParams.get('seguradora')
  const parceiro = searchParams.get('parceiro')
  const q = searchParams.get('q')

  const db = admin()

  let query = db
    .from('producao')
    .select(`
      data, referencia, segurado, cpf_segurado, comissao,
      indicador_id, pct_indicador, corretor1_id, pct_corretor1,
      corretor2_id, pct_corretor2,
      seguradora:seguradora_id (nome_fantasia, nome),
      indicador:indicador_id (nome),
      corretor1:corretor1_id (nome),
      corretor2:corretor2_id (nome),
      grupo_produto:grupo_produto_id (nome),
      produto:produto_id (nome)
    `)
    .eq('tenant_id', session.tenantId)
    .order('data', { ascending: false })

  if (seguradora) query = query.eq('seguradora_id', seguradora)
  if (parceiro) query = query.or(`indicador_id.eq.${parceiro},corretor1_id.eq.${parceiro},corretor2_id.eq.${parceiro}`)
  if (q) query = query.or(`segurado.ilike.%${q}%,referencia.ilike.%${q}%,cpf_segurado.ilike.%${q}%`)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type SegRow = { nome_fantasia: string | null; nome: string } | { nome_fantasia: string | null; nome: string }[] | null
  type NomeRow = { nome: string } | { nome: string }[] | null

  const resolve = (v: SegRow | NomeRow) => {
    if (!v) return ''
    if (Array.isArray(v)) return (v[0] as { nome: string; nome_fantasia?: string | null })?.nome_fantasia ?? (v[0] as { nome: string })?.nome ?? ''
    return (v as { nome_fantasia?: string | null; nome: string }).nome_fantasia ?? (v as { nome: string }).nome ?? ''
  }

  const wsData = [
    ['DATA', 'SEGURADORA', 'REF SEGURADORA', 'SEGURADO', 'CPF DO SEGURADO',
     'GRUPO DE PRODUTO', 'PRODUTO', 'COMISSÃO ESPERADA',
     'INDICADOR', '% INDICADOR', 'CORRETOR1', '% CORRETOR1', 'CORRETOR2', '% CORRETOR2'],
    ...(rows ?? []).map(r => [
      fmtDate(r.data),
      resolve(r.seguradora as SegRow),
      r.referencia,
      r.segurado,
      r.cpf_segurado ?? '',
      resolve(r.grupo_produto as NomeRow),
      resolve(r.produto as NomeRow),
      r.comissao ?? '',
      resolve(r.indicador as NomeRow),
      r.pct_indicador != null ? r.pct_indicador / 100 : '',
      resolve(r.corretor1 as NomeRow),
      r.pct_corretor1 != null ? r.pct_corretor1 / 100 : '',
      resolve(r.corretor2 as NomeRow),
      r.pct_corretor2 != null ? r.pct_corretor2 / 100 : '',
    ]),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Formatação de células
  for (let row = 1; row < wsData.length; row++) {
    const moneyCell = XLSX.utils.encode_cell({ r: row, c: 7 })
    if (ws[moneyCell]?.v) ws[moneyCell].z = '#,##0.00'
    ;[9, 11, 13].forEach(col => {
      const cell = XLSX.utils.encode_cell({ r: row, c: col })
      if (ws[cell]?.v) ws[cell].z = '0.00%'
    })
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Produção')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const tenantSlug = session.tenantNome.slice(0, 20).toLowerCase().replace(/\s+/g, '_')
  const filename = `producao_${tenantSlug}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
