# D1 — Ler um projeto dbt

**Onda:** A · **Depende de:** — · **Decisão:** 0001 §3, §7.1, §7.2, §7.5

## 1. Resultado

Abrir no Strata um domínio cujo projeto está no layout dbt da 0001 mostra **o mesmo canvas** que o
equivalente em DBML mostraria: tabelas, colunas, tipos, PK/FK, notas, camadas, linhagem de campo,
grupos, cores, pins, views e posições. **Nesta fase o projeto dbt abre somente leitura**: toda ação de
edição fica desabilitada com o aviso "Edição de projetos dbt chega na próxima versão" (i18n). Projetos
DBML continuam 100% como hoje.

## 2. Layout lido (por domínio)

```
<domínio>/
  dbt_project.yml
  models/<projeto>/<camada>/_sources.yml
  models/<projeto>/<camada>/<model>.sql
  models/<projeto>/<camada>/_<model>.yml
  seeds/<projeto>/<tabela>.csv
  .strata/<projeto>/project.yml     ← marca o projeto como dbt; { format_version: 1, name, notation? }
  .strata/<projeto>/canvas.yml      ← positions, sizes, colors, pins, collapsed
  .strata/<projeto>/views.yml       ← views (mesma forma que SchemaView)
```

## 3. Módulos

**`src/features/dbt-source/` (TS puro, sem React, importável pelo servidor):**
- `model.ts` — `StrataModel`: tudo da tabela de fronteira da 0001 §3.
- `fromDbtProject.ts` — `fromDbtProject(files: ProjectFiles, projeto: string): StrataModel`
  - lê só `models/<projeto>/**`, `seeds/<projeto>/**`, `.strata/<projeto>/**`;
  - `ref()`/`source()` para outro projeto do domínio → tabela **externa** (reusa `ExternalGroupStub`),
    nunca "ausente";
  - models manuais: estrutura do YAML; linhagem só de `config.meta.strata.lineage` (inferência é S13);
  - resolve `data_type`, `constraints` (model) e testes `unique`/`not_null`/`relationships`
    (sources) para PK/FK/not null/unique;
  - enum de `config.meta.strata.enum` + `accepted_values`; índices de `config.meta.strata.indexes`.
- `toParseResult.ts` — `toParseResult(model: StrataModel): ParseResult` para o canvas.
- `fromDbml.ts` — `fromDbml(dbml): StrataModel` (usado pelos testes de equivalência e, na D6, pela
  migração).
- `toDbtProject.ts` — `toDbtProject(model, projeto): ProjectFiles` (usado aqui só para gerar
  fixtures e provar ida-e-volta; a escrita real é D2).

**Servidor:**
- `server/dbtSource/io.ts` — lê os arquivos do projeto em disco para `ProjectFiles`.
- `server/files.ts` — `projectFormat(slug): "dbt" | "dbml"` pela presença de
  `.strata/<projeto>/project.yml`.
- `GET /api/projects/:id` passa a responder `{ format: "dbml", dbml, canvas }` **ou**
  `{ format: "dbt", files: ProjectFiles }`. O cliente (`src/infrastructure/api`) tipa a união.
- `useWorkspace` hidrata: `dbml` → caminho atual; `dbt` → `toParseResult(fromDbtProject(files))`,
  posições de `.strata/canvas.yml`, `readOnly = true` no store.

## 4. Fixtures

- `fixtures/dbt-source/kitchen-sink.dbml` — todos os conceitos da tabela de fronteira (ver S14 §3.1
  para a lista mínima), num domínio com **2 projetos** (`vendas`, `estoque`) em que `estoque` faz
  `ref()` a `vendas`, e **1 projeto só de sources** com linhagem entre sources.
- `fixtures/dbt-source/kitchen-sink/` — o mesmo domínio em layout dbt, gerado por `toDbtProject` e
  **revisado à mão** (commit separado, para o diff ser legível).
- `cypress/fixtures/data/` — um domínio dbt novo (`dbt-demo`) ao lado dos existentes.

## 5. Gates (12)

1. Vitest: `fromDbtProject(kitchen-sink/, "vendas")` ≡ `fromDbml(kitchen-sink.dbml)` filtrado para
   `vendas` (igualdade estrutural; cada diferença esperada listada e justificada no teste).
2. Vitest: `toParseResult` desse modelo ≡ `parseDbml(kitchen-sink.dbml)` para tabelas, colunas,
   tipos, pks, refs, notes, lineageFields, layers, groups.
3. Vitest: `fromDbtProject(toDbtProject(m))` ≡ `m` (ida e volta).
4. Vitest: nada visual fora de `.strata/`; nada semântico dentro de `.strata/` (varre `toDbtProject`).
5. Vitest: enum preserva nome; índice composto preserva colunas e ordem; Records ↔ seeds CSV
   idênticos com não ASCII e vírgulas.
6. Vitest: `ref()` de `estoque` para `vendas` vira tabela externa, não erro.
7. Vitest: projeto só de sources → PK/FK/not null dos testes; linhagem entre sources presente.
8. Vitest (servidor): `projectFormat` distingue os dois; `GET /api/projects/:id` responde a união.
9. `validate.sh`: `dbt parse` exit 0 em `kitchen-sink/` com a última estável, **sem deprecation
   warning** — versões e saída salvas em `docs/superpowers/dbt-validate/`.
10. Cypress `dbt-read.cy.ts`: abrir o domínio `dbt-demo` → mesmo número de nós e arestas (FK e
    linhagem) que a fixture DBML equivalente; views listadas; posições aplicadas.
11. Cypress: no projeto dbt, "+ Tabela", renomear, excluir e arrastar relação estão desabilitados com
    o aviso; **nenhum arquivo em disco muda** após tentar cada um (compara mtime + conteúdo).
12. `npm run cy:run` completo verde sem alterar asserções existentes (projetos DBML intactos).

## 6. Fora de escopo
Escrita (D2), drawer (D3), transformação (D4), gerenciados (D5), migração (D6), inferência (S13).
