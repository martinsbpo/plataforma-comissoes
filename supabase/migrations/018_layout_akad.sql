-- ============================================================
-- E3 — Layout AKAD Seguros
-- Formato: TXT com separador TAB  |  Encoding: auto
-- Linha cabeçalho: 1  |  Primeira linha dados: 2
--
-- Índices das colunas (0-based):
--  5  RAMO               → produto (de-para: 0378/0171/0118)
--  6  APOLICE            → referencia
-- 10  SEGURADO_ESTIPULANTE → nome_segurado
-- 14  VALOR_BASE         → valor_base
-- 15  PORC_COMISSAO      → pct_comissao
-- 16  COMISSAO_REEMBOLSO → valor_bruto
-- 18  DATA_PAGTO         → data_competencia (DD/MM/YYYY)
--
-- Grupo fixo: Ramos Elementares
-- De-para: 0378 → RC | 0171 → Riscos Diversos | 0118 → Empresarial
-- ============================================================

DO $$
DECLARE
  v_seg_id        uuid;
  v_lay_id        uuid;
  v_grp_ramos     uuid := '10000000-0000-0000-0000-000000000003';
  v_prod_rc       uuid := '8fb3f645-0388-4250-9a6d-2b48366619cd';
  v_prod_rd       uuid := 'cdd6259d-6a98-483e-af8c-0b6726cfa0a2';
  v_prod_emp      uuid := '315a12a7-3abc-4ee4-ab7d-7f5040077322';
BEGIN

  SELECT id INTO v_seg_id
  FROM public.seguradoras
  WHERE nome ILIKE '%akad%' OR nome_fantasia ILIKE '%akad%'
  LIMIT 1;

  IF v_seg_id IS NULL THEN
    RAISE EXCEPTION 'Seguradora AKAD não encontrada — cadastre primeiro.';
  END IF;

  INSERT INTO public.seguradora_layouts (
    seguradora_id, nome, formato, separador, encoding,
    linha_cabecalho, primeira_linha_dados,
    grupo_produto_fixo_id,
    extensoes_esperadas, padrao_nome_arquivo,
    status
  ) VALUES (
    v_seg_id,
    'Extrato de Comissões — TXT Mensal',
    'txt', E'\t', 'auto',
    1, 2,
    v_grp_ramos,
    ARRAY['.txt', '.csv'],
    'Extrato de Comissões - *.txt',
    'ativo'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_lay_id;

  IF v_lay_id IS NOT NULL THEN
    INSERT INTO public.layout_mapeamentos
      (layout_id, campo_sistema, coluna_arquivo, formato_data)
    VALUES
      (v_lay_id, 'referencia',       '6',  NULL),
      (v_lay_id, 'nome_segurado',    '10', NULL),
      (v_lay_id, 'produto',          '5',  NULL),
      (v_lay_id, 'data_competencia', '18', 'DD/MM/YYYY'),
      (v_lay_id, 'valor_base',       '14', NULL),
      (v_lay_id, 'pct_comissao',     '15', NULL),
      (v_lay_id, 'valor_bruto',      '16', NULL);
  END IF;

  -- De-para: RAMO → Produto interno
  INSERT INTO public.produto_depara
    (seguradora_id, texto_relatorio, grupo_produto_id, produto_id)
  VALUES
    (v_seg_id, '0378', v_grp_ramos, v_prod_rc),
    (v_seg_id, '0171', v_grp_ramos, v_prod_rd),
    (v_seg_id, '0118', v_grp_ramos, v_prod_emp)
  ON CONFLICT (seguradora_id, texto_relatorio) DO NOTHING;

END $$;
