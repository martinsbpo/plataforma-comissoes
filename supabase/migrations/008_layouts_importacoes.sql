-- ============================================================
-- E2.S3 + E3 — Layouts de Importação e Importações
-- ============================================================

-- Layout de importação de cada seguradora
create table if not exists public.seguradora_layouts (
  id                    uuid primary key default gen_random_uuid(),
  seguradora_id         uuid not null references public.seguradoras(id) on delete cascade,
  nome                  text not null,
  formato               text not null check (formato in ('txt', 'csv', 'xlsx', 'pdf_digital', 'pdf_scan')),
  separador             text,                    -- tab, ;, ,, #, |, ou custom
  separador_custom      text,                    -- quando separador = 'custom'
  linha_cabecalho       integer,                 -- número da linha do cabeçalho
  primeira_linha_dados  integer,                 -- número da primeira linha de dados
  aba_excel             text,                    -- nome ou índice da aba (XLSX)
  encoding              text default 'auto' check (encoding in ('utf8', 'latin1', 'auto')),
  -- Produto/grupo fixos (quando relatório não informa)
  grupo_produto_fixo_id uuid references public.grupos_produto(id),
  produto_fixo_id       uuid references public.produtos(id),
  -- Regras de identificação automática
  extensoes_esperadas   text[],                  -- ex: ['.txt', '.csv']
  padrao_nome_arquivo   text,                    -- wildcard: 'AKAD_*.txt'
  texto_cabecalho       text,                    -- texto obrigatório no conteúdo
  -- Versionamento
  versao                integer not null default 1,
  versao_anterior_id    uuid references public.seguradora_layouts(id),
  status                text not null default 'ativo' check (status in ('ativo', 'inativo', 'arquivado')),
  observacoes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Mapeamento de colunas do layout
create table if not exists public.layout_mapeamentos (
  id            uuid primary key default gen_random_uuid(),
  layout_id     uuid not null references public.seguradora_layouts(id) on delete cascade,
  campo_sistema text not null check (campo_sistema in (
    'referencia', 'nome_segurado', 'cpf_segurado',
    'data_competencia', 'grupo_produto', 'produto',
    'valor_base', 'pct_comissao',
    'valor_angariacao', 'valor_vitalicio',
    'valor_bruto', 'valor_estorno'
  )),
  coluna_arquivo text not null,   -- nome ou índice (ex: 'COMISSAO' ou '5')
  formato_data   text,            -- ex: 'DD/MM/YYYY', 'YYYY-MM-DD'
  unique (layout_id, campo_sistema)
);

-- Importações (cabeçalho de cada arquivo importado)
create table if not exists public.importacoes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  seguradora_id   uuid not null references public.seguradoras(id) on delete restrict,
  layout_id       uuid references public.seguradora_layouts(id) on delete restrict,
  competencia     date not null,             -- primeiro dia do mês
  dia_pagamento   integer,                   -- opcional (1-31)
  nome_arquivo    text not null,
  hash_arquivo    text not null,             -- SHA-256 do conteúdo
  storage_path    text,                      -- caminho no Supabase Storage
  formato         text not null,
  total_linhas    integer not null default 0,
  total_ok        integer not null default 0,
  total_pendentes integer not null default 0,
  valor_total     numeric(14,2) not null default 0,
  status          text not null default 'pendente' check (status in (
    'pendente', 'confirmada', 'com_estorno', 'manual'
  )),
  confirmado_por  uuid references public.users(id),
  confirmado_em   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, seguradora_id, competencia, hash_arquivo)
);

-- Linhas da importação (base de produção — uma linha por tipo financeiro)
create table if not exists public.importacao_linhas (
  id                  uuid primary key default gen_random_uuid(),
  importacao_id       uuid not null references public.importacoes(id) on delete cascade,
  referencia          text not null,          -- identificador da apólice no relatório
  nome_segurado       text not null,
  cpf_segurado        text,
  data_competencia    date,
  grupo_produto_id    uuid references public.grupos_produto(id),
  produto_id          uuid references public.produtos(id),
  tipo_valor          text not null check (tipo_valor in (
    'angariacao', 'vitalicio', 'comissao', 'estorno'
  )),
  valor               numeric(14,2) not null,
  valor_base          numeric(14,2),
  pct_comissao        numeric(5,2),
  status_linha        text not null default 'ok' check (status_linha in (
    'ok', 'nao_mapeado', 'divergencia', 'manual'
  )),
  texto_produto_raw   text,                   -- texto original do relatório (para de-para)
  observacoes         text,
  estorno_manual      boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.seguradora_layouts enable row level security;
alter table public.layout_mapeamentos enable row level security;
alter table public.importacoes enable row level security;
alter table public.importacao_linhas enable row level security;

-- Layouts: todos autenticados lêem; bpo_admin gerencia
create policy "layouts: leitura autenticados" on public.seguradora_layouts
  for select using (
    exists (select 1 from public.user_tenant_links where user_id = auth.uid() and status = 'ativo')
  );

create policy "layouts: bpo_admin gerencia" on public.seguradora_layouts
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

create policy "layout_mapeamentos: leitura autenticados" on public.layout_mapeamentos
  for select using (
    exists (select 1 from public.user_tenant_links where user_id = auth.uid() and status = 'ativo')
  );

create policy "layout_mapeamentos: bpo_admin gerencia" on public.layout_mapeamentos
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

-- Importações: bpo vê todas; corretora vê as suas
create policy "importacoes: bpo le todas" on public.importacoes
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador')
    )
  );

create policy "importacoes: bpo gerencia" on public.importacoes
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador')
    )
  );

create policy "importacao_linhas: bpo le todas" on public.importacao_linhas
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador')
    )
  );

create policy "importacao_linhas: bpo gerencia" on public.importacao_linhas
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador')
    )
  );

-- Storage bucket para arquivos importados
insert into storage.buckets (id, name, public)
values ('importacoes', 'importacoes', false)
on conflict (id) do nothing;

create policy "importacoes storage: bpo acessa" on storage.objects
  for all using (
    bucket_id = 'importacoes'
    and exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador')
    )
  );
