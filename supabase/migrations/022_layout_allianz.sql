-- Layout Allianz — Excel (.xlsx)
-- Cabeçalho na linha 10, dados a partir da linha 11
-- Grupo fixo: Ramos Elementares
-- De-para de RAMO para produtos

DO $$
DECLARE
  v_seg_id  uuid;
  v_lay_id  uuid;
  v_grp_id  uuid;
  v_prod_auto uuid;
  v_prod_res  uuid;
  v_prod_cond uuid;
BEGIN

  SELECT id INTO v_seg_id
  FROM public.seguradoras
  WHERE nome ILIKE '%allianz%' OR nome_fantasia ILIKE '%allianz%'
  LIMIT 1;

  IF v_seg_id IS NULL THEN
    RAISE NOTICE 'Seguradora Allianz não encontrada — abortando.';
    RETURN;
  END IF;

  SELECT id INTO v_grp_id
  FROM public.grupos_produto
  WHERE nome ILIKE '%ramos elementares%'
  LIMIT 1;

  SELECT id INTO v_prod_auto
  FROM public.produtos
  WHERE grupo_produto_id = v_grp_id AND nome ILIKE '%autom%'
  LIMIT 1;

  SELECT id INTO v_prod_res
  FROM public.produtos
  WHERE grupo_produto_id = v_grp_id AND nome ILIKE '%resid%'
  LIMIT 1;

  SELECT id INTO v_prod_cond
  FROM public.produtos
  WHERE grupo_produto_id = v_grp_id AND nome ILIKE '%condom%'
  LIMIT 1;

  INSERT INTO public.seguradora_layouts (
    seguradora_id, nome, formato,
    linha_cabecalho, primeira_linha_dados,
    extensoes_esperadas, status
  ) VALUES (
    v_seg_id,
    'Comissões — Excel Mensal',
    'xlsx',
    10, 11,
    ARRAY['.xlsx', '.xls'],
    'ativo'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_lay_id;

  IF v_lay_id IS NULL THEN
    RAISE NOTICE 'Layout Allianz já existia — pulando mapeamentos.';
    RETURN;
  END IF;

  INSERT INTO public.layout_mapeamentos (layout_id, campo_sistema, coluna_arquivo, formato_data)
  VALUES
    (v_lay_id, 'referencia',          '3',  NULL),
    (v_lay_id, 'produto',             '1',  NULL),
    (v_lay_id, 'nome_segurado',       '9',  NULL),
    (v_lay_id, 'parcela_fracao',      '8',  NULL),
    (v_lay_id, 'valor_base',          '10', NULL),
    (v_lay_id, 'valor_bruto',         '11', NULL),
    (v_lay_id, 'pct_comissao',        '12', NULL);

  -- De-para: RAMO → produto (apenas para Allianz)
  INSERT INTO public.produto_depara (seguradora_id, texto_relatorio, grupo_produto_id, produto_id)
  VALUES
    (v_seg_id, '1211 - Automóvel',          v_grp_id, v_prod_auto),
    (v_seg_id, '2013 - Residencia digital', v_grp_id, v_prod_res),
    (v_seg_id, '2013 - Residência digital', v_grp_id, v_prod_res),
    (v_seg_id, '2002 - Condomínio',         v_grp_id, v_prod_cond)
  ON CONFLICT (seguradora_id, texto_relatorio) DO NOTHING;

END $$;
