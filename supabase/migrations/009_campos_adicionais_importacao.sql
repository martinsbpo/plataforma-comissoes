-- ============================================================
-- 009 — Campos adicionais para importação (Mongeral e outros)
-- ============================================================

-- Adiciona parcela_comissionada nas linhas de importação
alter table public.importacao_linhas
  add column if not exists parcela_comissionada integer;

-- Expande tipo_valor para incluir incentivo e bonificacao
alter table public.importacao_linhas
  drop constraint if exists importacao_linhas_tipo_valor_check;

alter table public.importacao_linhas
  add constraint importacao_linhas_tipo_valor_check
  check (tipo_valor in ('angariacao', 'vitalicio', 'comissao', 'estorno', 'incentivo', 'bonificacao'));

-- Expande campo_sistema para incluir campos por tipo de valor
alter table public.layout_mapeamentos
  drop constraint if exists layout_mapeamentos_campo_sistema_check;

alter table public.layout_mapeamentos
  add constraint layout_mapeamentos_campo_sistema_check
  check (campo_sistema in (
    'referencia', 'nome_segurado', 'cpf_segurado',
    'data_competencia', 'grupo_produto', 'produto',
    'valor_base', 'parcela_comissionada',
    'pct_comissao',
    'pct_angariacao', 'pct_vitalicio', 'pct_estorno', 'pct_incentivo', 'pct_bonificacao',
    'valor_angariacao', 'valor_vitalicio',
    'valor_bruto', 'valor_estorno',
    'valor_incentivo', 'valor_bonificacao'
  ));
