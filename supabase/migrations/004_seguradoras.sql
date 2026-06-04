-- ============================================================
-- E2.S2 — Cadastro de Seguradoras
-- ============================================================

create table if not exists public.seguradoras (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  nome_fantasia       text not null,
  cnpj                text not null,
  codigo_susep        text not null,
  ramos               text[] not null default '{}',
  politica_nf         text not null check (politica_nf in (
                        'exige_antes_pagamento',
                        'emite_no_fechamento',
                        'nao_emite'
                      )),
  formato_estorno     text not null check (formato_estorno in (
                        'incluso_relatorio',
                        'lancamento_manual'
                      )),
  observacoes         text,
  status              text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Regras de retenção por regime tributário
create table if not exists public.seguradora_retencoes (
  id                  uuid primary key default gen_random_uuid(),
  seguradora_id       uuid not null references public.seguradoras(id) on delete cascade,
  regime              text not null check (regime in ('simples_nacional', 'lucro_presumido_real')),
  retem_iss           boolean not null default false,
  retem_irpj          boolean not null default false,
  aliquota_irpj       numeric(5,2),
  unique (seguradora_id, regime)
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.seguradoras enable row level security;
alter table public.seguradora_retencoes enable row level security;

-- Todos os usuários autenticados com vínculo ativo lêem seguradoras
create policy "seguradoras: leitura autenticados" on public.seguradoras
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
    )
  );

create policy "seguradoras: bpo_admin gerencia" on public.seguradoras
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );

create policy "seguradora_retencoes: leitura autenticados" on public.seguradora_retencoes
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
    )
  );

create policy "seguradora_retencoes: bpo_admin gerencia" on public.seguradora_retencoes
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );
