# S15 — Domínio de exemplo realista (`varejo`)

**Onda:** B (paralela à D2) · **Depende de:** D1 · **Decisão:** 0001 §3, §7.5

## 1. Por quê

As fixtures atuais têm 4 tabelas (smoke), 1 tabela de 187 colunas e 200 tabelas sintéticas sem
significado (stress). Nenhuma parece um projeto real, então:
- não dá para **avaliar a UX** (foco, rastreio, views, transformação) com dados que façam sentido;
- não há um projeto que exercite **ao mesmo tempo** camadas, linhagem longa, models gerenciados e
  manuais, sources, seeds e referências entre projetos;
- demonstrações usam o exemplo de brinquedo.

## 2. Resultado

Um domínio dbt `varejo` versionado no repositório, **gerado por script determinístico**, que serve de:
fixture Cypress, projeto de demonstração ao abrir o app em modo dev, e base de desempenho realista.

## 3. Composição

Domínio `varejo`, um `dbt_project.yml`, **3 projetos Strata**:

| Projeto | Bronze (sources) | Silver | Gold | Total |
| --- | --- | --- | --- | --- |
| `vendas` | 12 (pedidos, itens, pagamentos, devoluções, cupons, canais…) | 14 | 8 | 34 |
| `estoque` | 10 (produtos, fornecedores, movimentações, inventário…) | 12 | 6 | 28 |
| `clientes` | 8 (cadastro, endereços, consentimentos, eventos de app…) | 10 | 6 | 24 |
| **total** | 30 | 36 | 20 | **86** |

Regras de conteúdo:
- **Nomes e colunas em português de negócio** coerentes (`pedido_id`, `valor_bruto`, `dt_emissao`),
  tipos Spark.
- **Uma tabela larga real:** `bronze.app_eventos` com **180+ colunas** (payload achatado), com
  seções por prefixo (`device_`, `geo_`, `utm_`, `sessao_`).
- **PK simples e composta** (`itens_pedido`: `pedido_id + item_seq`), **FKs** reais entre tabelas,
  `not null`, `unique`, 3 **enums** (`status_pedido`, `canal_venda`, `tipo_movimentacao`), 2 índices
  compostos.
- **Linhagem de campo** bronze → silver → gold completa para todo model gerenciado, com pelo menos
  **3 cadeias de 4+ saltos** (ex.: `bronze.pedidos.vl_total → silver.pedido.valor_bruto →
  gold.fct_vendas.receita_bruta → gold.agg_vendas_diarias.receita_bruta_dia`).
- **Referência entre projetos:** `estoque.gold.fct_giro_produto` e `clientes.gold.dim_cliente_360`
  fazem `ref()` a models de `vendas`.
- **Mistura de models:** 70% gerenciados (com `transform` + `lineage` + marcadores da D5 — se a D5
  ainda não existir, só `managed: true`), 30% **manuais** com SQL realista: CTEs, `union all`,
  window function, uma macro `{{ dbt_utils.generate_surrogate_key(...) }}` — insumo direto da S13.
- **Seeds:** `seeds/vendas/canais.csv`, `seeds/estoque/unidades_medida.csv` (com acentos e vírgulas
  entre aspas).
- **Documentação:** `description` em 60% das tabelas e 30% das colunas.
- **Visual (`.strata/`):** posições em layout por camada legível, 4 views (`vendas_executivo`,
  `estoque_operacao`, `clientes_lgpd`, `linhagem_receita`), cores por projeto, pins nas colunas-chave
  das tabelas largas.

## 4. Como é gerado

- `scripts/fixtures/varejo/spec.ts` — a **descrição declarativa** do domínio (tabelas, colunas,
  relações, linhagem, transformações) escrita à mão; é o que um humano revisa.
- `scripts/fixtures/varejo/generate.ts` — constrói `StrataModel` a partir do spec e grava com
  `toDbtProject` (D1) em `fixtures/dbt-source/varejo/`; SQL manual vem de arquivos `.sql` escritos
  à mão em `scripts/fixtures/varejo/manual/`.
- `npm run fixtures:varejo` regenera. **Determinístico:** duas execuções produzem bytes idênticos
  (ordem estável, sem timestamps, seed fixa para posições).
- Cópia para Cypress: `cypress/fixtures/data/varejo/` gerada pelo mesmo script.

## 5. Arquivos donos

`scripts/fixtures/varejo/**` (novo), `fixtures/dbt-source/varejo/**` (novo),
`cypress/fixtures/data/varejo/**` (novo), `package.json` (só o script `fixtures:varejo`),
`cypress/e2e/varejo-smoke.cy.ts` (novo). **Não** editar fixtures existentes.

## 6. Gates (10)

1. Vitest: contagem exata por projeto e camada da tabela §3 (86 tabelas).
2. Vitest: `app_eventos` com ≥ 180 colunas; PK composta; 3 enums; 2 índices compostos presentes.
3. Vitest: 3 cadeias de linhagem com ≥ 4 saltos, resolvidas por `traceField` (S08) nos nomes do §3.
4. Vitest: todo model gerenciado tem todas as colunas com linhagem (`validateTransform` sem problemas
   quando a D4 existir; antes disso, checagem direta de `lineage` por coluna).
5. Vitest: `fromDbtProject` do resultado ≡ `StrataModel` do spec (ida e volta).
6. Vitest: gerar duas vezes → diretórios byte a byte idênticos.
7. `bash scripts/dbt/validate.sh fixtures/dbt-source/varejo`: `dbt parse` exit 0, sem deprecation
   warning; `dbt compile` exit 0 nos gerenciados.
8. Cypress `varejo-smoke.cy.ts`: abrir o domínio `varejo` → 3 projetos listados; projeto `vendas`
   abre com 34 tabelas visíveis e as arestas de linhagem esperadas.
9. Cypress: view `linhagem_receita` mostra só as tabelas da cadeia de receita.
10. Stress: abrir `varejo` inteiro (86 tabelas, 1 com 180+ colunas) — tempo até o canvas interativo
    registrado no relatório e ≤ tempo do stress sintético de 200 tabelas.

## 7. Fora de escopo
Dados reais nas tabelas (só seeds pequenas), execução de dbt contra banco, geração aleatória de
schemas.
