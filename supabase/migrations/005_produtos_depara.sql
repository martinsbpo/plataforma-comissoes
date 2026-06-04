-- ============================================================
-- E2.S4 — Grupos de Produto, Produtos e De-Para
-- ============================================================

-- Grupos de produto (catálogo interno)
create table if not exists public.grupos_produto (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  status     text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Produtos (vinculados a um grupo)
create table if not exists public.produtos (
  id               uuid primary key default gen_random_uuid(),
  grupo_produto_id uuid not null references public.grupos_produto(id) on delete restrict,
  nome             text not null,
  status           text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (grupo_produto_id, nome)
);

-- De-Para: texto/código no relatório da seguradora → grupo + produto interno
create table if not exists public.produto_depara (
  id               uuid primary key default gen_random_uuid(),
  seguradora_id    uuid not null references public.seguradoras(id) on delete cascade,
  texto_relatorio  text not null,
  grupo_produto_id uuid not null references public.grupos_produto(id) on delete restrict,
  produto_id       uuid not null references public.produtos(id) on delete restrict,
  observacoes      text,
  status           text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (seguradora_id, texto_relatorio)
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.grupos_produto enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_depara enable row level security;

-- Todos os autenticados lêem (catálogo global)
create policy "grupos_produto: leitura autenticados" on public.grupos_produto
  for select using (
    exists (select 1 from public.user_tenant_links where user_id = auth.uid() and status = 'ativo')
  );

create policy "grupos_produto: bpo_admin gerencia" on public.grupos_produto
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

create policy "produtos: leitura autenticados" on public.produtos
  for select using (
    exists (select 1 from public.user_tenant_links where user_id = auth.uid() and status = 'ativo')
  );

create policy "produtos: bpo_admin gerencia" on public.produtos
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

create policy "produto_depara: leitura autenticados" on public.produto_depara
  for select using (
    exists (select 1 from public.user_tenant_links where user_id = auth.uid() and status = 'ativo')
  );

create policy "produto_depara: bpo_admin gerencia" on public.produto_depara
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

-- ============================================================
-- Seed: grupos e produtos de partida
-- ============================================================

insert into public.grupos_produto (id, nome) values
  ('10000000-0000-0000-0000-000000000001', 'Vida e Previdência'),
  ('10000000-0000-0000-0000-000000000002', 'Saúde e Odonto'),
  ('10000000-0000-0000-0000-000000000003', 'Ramos Elementares'),
  ('10000000-0000-0000-0000-000000000004', 'Consórcio'),
  ('10000000-0000-0000-0000-000000000005', 'Viagem'),
  ('10000000-0000-0000-0000-000000000006', 'Crédito e Outros')
on conflict (nome) do nothing;

insert into public.produtos (grupo_produto_id, nome) values
  ('10000000-0000-0000-0000-000000000001', 'Vida Individual'),
  ('10000000-0000-0000-0000-000000000001', 'Vida em Grupo'),
  ('10000000-0000-0000-0000-000000000001', 'PGBL'),
  ('10000000-0000-0000-0000-000000000001', 'VGBL'),
  ('10000000-0000-0000-0000-000000000001', 'Previdência'),
  ('10000000-0000-0000-0000-000000000002', 'Saúde Individual'),
  ('10000000-0000-0000-0000-000000000002', 'Saúde Empresarial'),
  ('10000000-0000-0000-0000-000000000002', 'Odonto'),
  ('10000000-0000-0000-0000-000000000003', 'Automóvel'),
  ('10000000-0000-0000-0000-000000000003', 'Residencial'),
  ('10000000-0000-0000-0000-000000000003', 'Empresarial'),
  ('10000000-0000-0000-0000-000000000003', 'RC'),
  ('10000000-0000-0000-0000-000000000004', 'Consórcio Auto'),
  ('10000000-0000-0000-0000-000000000004', 'Consórcio Imóvel'),
  ('10000000-0000-0000-0000-000000000005', 'Viagem Nacional'),
  ('10000000-0000-0000-0000-000000000005', 'Viagem Internacional'),
  ('10000000-0000-0000-0000-000000000006', 'Prestamista'),
  ('10000000-0000-0000-0000-000000000006', 'Seguro de Crédito')
on conflict (grupo_produto_id, nome) do nothing;
