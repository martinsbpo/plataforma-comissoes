-- ============================================================
-- E2.S1 — Cadastro de Corretoras
-- ============================================================

-- Adiciona campos cadastrais à tabela tenants (corretoras)
alter table public.tenants
  add column if not exists cnpj                      text,
  add column if not exists codigo_susep              text,
  add column if not exists contato_nome              text,
  add column if not exists contato_email             text,
  add column if not exists telefone                  text,
  add column if not exists regime_tributario         text check (regime_tributario in ('simples_nacional', 'lucro_presumido', 'lucro_real')),
  add column if not exists data_inicio_contrato      date,
  add column if not exists data_encerramento_contrato date,
  add column if not exists observacoes_internas      text;

-- Contas bancárias (1:N por corretora)
create table if not exists public.corretora_contas_bancarias (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  banco      text not null,
  agencia    text not null,
  conta      text not null,
  apelido    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.corretora_contas_bancarias enable row level security;

-- BPO Admin lê todas; corretora lê apenas as suas
create policy "contas_bancarias: bpo lê todas" on public.corretora_contas_bancarias
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador')
    )
  );

create policy "contas_bancarias: corretora lê as suas" on public.corretora_contas_bancarias
  for select using (
    tenant_id in (
      select tenant_id from public.user_tenant_links
      where user_id = auth.uid() and status = 'ativo'
    )
  );

create policy "contas_bancarias: bpo_admin gerencia" on public.corretora_contas_bancarias
  for all using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );

-- Storage bucket para logos (executar separadamente no dashboard se não existir)
-- insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
-- on conflict (id) do nothing;

-- Política de leitura pública para logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos: leitura pública" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos: bpo_admin faz upload" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );

create policy "logos: bpo_admin atualiza" on storage.objects
  for update using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );
