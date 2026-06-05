import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { getSession } from '@/lib/auth'
import { parseArquivo } from '@/lib/importacao/parser'

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['bpo_admin', 'bpo_operador'].includes(session.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const formData = await req.formData()
  const arquivo = formData.get('arquivo') as File | null
  const layoutId = formData.get('layout_id') as string | null
  const seguradoraId = formData.get('seguradora_id') as string | null
  const competencia = formData.get('competencia') as string | null  // YYYY-MM-DD
  const diaPagamento = formData.get('dia_pagamento') as string | null
  const force = formData.get('force') === 'true'

  if (!arquivo || !layoutId || !seguradoraId || !competencia) {
    return NextResponse.json({ error: 'Campos obrigatórios: arquivo, layout_id, seguradora_id, competencia' }, { status: 400 })
  }

  const db = adminDb()

  // Buscar layout e mapeamentos
  const { data: layout, error: layoutErr } = await db
    .from('seguradora_layouts')
    .select('*, mapeamentos:layout_mapeamentos(*)')
    .eq('id', layoutId)
    .single()

  if (layoutErr || !layout) {
    return NextResponse.json({ error: 'Layout não encontrado' }, { status: 404 })
  }

  // Ler arquivo
  const arrayBuffer = await arquivo.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Hash para evitar duplicatas
  const hashArquivo = createHash('sha256').update(buffer).digest('hex')

  // Verificar duplicata
  const { data: existente } = await db
    .from('importacoes')
    .select('id, status')
    .eq('tenant_id', session.tenantId)
    .eq('seguradora_id', seguradoraId)
    .eq('hash_arquivo', hashArquivo)
    .single()

  if (existente) {
    return NextResponse.json(
      { error: 'Este arquivo já foi importado anteriormente.', importacao_id: existente.id },
      { status: 409 }
    )
  }

  // Processar arquivo antes do upload para detectar divergências
  let linhasParseadas: Awaited<ReturnType<typeof parseArquivo>>
  try {
    linhasParseadas = await parseArquivo(buffer, {
      formato: layout.formato,
      separador: layout.separador,
      separador_custom: layout.separador_custom,
      linha_cabecalho: layout.linha_cabecalho,
      primeira_linha_dados: layout.primeira_linha_dados,
      aba_excel: layout.aba_excel,
      encoding: layout.encoding,
      mapeamentos: layout.mapeamentos,
    })
  } catch (parseErr: unknown) {
    return NextResponse.json({ error: `Erro ao processar arquivo: ${String(parseErr)}` }, { status: 422 })
  }

  // Verificar divergência de competência
  const mesDeclarado = competencia.slice(0, 7) // YYYY-MM
  const linhasDivergentes = linhasParseadas.filter(
    (l) => l.data_competencia && !l.data_competencia.startsWith(mesDeclarado)
  )

  if (linhasDivergentes.length > 0 && !force) {
    // Coletar competências distintas encontradas no arquivo
    const competenciasNoArquivo = [...new Set(
      linhasDivergentes
        .map((l) => l.data_competencia?.slice(0, 7))
        .filter(Boolean)
    )]
    return NextResponse.json({
      aviso_competencia: true,
      total_divergentes: linhasDivergentes.length,
      total_linhas: linhasParseadas.length,
      competencia_declarada: mesDeclarado,
      competencias_no_arquivo: competenciasNoArquivo,
    }, { status: 200 })
  }

  // Fazer upload para Storage
  const storagePath = `${session.tenantId}/${seguradoraId}/${competencia}/${Date.now()}_${arquivo.name}`
  const { error: uploadError } = await db.storage
    .from('importacoes')
    .upload(storagePath, buffer, { contentType: arquivo.type || 'application/octet-stream' })

  if (uploadError) {
    return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 })
  }

  // Buscar de-para de produtos para esta seguradora
  const { data: depara } = await db
    .from('produto_depara')
    .select('texto_relatorio, produto_id, grupo_produto_id')
    .eq('seguradora_id', seguradoraId)

  const deparaMap = new Map(
    (depara ?? []).map((d) => [d.texto_relatorio.toUpperCase(), d])
  )

  // Criar registro de importação
  const { data: importacao, error: impErr } = await db
    .from('importacoes')
    .insert({
      tenant_id: session.tenantId,
      seguradora_id: seguradoraId,
      layout_id: layoutId,
      competencia,
      dia_pagamento: diaPagamento ? parseInt(diaPagamento) : null,
      nome_arquivo: arquivo.name,
      hash_arquivo: hashArquivo,
      storage_path: storagePath,
      formato: layout.formato,
      total_linhas: linhasParseadas.length,
      status: 'pendente',
    })
    .select('id')
    .single()

  if (impErr || !importacao) {
    await db.storage.from('importacoes').remove([storagePath])
    return NextResponse.json({ error: impErr?.message ?? 'Erro ao criar importação' }, { status: 500 })
  }

  // Inserir linhas
  type TipoValor = 'angariacao' | 'vitalicio' | 'comissao' | 'estorno' | 'incentivo' | 'bonificacao'

  // Mapa tipo → pct correspondente
  function getPct(linha: typeof linhasParseadas[0], tipo: TipoValor): number | null {
    if (tipo === 'angariacao')   return linha.pct_angariacao ?? null
    if (tipo === 'vitalicio')    return linha.pct_vitalicio ?? null
    if (tipo === 'comissao')     return linha.pct_comissao ?? null
    if (tipo === 'estorno')      return linha.pct_estorno ?? null
    if (tipo === 'incentivo')    return linha.pct_incentivo ?? null
    if (tipo === 'bonificacao')  return linha.pct_bonificacao ?? null
    return null
  }

  const linhasDb = []
  let totalOk = 0
  let totalPendentes = 0
  let valorTotal = 0

  for (const linha of linhasParseadas) {
    const produtoRawUp = linha.produto_raw?.toUpperCase()
    const deParaMatch = produtoRawUp ? deparaMap.get(produtoRawUp) : null

    const grupoProdutoId = deParaMatch?.grupo_produto_id ?? layout.grupo_produto_fixo_id ?? null
    const produtoId = deParaMatch?.produto_id ?? layout.produto_fixo_id ?? null

    const statusLinha =
      !grupoProdutoId || !produtoId
        ? 'nao_mapeado'
        : 'ok'

    // Todos os tipos de valor mapeados na linha
    const tiposValores: Array<[TipoValor, number | undefined]> = [
      ['angariacao',  linha.valor_angariacao],
      ['vitalicio',   linha.valor_vitalicio],
      ['estorno',     linha.valor_estorno],
      ['incentivo',   linha.valor_incentivo],
      ['bonificacao', linha.valor_bonificacao],
    ]

    const temEspecificos = tiposValores.some(([, v]) => v !== undefined && v !== 0)

    if (temEspecificos) {
      for (const [tipo, valor] of tiposValores) {
        if (valor === undefined || valor === 0) continue
        const isEstorno = tipo === 'estorno'
        linhasDb.push({
          importacao_id: importacao.id,
          referencia: linha.referencia,
          nome_segurado: linha.nome_segurado,
          cpf_segurado: linha.cpf_segurado ?? null,
          data_competencia: linha.data_competencia ?? competencia,
          grupo_produto_id: grupoProdutoId,
          produto_id: produtoId,
          tipo_valor: tipo,
          valor,
          valor_base: linha.valor_base ?? null,
          parcela_comissionada: linha.parcela_comissionada ?? null,
          pct_comissao: getPct(linha, tipo),
          status_linha: isEstorno ? 'ok' : statusLinha,
          texto_produto_raw: linha.produto_raw ?? null,
          estorno_manual: false,
        })
        if (isEstorno) valorTotal -= valor
        else valorTotal += valor
        if (statusLinha === 'ok' || isEstorno) totalOk++
        else totalPendentes++
      }
    } else {
      const valor = linha.valor_bruto ?? 0
      linhasDb.push({
        importacao_id: importacao.id,
        referencia: linha.referencia,
        nome_segurado: linha.nome_segurado,
        cpf_segurado: linha.cpf_segurado ?? null,
        data_competencia: linha.data_competencia ?? competencia,
        grupo_produto_id: grupoProdutoId,
        produto_id: produtoId,
        tipo_valor: 'comissao' as TipoValor,
        valor,
        valor_base: linha.valor_base ?? null,
        parcela_comissionada: linha.parcela_comissionada ?? null,
        pct_comissao: linha.pct_comissao ?? null,
        status_linha: statusLinha,
        texto_produto_raw: linha.produto_raw ?? null,
        estorno_manual: false,
      })
      valorTotal += valor
      if (statusLinha === 'ok') totalOk++
      else totalPendentes++
    }
  }

  if (linhasDb.length > 0) {
    const { error: linesErr } = await db.from('importacao_linhas').insert(linhasDb)
    if (linesErr) {
      await db.from('importacoes').delete().eq('id', importacao.id)
      await db.storage.from('importacoes').remove([storagePath])
      return NextResponse.json({ error: linesErr.message }, { status: 500 })
    }
  }

  // Atualizar totais
  await db.from('importacoes').update({
    total_linhas: linhasParseadas.length,
    total_ok: totalOk,
    total_pendentes: totalPendentes,
    valor_total: valorTotal,
    updated_at: new Date().toISOString(),
  }).eq('id', importacao.id)

  return NextResponse.json({
    importacao_id: importacao.id,
    total_linhas: linhasParseadas.length,
    total_ok: totalOk,
    total_pendentes: totalPendentes,
    valor_total: valorTotal,
  })
}
