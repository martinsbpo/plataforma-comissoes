-- Adiciona produto Capitalização no grupo Crédito e Outros
insert into public.produtos (grupo_produto_id, nome)
values ('10000000-0000-0000-0000-000000000006', 'Capitalização')
on conflict (grupo_produto_id, nome) do nothing;
