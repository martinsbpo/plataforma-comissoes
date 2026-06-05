-- ============================================================
-- 010 — Seed de layouts pré-configurados (Mongeral e Icatu)
-- ============================================================
-- Usa índices de coluna (0-based) para evitar problemas de
-- encoding com caracteres especiais nos cabeçalhos.
-- Executa apenas se a seguradora existir no banco.
-- ============================================================

DO $$
DECLARE
  v_seg_id  uuid;
  v_lay_id  uuid;
  v_grp_vida uuid := '10000000-0000-0000-0000-000000000001'; -- Vida e Previdência
  v_prod_individual uuid;
  v_prod_grupo      uuid;
BEGIN

  -- IDs dos produtos Vida Individual e Vida em Grupo
  SELECT id INTO v_prod_individual
  FROM public.produtos
  WHERE grupo_produto_id = v_grp_vida AND nome = 'Vida Individual';

  SELECT id INTO v_prod_grupo
  FROM public.produtos
  WHERE grupo_produto_id = v_grp_vida AND nome = 'Vida em Grupo';

  -- ============================================================
  -- MONGERAL AEGON
  -- Formato: CSV com separador ;  |  Encoding: UTF-8 com BOM
  -- Linha cabeçalho: 1  |  Primeira linha dados: 2
  --
  -- Índices das colunas (0-based):
  --  2  Tipo de cliente          → produto (de-para: INDIVIDUAL / GRUPO)
  --  3  Nome/Razão social        → nome_segurado
  --  4  CPF/CNPJ do cliente      → cpf_segurado
  --  5  Proposta                 → referencia
  -- 10  Valor base               → valor_base
  -- 11  Parcela comissionada     → parcela_comissionada
  -- 18  Data de efetivação       → data_competencia  (DD/MM/YYYY)
  -- 19  Valor Angariação         → valor_angariacao
  -- 20  %  Angariação            → pct_angariacao
  -- 21  Valor Comissão           → valor_bruto
  -- 22  %  Comissão              → pct_comissao
  -- 23  Valor estorno            → valor_estorno
  -- 24  % estorno                → pct_estorno
  -- 25  Valor incentivo          → valor_incentivo
  -- 26  %  incentivo             → pct_incentivo
  -- 27  Valor bonificação        → valor_bonificacao
  -- 28  %  bonificação           → pct_bonificacao
  --
  -- Grupo fixo: Vida e Previdência
  -- De-para: INDIVIDUAL → Vida Individual | GRUPO → Vida em Grupo
  -- ============================================================

  SELECT id INTO v_seg_id
  FROM public.seguradoras
  WHERE nome ILIKE '%mongeral%' OR nome_fantasia ILIKE '%mongeral%'
  LIMIT 1;

  IF v_seg_id IS NOT NULL THEN

    -- Layout
    INSERT INTO public.seguradora_layouts (
      seguradora_id, nome, formato, separador, encoding,
      linha_cabecalho, primeira_linha_dados,
      grupo_produto_fixo_id,
      extensoes_esperadas, padrao_nome_arquivo,
      status
    ) VALUES (
      v_seg_id,
      'Padrão CSV Mensal',
      'csv', ';', 'auto',
      1, 2,
      v_grp_vida,
      ARRAY['.csv', '.txt'],
      'COMISSAO_*.csv',
      'ativo'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_lay_id;

    IF v_lay_id IS NOT NULL THEN
      INSERT INTO public.layout_mapeamentos
        (layout_id, campo_sistema, coluna_arquivo, formato_data)
      VALUES
        (v_lay_id, 'produto',              '2',  NULL),
        (v_lay_id, 'nome_segurado',        '3',  NULL),
        (v_lay_id, 'cpf_segurado',         '4',  NULL),
        (v_lay_id, 'referencia',           '5',  NULL),
        (v_lay_id, 'valor_base',           '10', NULL),
        (v_lay_id, 'parcela_comissionada', '11', NULL),
        (v_lay_id, 'data_competencia',     '18', 'DD/MM/YYYY'),
        (v_lay_id, 'valor_angariacao',     '19', NULL),
        (v_lay_id, 'pct_angariacao',       '20', NULL),
        (v_lay_id, 'valor_bruto',          '21', NULL),
        (v_lay_id, 'pct_comissao',         '22', NULL),
        (v_lay_id, 'valor_estorno',        '23', NULL),
        (v_lay_id, 'pct_estorno',          '24', NULL),
        (v_lay_id, 'valor_incentivo',      '25', NULL),
        (v_lay_id, 'pct_incentivo',        '26', NULL),
        (v_lay_id, 'valor_bonificacao',    '27', NULL),
        (v_lay_id, 'pct_bonificacao',      '28', NULL);
    END IF;

    -- De-para: Tipo de cliente → produto interno
    IF v_prod_individual IS NOT NULL THEN
      INSERT INTO public.produto_depara
        (seguradora_id, texto_relatorio, grupo_produto_id, produto_id)
      VALUES
        (v_seg_id, 'INDIVIDUAL', v_grp_vida, v_prod_individual)
      ON CONFLICT (seguradora_id, texto_relatorio) DO NOTHING;
    END IF;

    IF v_prod_grupo IS NOT NULL THEN
      INSERT INTO public.produto_depara
        (seguradora_id, texto_relatorio, grupo_produto_id, produto_id)
      VALUES
        (v_seg_id, 'GRUPO', v_grp_vida, v_prod_grupo)
      ON CONFLICT (seguradora_id, texto_relatorio) DO NOTHING;
    END IF;

  END IF;


  -- ============================================================
  -- ICATU SEGUROS
  -- (mapeamento a confirmar — placeholder por ora)
  -- Formato: CSV com separador ;  |  Encoding: UTF-8
  -- Linha cabeçalho: 1  |  Primeira linha dados: 2
  --
  -- Mapeamento provisório (será atualizado após validação):
  --  0  Cliente      → nome_segurado
  --  1  CPF          → cpf_segurado
  --  3  Produto      → produto (de-para a definir)
  --  8  Proposta     → referencia
  -- 10  Vencimento   → data_competencia  (DD/MM/YYYY)  ← confirmar
  -- 12  Valor base   → valor_base        (tem prefixo R$)
  -- 13  %            → pct_comissao      (ex: 20.00%)
  -- 14  Comissão     → valor_bruto       (tem prefixo R$)
  -- ============================================================

  SELECT id INTO v_seg_id
  FROM public.seguradoras
  WHERE nome ILIKE '%icatu%' OR nome_fantasia ILIKE '%icatu%'
  LIMIT 1;

  IF v_seg_id IS NOT NULL THEN
    INSERT INTO public.seguradora_layouts (
      seguradora_id, nome, formato, separador, encoding,
      linha_cabecalho, primeira_linha_dados,
      extensoes_esperadas,
      status
    ) VALUES (
      v_seg_id,
      'Padrão CSV Mensal',
      'csv', ';', 'auto',
      1, 2,
      ARRAY['.csv'],
      'ativo'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_lay_id;

    IF v_lay_id IS NOT NULL THEN
      INSERT INTO public.layout_mapeamentos
        (layout_id, campo_sistema, coluna_arquivo, formato_data)
      VALUES
        (v_lay_id, 'referencia',       '8',  NULL),
        (v_lay_id, 'nome_segurado',    '0',  NULL),
        (v_lay_id, 'cpf_segurado',     '1',  NULL),
        (v_lay_id, 'produto',          '3',  NULL),
        (v_lay_id, 'data_competencia', '10', 'DD/MM/YYYY'),
        (v_lay_id, 'valor_base',       '12', NULL),
        (v_lay_id, 'pct_comissao',     '13', NULL),
        (v_lay_id, 'valor_bruto',      '14', NULL);
    END IF;
  END IF;

END $$;
