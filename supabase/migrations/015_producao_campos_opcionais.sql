-- ============================================================
-- 015 — Torna campos opcionais na tabela producao
-- data, seguradora_id e segurado passam a ser opcionais
-- para suportar importação de planilhas com dados incompletos
-- ============================================================

alter table public.producao
  alter column data drop not null,
  alter column seguradora_id drop not null,
  alter column segurado drop not null;
