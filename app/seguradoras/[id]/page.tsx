import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { DetalheImportacao } from './components/detalhe-importacao'

function formatCompetencia(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default async function DetalheImportacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (!['bpo_admin', 'bpo_operador', 'bpo_visualizador'].includes(session.role)) {
    redirect('/acesso-negado')
  }

  const { id } = await params
  const canEdit = ['bpo_admin', 'bpo_operador'].includes(session.role)

  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [impRes, linhasRes, gruposRes, produtosRes] = await Promise.all([
    db
      .from('importacoes')
      .select(`
        id, status, total_linhas, total_ok, total_pendentes, valor_total,
        nome_arquivo, competencia, dia_pagamento, confirmado_em,
        seguradora:seguradora_id (nome_fantasia, nome),
        layout:layout_id (nome)
      `)
      .eq('id', id)
      .single(),
    db
      .from('importacao_linhas')
      .select(`
        id, referencia, nome_segurado, cpf_segurado, tipo_valor, valor,
        status_linha, texto_produto_raw, grupo_produto_id, produto_id,
        grupo_produto:grupo_produto_id (nome),
        produto:produto_id (nome)
      `)
      .eq('importacao_id', id)
      .order('status_linha', { ascending: false })
      .order('referencia'),
    db.from('grupos_produto').select('id, nome').eq('status', 'ativo').order('nome'),
    db.from('produtos').select('id, nome, grupo_produto_id').eq('status', 'ativo').order('nome'),
  ])

  if (!impRes.data) notFound()

  const imp = impRes.data as any
  const nav = getNavForRole(session.role)

  return (
    <AppLayout
      session={session}
      nav={nav}
      breadcrumb={[
        { label: 'Relatórios de Seguradoras', href: '/seguradoras?aba=historico' },
        { label: `${imp.seguradora?.nome_fantasia ?? imp.seguradora?.nome} — ${formatCompetencia(imp.competencia)}` },
      ]}
    >
      <div className="max-w-5xl flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {imp.seguradora?.nome_fantasia ?? imp.seguradora?.nome}
            </h1>
            <p className="text-sm text-gray-500 mt-1 capitalize">
              {formatCompetencia(imp.competencia)}
              {imp.layout?.nome && ` · Layout: ${imp.layout.nome}`}
              {imp.dia_pagamento && ` · Pagamento dia ${imp.dia_pagamento}`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{imp.nome_arquivo}</p>
          </div>
          <Link
            href="/seguradoras?aba=historico"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Voltar
          </Link>
        </div>

        <DetalheImportacao
          importacao={imp}
          linhas={(linhasRes.data ?? []) as any}
          grupos={gruposRes.data ?? []}
          produtos={produtosRes.data ?? []}
          canEdit={canEdit}
        />
      </div>
    </AppLayout>
  )
}
