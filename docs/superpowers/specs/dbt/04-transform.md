# D4 — IR de transformação e geração de SQL (dbt e Spark)

**Onda:** C · **Depende de:** D2 · **Decisão:** 0001 §5, §5.1

## 1. Resultado

Um model **gerenciado** tem sua transformação descrita em `config.meta.strata.transform` + a linhagem
das colunas, e o Strata gera a partir disso:
- o `.sql` dbt do model (com `ref()`/`source()`), gravado em disco;
- o **Spark SQL** equivalente (nomes físicos resolvidos, sem Jinja), disponível no menu Exportar.

A edição desta fase é pelo **inspector** (seção Transformação). A visão "antes/depois" no canvas é
uma fase de UX posterior, **com protótipo aprovado antes** — não entra aqui.

## 2. IR

```yaml
config:
  meta:
    strata:
      managed: true
      transform:
        from: { ref: <model> | source: [<source>, <table>], alias: <a> }
        joins:
          - { ref: <model>, alias: <b>, type: inner|left|right|full, on: "<expr>" }
        where: "<expr>"          # opcional
        group_by: ["<expr>", …]  # opcional; presente = agregação
        having: "<expr>"         # opcional
        distinct: false          # opcional
```

Colunas: `config.meta.strata.lineage: [{ from: "<alias>.<col>", expr?: "<sql>" }]`.
- Sem `expr` e um `from` → `<alias>.<col> as <coluna>`.
- Com `expr` → `<expr> as <coluna>` (o `from` continua sendo a linhagem declarada).
- Mais de um `from` sem `expr` → erro de validação ("coluna com várias origens precisa de expr").
- Coluna sem linhagem num model gerenciado → erro de validação no painel Problemas.

Expressões são **texto SQL** guardado como está; o Strata não as reescreve. Validação: `sqlglot` no
`validate.sh` e, no app, só checagem de aliases (todo `alias.` usado existe em `from`/`joins`).

## 3. Módulos

- `transform.ts`
  - `validateTransform(model, modelName): Problem[]`
  - `toDbtSql(model, modelName): string` — CTEs por relação (`with p as (select * from {{ ref('…') }})`),
    select final com as colunas na ordem do YAML, joins, where, group by, having.
  - `toSparkSql(model, modelName, { catalog?, schema? }): string` — mesmo IR, `ref()`/`source()`
    resolvidos para `catalog.schema.tabela` a partir de `dbt_project.yml` + `config.schema`/
    `config.alias` + `sources[].schema/database`; sem CTE de `select *` redundante.
- Inspector `TransformSection.tsx` (visível só em model gerenciado): editar `from`, joins
  (adicionar/remover, tipo, on), where, group by, having; por coluna, `expr`. Grava via operações da
  D2 (`setTransform`, `setColumnExpr` — em `yamlEdit.transform.ts`, novo, com os mesmos gates de preservação)
  e regenera o `.sql`.
- Criar model gerenciado: ação "Novo model a partir da seleção" (tabelas selecionadas viram `from` +
  joins sugeridos pelas FKs entre elas; colunas vazias).
- Exportar → "Spark SQL (selecionados | projeto)" gera arquivos em `output/spark/<projeto>/`.

## 4. Gates (10)

1. Vitest: `validateTransform` — 6 casos (alias inexistente, várias origens sem expr, coluna sem
   linhagem, join sem on, group_by com coluna não agregada sem expr, ok).
2. Vitest: `toDbtSql` — 5 snapshots revisados à mão: rename simples, `expr` com cast, left join,
   where, group by + agregação.
3. Vitest: `toSparkSql` — os mesmos 5, com nomes físicos resolvidos, incluindo `config.alias` e source
   com `database`.
4. `validate.sh`: `dbt compile` nos 5 models gerados, exit 0; SQL compilado ≡ `toDbtSql` sem Jinja
   (normalizado por `sqlglot`).
5. `validate.sh`: `sqlglot` com `read="spark"` aceita os 5 Spark SQL.
6. Vitest: `setTransform`/`setColumnExpr` alteram só as linhas esperadas em `handwritten/`.
7. Cypress `transform.cy.ts`: "Novo model a partir da seleção" com 2 tabelas ligadas por FK → YAML com
   `transform.from` + join sugerido e `.sql` gerado em disco.
8. Cypress: definir `expr` de uma coluna no inspector → `.sql` regenerado contém a expressão.
9. Cypress: Exportar Spark SQL → arquivo em `output/spark/…` com o SQL esperado.
10. Cypress: model **manual** → seção Transformação ausente; `.sql` nunca reescrito após editar
    colunas no inspector.

## 5. Fora de escopo
Canvas antes/depois (D7, protótipo aprovado), inferência de linhagem de SQL manual (S13),
`dbt compile` de models manuais.
