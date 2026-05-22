-- ============================================================
-- E1.S4 — Perfis e Permissões: RLS adicional + funções helper
-- ============================================================

-- Retorna o papel do usuário autenticado em um tenant específico
create or replace function public.get_user_role(p_tenant_id uuid)
returns text language sql security definer stable as $$
  select role
  from public.user_tenant_links
  where user_id = auth.uid()
    and tenant_id = p_tenant_id
    and status = 'ativo'
  limit 1;
$$;

-- Retorna true se o usuário tem um dos papéis informados no tenant
create or replace function public.has_role(p_tenant_id uuid, variadic p_roles text[])
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_tenant_links
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
      and status = 'ativo'
      and role = any(p_roles)
  );
$$;

-- ============================================================
-- Políticas de escrita em user_tenant_links
-- BPO Admin pode gerenciar todos; Corretora Gestor só os seus operadores
-- ============================================================

create policy "user_tenant_links: bpo_admin gerencia todos" on public.user_tenant_links
  for all using (
    exists (
      select 1 from public.user_tenant_links utl
      where utl.user_id = auth.uid()
        and utl.status = 'ativo'
        and utl.role = 'bpo_admin'
    )
  );

create policy "user_tenant_links: corretora_gestor gerencia operadores da sua corretora" on public.user_tenant_links
  for all using (
    tenant_id in (
      select tenant_id from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'corretora_gestor'
    )
    and role = 'corretora_operador'
  );

-- ============================================================
-- Políticas de escrita em tenants
-- Apenas BPO Admin pode criar/editar tenants
-- ============================================================

create policy "tenants: bpo_admin pode criar" on public.tenants
  for insert with check (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );

create policy "tenants: bpo_admin pode editar" on public.tenants
  for update using (
    exists (
      select 1 from public.user_tenant_links
      where user_id = auth.uid()
        and status = 'ativo'
        and role = 'bpo_admin'
    )
  );
