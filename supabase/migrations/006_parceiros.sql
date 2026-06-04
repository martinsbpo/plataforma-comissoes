-- ============================================================
-- E2.S5 — Cadastro de Parceiros
-- ============================================================

create table if not exists public.parceiros (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  nome            text not null,
  cpf             text not null,
  email           text not null,
  telefone        text,
  codigo_susep    text,
  pct_indicador   numeric(5,2),
  pct_corretor1   numeric(5,2),
  pct_corretor2   numeric(5,2),
  observacoes     text,
  status          text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (cpf, tenant_id)
);

create table if not exists public.parceiro_contas_bancarias (
  id          uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  banco       text not null,
  agencia     text not null,
  conta       text not null,
  tipo_conta  text not null default 'corrente' check (tipo_conta in ('corrente', 'poupanca')),
  chave_pix   text,
  apelido     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.parceiros enable row level security;
alter table public.parceiro_contas_bancarias enable row level security;

-- BPO vê todos; corretora vê apenas os seus
create policy "parceiros: bpo lê todos" on public.parceiros
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador')
    )
  );

create policy "parceiros: corretora lê os seus" on public.parceiros
  for select using (
    tenant_id in (
      select tenant_id from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
    )
  );

create policy "parceiros: bpo_admin gerencia todos" on public.parceiros
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

create policy "parceiros: corretora_gestor e operador gerenciam os seus" on public.parceiros
  for all using (
    tenant_id in (
      select tenant_id from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('corretora_gestor', 'corretora_operador')
    )
  );

-- Contas bancárias seguem o mesmo isolamento
create policy "parceiro_contas: bpo lê todas" on public.parceiro_contas_bancarias
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador')
    )
  );

create policy "parceiro_contas: corretora lê as suas" on public.parceiro_contas_bancarias
  for select using (
    parceiro_id in (
      select p.id from public.parceiros p
      join public.user_tenant_links utl on utl.tenant_id = p.tenant_id
      where utl.user_id = auth.uid() and utl.status = 'ativo'
    )
  );

create policy "parceiro_contas: bpo_admin gerencia" on public.parceiro_contas_bancarias
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo' and role = 'bpo_admin'
    )
  );

create policy "parceiro_contas: corretora_gestor e operador gerenciam as suas" on public.parceiro_contas_bancarias
  for all using (
    parceiro_id in (
      select p.id from public.parceiros p
      join public.user_tenant_links utl on utl.tenant_id = p.tenant_id
      where utl.user_id = auth.uid() and utl.status = 'ativo'
        and utl.role in ('corretora_gestor', 'corretora_operador')
    )
  );
