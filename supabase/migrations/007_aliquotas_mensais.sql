-- ============================================================
-- E2.S6 — Alíquotas Mensais
-- ============================================================

create table if not exists public.aliquotas_mensais (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  competencia         date not null,             -- sempre o primeiro dia do mês: 2026-04-01
  aliquota_global     numeric(5,2) not null,     -- alíquota geral de imposto (todos os regimes)
  aliquota_iss        numeric(5,2),              -- ISS do mês — obrigatório se há retenção
  observacoes         text,
  periodo_fechado     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, competencia)
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.aliquotas_mensais enable row level security;

create policy "aliquotas: bpo lê todas" on public.aliquotas_mensais
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador')
    )
  );

create policy "aliquotas: bpo_admin e operador gerenciam" on public.aliquotas_mensais
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador')
    )
  );
