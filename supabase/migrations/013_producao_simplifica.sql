-- ============================================================
-- 013 — Simplifica tabela producao
-- Produção = cadastro da apólice (não evento mensal)
-- Cálculos de repasse movem para E5 (Apuração)
-- ============================================================

alter table public.producao
  drop column if exists competencia,
  drop column if exists impostos_pct,
  drop column if exists repasse_indicador,
  drop column if exists repasse_corretor1,
  drop column if exists repasse_corretor2,
  drop column if exists resultado,
  drop column if exists status_vinculacao,
  drop column if exists relatorio_linha_id,
  drop column if exists status_periodo;

-- comissao passa a ser opcional (valor esperado)
alter table public.producao
  alter column comissao drop not null;

-- índices que referenciavam colunas removidas
drop index if exists producao_tenant_competencia_idx;
drop index if exists producao_status_vinculacao_idx;
