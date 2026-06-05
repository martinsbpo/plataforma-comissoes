-- ============================================================
-- E5.S1 — Apuração Mensal de Comissões
-- ============================================================

-- Cabeçalho da apuração (uma por corretora/competência)
create table if not exists public.apuracoes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  competencia     date not null,               -- primeiro dia do mês
  status          text not null default 'rascunho' check (status in ('rascunho', 'confirmada')),
  aliquota_pct    numeric(7,4) not null,        -- alíquota usada no cálculo
  total_comissao  numeric(14,2) not null default 0,
  total_imposto   numeric(14,2) not null default 0,
  total_repasses  numeric(14,2) not null default 0,
  total_resultado numeric(14,2) not null default 0,
  confirmado_por  uuid references public.users(id),
  confirmado_em   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, competencia)
);

-- Linhas da apuração (uma por negócio vinculado)
create table if not exists public.apuracao_linhas (
  id                    uuid primary key default gen_random_uuid(),
  apuracao_id           uuid not null references public.apuracoes(id) on delete cascade,
  importacao_linha_id   uuid references public.importacao_linhas(id) on delete set null,
  producao_id           uuid references public.producao(id) on delete set null,
  -- dados denormalizados para histórico
  seguradora_id         uuid references public.seguradoras(id),
  referencia            text not null,
  segurado              text not null,
  produto               text,
  -- valores calculados
  comissao_recebida     numeric(14,2) not null,
  aliquota_pct          numeric(7,4) not null,
  imposto_valor         numeric(14,2) not null default 0,
  indicador_id          uuid references public.parceiros(id),
  indicador_nome        text,
  pct_indicador         numeric(7,4),
  repasse_indicador     numeric(14,2) not null default 0,
  corretor1_id          uuid references public.parceiros(id),
  corretor1_nome        text,
  pct_corretor1         numeric(7,4),
  repasse_corretor1     numeric(14,2) not null default 0,
  corretor2_id          uuid references public.parceiros(id),
  corretor2_nome        text,
  pct_corretor2         numeric(7,4),
  repasse_corretor2     numeric(14,2) not null default 0,
  resultado             numeric(14,2) not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists apuracoes_tenant_competencia_idx on public.apuracoes (tenant_id, competencia);
create index if not exists apuracao_linhas_apuracao_idx on public.apuracao_linhas (apuracao_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.apuracoes enable row level security;
alter table public.apuracao_linhas enable row level security;

drop policy if exists "apuracoes: leitura por tenant" on public.apuracoes;
create policy "apuracoes: leitura por tenant" on public.apuracoes
  for select using (
    tenant_id in (
      select utl.tenant_id from public.user_tenant_links utl
      where utl.user_id = auth.uid() and utl.status = 'ativo'
    )
  );

drop policy if exists "apuracoes: escrita por operador" on public.apuracoes;
create policy "apuracoes: escrita por operador" on public.apuracoes
  for all using (
    tenant_id in (
      select utl.tenant_id from public.user_tenant_links utl
      where utl.user_id = auth.uid()
        and utl.status = 'ativo'
        and utl.role in ('bpo_admin', 'bpo_operador')
    )
  );

drop policy if exists "apuracao_linhas: leitura" on public.apuracao_linhas;
create policy "apuracao_linhas: leitura" on public.apuracao_linhas
  for select using (
    exists (
      select 1 from public.apuracoes a
      join public.user_tenant_links utl on utl.tenant_id = a.tenant_id
      where a.id = apuracao_linhas.apuracao_id
        and utl.user_id = auth.uid()
        and utl.status = 'ativo'
    )
  );

drop policy if exists "apuracao_linhas: escrita por operador" on public.apuracao_linhas;
create policy "apuracao_linhas: escrita por operador" on public.apuracao_linhas
  for all using (
    exists (
      select 1 from public.apuracoes a
      join public.user_tenant_links utl on utl.tenant_id = a.tenant_id
      where a.id = apuracao_linhas.apuracao_id
        and utl.user_id = auth.uid()
        and utl.status = 'ativo'
        and utl.role in ('bpo_admin', 'bpo_operador')
    )
  );
