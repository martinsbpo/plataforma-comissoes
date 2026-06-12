-- Adiciona parcela e total_parcelas nas linhas de apuração (espelho de importacao_linhas)
alter table public.apuracao_linhas
  add column if not exists parcela_comissionada integer,
  add column if not exists total_parcelas integer;
