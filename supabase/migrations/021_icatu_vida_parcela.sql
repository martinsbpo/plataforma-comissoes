-- Renomeia layout ICATU Vida e Previdência e adiciona mapeamento da coluna Parcela (col 9)
UPDATE public.seguradora_layouts l
SET nome = 'Vida e Previdência — TXT Novo'
FROM public.seguradoras s
WHERE s.id = l.seguradora_id
  AND (s.nome ILIKE '%icatu%' OR s.nome_fantasia ILIKE '%icatu%')
  AND l.nome = 'Vida e Previdência — CSV Mensal';

INSERT INTO public.layout_mapeamentos (layout_id, campo_sistema, coluna_arquivo, formato_data)
SELECT l.id, 'parcela_comissionada', '9', NULL
FROM public.seguradora_layouts l
JOIN public.seguradoras s ON s.id = l.seguradora_id
WHERE (s.nome ILIKE '%icatu%' OR s.nome_fantasia ILIKE '%icatu%')
  AND l.nome = 'Vida e Previdência — TXT Novo'
  AND NOT EXISTS (
    SELECT 1 FROM public.layout_mapeamentos m
    WHERE m.layout_id = l.id AND m.campo_sistema = 'parcela_comissionada'
  );
