-- ============================================================
-- E1.S3 — Multi-tenant: Estrutura Base
-- ============================================================

-- Tenants (BPO + corretoras clientes)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_fantasia text,
  tenant_type text not null check (tenant_type in ('bpo', 'corretora')),
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'inativo')),
  logo_url text,
  primary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Users (espelho do auth.users do Supabase)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  auth_provider text not null default 'microsoft' check (auth_provider in ('microsoft', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Vínculo usuário ↔ tenant + papel
create table if not exists public.user_tenant_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'corretora_operador', 'parceiro')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- Auditoria imutável
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  user_id uuid references public.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.user_tenant_links enable row level security;
alter table public.audit_logs enable row level security;

-- Usuário vê apenas seus próprios dados de perfil
create policy "users: leitura própria" on public.users
  for select using (id = auth.uid());

create policy "users: atualização própria" on public.users
  for update using (id = auth.uid());

-- Usuário vê apenas os tenants aos quais está vinculado
create policy "tenants: leitura por vínculo" on public.tenants
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and tenant_id = tenants.id
        and status = 'ativo'
    )
  );

-- Usuário vê apenas seus próprios vínculos
create policy "user_tenant_links: leitura própria" on public.user_tenant_links
  for select using (user_id = auth.uid());

-- audit_logs: somente inserção (append-only)
create policy "audit_logs: apenas inserção" on public.audit_logs
  for insert with check (true);

create policy "audit_logs: leitura por tenant" on public.audit_logs
  for select using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and tenant_id = audit_logs.tenant_id
        and status = 'ativo'
    )
  );

-- ============================================================
-- Trigger: criar perfil automaticamente no primeiro login
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, nome, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when new.app_metadata->>'provider' = 'azure' then 'microsoft' else 'email' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Seed: tenant Martins BPO Financeiro
-- ============================================================

insert into public.tenants (id, nome, nome_fantasia, tenant_type, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Martins BPO Financeiro',
  'Martins BPO',
  'bpo',
  'ativo'
)
on conflict (id) do nothing;
