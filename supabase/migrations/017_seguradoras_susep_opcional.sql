-- codigo_susep nao e obrigatorio para todas as seguradoras
alter table public.seguradoras alter column codigo_susep drop not null;
