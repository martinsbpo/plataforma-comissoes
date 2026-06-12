-- ============================================================
-- E6 — Conta Corrente de Repasses por Parceiro
-- ============================================================

-- Pagamentos efetuados aos parceiros (débitos na conta corrente)
create table if not exists public.repasse_pagamentos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  parceiro_id   uuid not null references public.parceiros(id) on delete cascade,
  data_pagamento date not null,
  valor         numeric(14,2) not null check (valor > 0),
  descricao     text,
  registrado_por uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists repasse_pagamentos_tenant_idx on public.repasse_pagamentos (tenant_id);
create index if not exists repasse_pagamentos_parceiro_idx on public.repasse_pagamentos (parceiro_id);

-- RLS
alter table public.repasse_pagamentos enable row level security;

drop policy if exists "repasse_pagamentos: leitura por tenant" on public.repasse_pagamentos;
create policy "repasse_pagamentos: leitura por tenant" on public.repasse_pagamentos
  for select using (
    tenant_id in (
      select utl.tenant_id from public.user_tenant_links utl
      where utl.user_id = auth.uid() and utl.status = 'ativo'
    )
  );

drop policy if exists "repasse_pagamentos: escrita por operador" on public.repasse_pagamentos;
create policy "repasse_pagamentos: escrita por operador" on public.repasse_pagamentos
  for all using (
    tenant_id in (
      select utl.tenant_id from public.user_tenant_links utl
      where utl.user_id = auth.uid()
        and utl.status = 'ativo'
        and utl.role in ('bpo_admin', 'bpo_operador')
    )
  );
