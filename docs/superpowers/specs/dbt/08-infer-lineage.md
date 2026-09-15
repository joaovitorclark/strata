# S13 — Linhagem inferida de models manuais

**Onda:** C (paralela a D3, D4, D5) · **Depende de:** D1, D2 · **Decisão:** 0001 §5 (models manuais)

## 1. Problema

Um model **gerenciado** tem linhagem declarada (`config.meta.strata.lineage`). Um model **manual**
— SQL escrito à mão, o caso de quase todo projeto dbt real importado — não tem. Sem inferência,
abrir um projeto dbt existente no Strata mostra tabelas soltas: nenhuma linhagem, que é justamente
o diferencial do produto.

## 2. Resultado

Ao carregar um projeto dbt, o Strata **infere** a linhagem de campo dos models manuais a partir do
SQL e mostra essas arestas como **inferidas** — visualmente distintas, nunca gravadas sozinhas. O
usuário pode **confirmar** (vira linhagem declarada no YAML) ou **descartar** (lembrado em
`.strata/`).

## 3. Níveis de confiança

| Nível | Como se obtém | Aresta |
| --- | --- | --- |
| `declared` | `config.meta.strata.lineage` (gerenciado ou confirmado) | mauve tracejada (S09) |
| `parsed` | a coluna do SELECT referencia `alias.coluna` resolvido até uma relação `ref()`/`source()` | mauve **pontilhada**, 1px |
| `name` | não foi possível resolver pelo SQL, mas a relação upstream (de `ref()`/`source()`) tem coluna de mesmo nome | mauve pontilhada, 60% de opacidade, rótulo `?` no hover |
| `unknown` | macro/Jinja não resolvido, `select *` sem colunas conhecidas, SQL que não parseia | sem aresta; a coluna ganha o problema informativo "linhagem não inferida" |

A linhagem **de tabela** (quais relações o model lê) vem de `ref()`/`source()` e é sempre exata; só a
de campo é inferida.

## 4. Pipeline de inferência (Node, sem dbt instalado)

`src/features/dbt-source/infer/`:

1. **`preprocessJinja.ts`** — substitui `{{ ref('x') }}` → identificador `__ref__x`,
   `{{ source('s','t') }}` → `__src__s__t`, `{{ this }}` → `__this__`; `{{ config(...) }}` e
   `{% ... %}` de controle → removidos **com registro**; qualquer outro `{{ ... }}` → marca o model
   como "contém macro" (a inferência continua, e colunas que dependem do trecho viram `unknown`).
2. **`parseSelect.ts`** — `node-sql-parser` (já dependência) com dialeto escolhido pelo adapter de
   `dbt_project.yml`/`profiles` (Spark/Hive → `hive`, Postgres → `postgresql`, fallback `mysql`
   e depois `bigquery`). Falha em todos → `unknown` para o model inteiro, com o erro guardado para o
   painel Problemas.
3. **`resolveColumns.ts`** — percorre o AST:
   - CTEs em ordem, cada uma vira uma relação intermediária com suas colunas;
   - aliases de tabela e de subquery;
   - `select *` e `alias.*` expandem com as colunas conhecidas da relação (do YAML upstream); sem
     colunas conhecidas → `unknown` para o que o `*` cobriria;
   - cada item do SELECT final → conjunto de colunas de origem (todas as referências dentro da
     expressão, através de CTEs, até relações `__ref__`/`__src__`);
   - `union all`: a coluna N do resultado herda as origens da coluna N de cada ramo;
   - coluna do YAML do model sem item correspondente no SELECT → `unknown`.
4. **`nameFallback.ts`** — para colunas `unknown` sem macro envolvida: se exatamente **uma** relação
   upstream tem coluna de mesmo nome → `name`; mais de uma → continua `unknown`.
5. **`inferLineage.ts`** — orquestra e devolve
   `InferredLineage[] = { target: {model, column}, from: {relation, column}[], level, reason? }`.

Custo: inferência roda no load e quando um `.sql` manual muda; resultado em memória (não persiste).
Orçamento: ≤ 1,5 s para 200 models manuais em máquina de desenvolvimento, com Web Worker no cliente
se passar de 150 ms no thread principal.

