-- ============================================================
-- E4.S1 — Base de Produção (input manual)
-- ============================================================

create table if not exists public.producao (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  competencia         date not null,               -- primeiro dia do mês (YYYY-MM-01)
  data                date not null,               -- data do negócio
  seguradora_id       uuid not null references public.seguradoras(id) on delete restrict,
  segurado            text not null,
  referencia          text not null,               -- ref da apólice na seguradora
  cpf_segurado        text,
  grupo_produto_id    uuid references public.grupos_produto(id) on delete restrict,
  produto_id          uuid references public.produtos(id) on delete restrict,
  comissao            numeric(14,2) not null,
  indicador_id        uuid references public.parceiros(id) on delete restrict,
  pct_indicador       numeric(7,4),                -- ex: 10.0000 = 10%
  corretor1_id        uuid references public.parceiros(id) on delete restrict,
  pct_corretor1       numeric(7,4),
  corretor2_id        uuid references public.parceiros(id) on delete restrict,
  pct_corretor2       numeric(7,4),
  impostos_pct        numeric(7,4) not null default 0,  -- alíquota do mês (%)
  repasse_indicador   numeric(14,2) not null default 0,
  repasse_corretor1   numeric(14,2) not null default 0,
  repasse_corretor2   numeric(14,2) not null default 0,
  resultado           numeric(14,2) not null default 0,
  status_vinculacao   text not null default 'pendente' check (status_vinculacao in ('pendente', 'vinculado', 'divergente')),
  relatorio_linha_id  uuid references public.importacao_linhas(id) on delete set null,
  origem              text not null default 'manual' check (origem in ('manual', 'importacao_planilha')),
  status_periodo      text not null default 'aberto' check (status_periodo in ('aberto', 'fechado')),
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Índices para filtros e vinculação
create index if not exists producao_tenant_competencia_idx on public.producao (tenant_id, competencia);
create index if not exists producao_tenant_seguradora_ref_idx on public.producao (tenant_id, seguradora_id, referencia, competencia);
create index if not exists producao_segurado_idx on public.producao using gin (to_tsvector('portuguese', segurado));
create index if not exists producao_cpf_idx on public.producao (cpf_segurado) where cpf_segurado is not null;
create index if not exists producao_indicador_idx on public.producao (indicador_id) where indicador_id is not null;
create index if not exists producao_corretor1_idx on public.producao (corretor1_id) where corretor1_id is not null;
create index if not exists producao_corretor2_idx on public.producao (corretor2_id) where corretor2_id is not null;
create index if not exists producao_status_vinculacao_idx on public.producao (tenant_id, status_vinculacao);

-- ============================================================
-- RLS
-- ============================================================

alter table public.producao enable row level security;

drop policy if exists "producao: leitura por tenant" on public.producao;
create policy "producao: leitura por tenant" on public.producao
  for select using (
    tenant_id in (
      select utl.tenant_id from public.user_tenant_links utl
      where utl.user_id = auth.uid() and utl.status = 'ativo'
    )
  );

drop policy if exists "producao: escrita por operador" on public.producao;
create policy "producao: escrita por operador" on public.producao
  for all using (
    tenant_id in (
      select utl.tenant_id from public.user_tenant_links utl
      where utl.user_id = auth.uid()
        and utl.status = 'ativo'
        and utl.role in ('bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador')
    )
  );
