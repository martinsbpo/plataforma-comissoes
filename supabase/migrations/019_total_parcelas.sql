-- Adiciona total_parcelas nas linhas de importacao
alter table public.importacao_linhas
  add column if not exists total_parcelas integer;

-- Adiciona total_parcelas como campo mapeavel nos layouts
alter table public.layout_mapeamentos
  drop constraint if exists layout_mapeamentos_campo_sistema_check;

alter table public.layout_mapeamentos
  add constraint layout_mapeamentos_campo_sistema_check
  check (campo_sistema in (
    'referencia', 'nome_segurado', 'cpf_segurado',
    'data_competencia', 'grupo_produto', 'produto',
    'valor_base', 'parcela_comissionada', 'total_parcelas',
    'pct_comissao',
    'pct_angariacao', 'pct_vitalicio', 'pct_estorno', 'pct_incentivo', 'pct_bonificacao',
    'valor_angariacao', 'valor_vitalicio',
    'valor_bruto', 'valor_estorno',
    'valor_incentivo', 'valor_bonificacao'
  ));

-- Layout AKAD: mapeia parcela (col 8) e total_parcelas (col 9)
insert into public.layout_mapeamentos (layout_id, campo_sistema, coluna_arquivo, formato_data)
select l.id, 'parcela_comissionada', '8', null
from public.seguradora_layouts l
join public.seguradoras s on s.id = l.seguradora_id
where (s.nome ilike '%akad%' or s.nome_fantasia ilike '%akad%')
  and l.status = 'ativo'
on conflict do nothing;

insert into public.layout_mapeamentos (layout_id, campo_sistema, coluna_arquivo, formato_data)
select l.id, 'total_parcelas', '9', null
from public.seguradora_layouts l
join public.seguradoras s on s.id = l.seguradora_id
where (s.nome ilike '%akad%' or s.nome_fantasia ilike '%akad%')
  and l.status = 'ativo'
on conflict do nothing;