## 5. Confirmar e descartar

- **Confirmar** (aresta, coluna ou "confirmar todas `parsed` deste model"): grava em
  `config.meta.strata.lineage` via `yamlEdit` com `{ from, inferred: parsed|name }` — o marcador fica
  para auditoria; a partir daí o nível é `declared`.
- **Descartar**: grava em `.strata/<projeto>/lineage-dismissed.yml` (`model.coluna ← relação.coluna`);
  a aresta não volta enquanto a entrada existir. Reverter pelo inspector.
- **Nunca** gravar inferência sem ação do usuário. Nunca alterar o `.sql` manual.
- Se o SQL mudar e uma linhagem **confirmada** deixar de aparecer na inferência → problema
  informativo "linhagem declarada não encontrada no SQL" (não remove nada).

## 6. UI

- Arestas inferidas conforme §3; legenda no menu de exibição da pill: "Linhagem inferida" liga/desliga
  (padrão ligado).
- Hover numa aresta inferida: tooltip com nível, motivo e botões **Confirmar** / **Descartar**.
- Inspector da coluna (seção Linhagem): origens declaradas e inferidas separadas, com as mesmas ações.
- Menu do model manual: "Confirmar linhagem inferida (N parsed)".
- Painel Problemas: models que não parsearam e colunas `unknown`, agrupados por model.

## 7. Arquivos

`src/features/dbt-source/infer/**` (novo), `src/features/canvas/components/FieldLineageEdge.tsx`
(estilo por nível), `src/features/shell/inspector/LineageSection.tsx` (seções e ações),
`src/features/canvas/toolbar/EdgeVisibility.tsx` (toggle), `fixtures/dbt-source/infer/**`.
Escrita apenas pelas operações de `yamlEdit` (D2) e um novo `yamlEdit.infer.ts` para `inferred:`.

## 8. Fixtures

`fixtures/dbt-source/infer/` — projeto dbt com models manuais cobrindo: rename simples; expressão com
duas colunas; CTE encadeada; join com aliases; subquery no FROM; `select *` com upstream conhecido;
`select *` com upstream desconhecido; `union all`; macro desconhecida numa coluna; `{% if %}`; SQL que
não parseia; coluna do YAML ausente no SELECT; nomes iguais em duas relações upstream. Cada model tem
um arquivo `expected.yml` ao lado com a linhagem esperada por coluna e nível.

## 9. Gates (12)

1. Vitest: `preprocessJinja` — `ref`, `source`, `this`, `config`, `{% if %}`, macro desconhecida (6 casos).
2. Vitest: para cada model de `infer/`, `inferLineage` ≡ `expected.yml` (um caso por model; 13 casos).
3. Vitest: `union all` herda origens por posição.
4. Vitest: `name` só com exatamente uma relação upstream com o nome; duas → `unknown`.
5. Vitest: SQL que não parseia em nenhum dialeto → model `unknown` com erro guardado.
6. Vitest: confirmar grava `lineage` com `inferred:` e só essas linhas mudam no YAML (diff).
7. Vitest: descartar grava `.strata/<projeto>/lineage-dismissed.yml`; inferência seguinte não devolve
   a entrada.
8. Vitest: linhagem confirmada que some do SQL → problema "linhagem declarada não encontrada no SQL";
   nada removido.
9. Vitest de desempenho: 200 models manuais sintéticos em ≤ 1,5 s (registrar tempo).
10. Cypress `infer-lineage.cy.ts`: abrir o projeto `infer/` → arestas pontilhadas presentes; nenhum
    arquivo em disco mudou após o load.
11. Cypress: hover numa aresta `parsed` → Confirmar → vira tracejada e o YAML ganha a entrada.
12. Cypress: desligar "Linhagem inferida" na pill → arestas inferidas somem; declaradas ficam.

## 10. Fora de escopo
Executar `dbt compile` para resolver macros (possível melhoria futura quando o CLI estiver instalado),
linhagem através de seeds/snapshots/python models, inferência para models gerenciados (já declarada).
