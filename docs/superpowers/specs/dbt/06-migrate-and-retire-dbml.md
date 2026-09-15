# D6 — Migrar projetos DBML e aposentar o DBML

> **Absorvida pela P3·P1** ([`../pr3/01-retire-dbml.md`](../pr3/01-retire-dbml.md)), decisão 0002 §3: sem conversão no app e sem importador DBML. Leia esta spec só pelas §2–§3 que a P1 referencia.

**Onda:** D · **Depende de:** D3, D4, D5 · **Decisão:** 0001 §2.2, §7.4

## 1. Resultado

1. **Migração:** todo projeto DBML existente pode ser convertido para dbt por uma ação explícita,
   com backup e relatório. Novos projetos já nascem dbt.
2. **Aposentadoria:** o DBML deixa de ser formato de projeto. Continua existindo **só** como
   importador ("Importar DBML", ao lado de SQL e dbt).
3. **Exportadores** passam a ler de `StrataModel`, não de DBML.

## 2. Migração

- Ação "Converter para dbt" no menu do projeto e banner em projetos DBML.
- Passos: `fromDbml(project.dbml)` + `canvas.json` → `toDbtProject` → escrever no domínio →
  `.strata/<projeto>/migration-report.md` → mover `project.dbml` e `canvas.json` para
  `<domínio>/.strata/<projeto>/legacy/` (backup, não apagar).
- Relatório: contagem por conceito (tabelas, colunas, refs, mapeamentos, views…), e **toda perda ou
  aproximação** (ex.: índice que virou `meta`), uma linha cada. Zero perdas esperado; qualquer perda
  bloqueia a conversão e pede confirmação.
- Conflito de nome de model no domínio → sugere prefixo `<projeto>_`; nunca sobrescreve.
- `createProject` (servidor) passa a criar projeto dbt (`.strata/<projeto>/project.yml` + pastas).
- O mesmo sinal de hidratação da C6 decide o estado vazio: **projeto recém-criado mostra o estado
  vazio** (corrige o defeito pendente da S12: hoje `Workspace.tsx` exige DBML não vazio).

## 3. O que sai (lista de remoção — contar no relatório)

| Onde | Remove |
| --- | --- |
| Store | `dbml` como documento de projeto; histórico baseado em string DBML |
| `useWorkspace` / `mutations.ts` | ramo DBML do roteamento |
| `schema/model/edit.ts` | mutações de texto DBML (o que ainda for usado pelo importador migra para `fromDbml`) |
| `schema/model/` | blocos proprietários: `Records`, `LayerGroup`, `LineageFields`, `Dbt`, `Rolenames`, `Colors`, `Pins`, `Views` (parse, serialize, organize, clean) |
| `source/` | aba DBML, `SourceDrawer` DBML, organizar DBML, rename detect de DBML |
| Servidor | `project.dbml`, `dbmlIo` como formato de projeto; rotas `/api/export/*` recebem projeto, não `{ dbml }` |
| Palette / navbar | "Organizar DBML" e afins |
| Cypress | specs que dirigem DBML como documento viram specs dbt equivalentes; asserções "DBML muda" viram "arquivo dbt muda" (lista completa no relatório, uma por uma) |

Fica: `fromDbml` (importador), `@dbml/core` só dentro dele.

## 4. Exportadores

Os 9 exportadores (`dbt`, `erwin`, `mermaid`, `oracle-ddl`, `postgres-ddl`, `spark-ddl`, `xlsx`,
`llm-context`, `localdrawdb`) recebem `StrataModel`. O exportador `dbt` vira "empacotar o projeto".
Os golden fixtures em `fixtures/golden/` continuam a referência: a saída de cada exportador a partir
de `fromDbml(sample.dbml)` deve ser **idêntica** à atual.

## 5. Gates (12)

1. Vitest: converter `kitchen-sink.dbml` → relatório com zero perdas; `fromDbtProject` ≡ `fromDbml`.
2. Vitest: conversão com um índice sem mapeamento → bloqueia e lista a perda.
3. Vitest (servidor): conversão grava atomicamente e move os arquivos legados para `legacy/`.
4. Vitest: os 9 exportadores a partir de `StrataModel` batem **byte a byte** com `fixtures/golden/`.
5. Varredura de remoção: `grep` por `parseLineageBlock|parseColorsBlock|Pins\s*\{|Views\s*\{|project\.dbml|dbmlToModel|modelToDbml|setDbml`
   fora de `src/features/dbt-source/fromDbml.ts` e testes do importador → **0 ocorrências**. Contar
   por padrão no relatório.
6. Cypress `migrate.cy.ts`: projeto DBML da fixture → "Converter para dbt" → canvas igual antes e
   depois (nós, arestas, posições); arquivos dbt em disco; `legacy/` presente.
7. Cypress: criar projeto novo → nasce dbt e mostra o estado vazio.
8. Cypress: "Importar DBML" num projeto dbt → tabelas criadas como arquivos dbt.
9. Cypress: nenhum item "DBML" na UI (navbar, palette, drawer, menus) — varredura por texto visível.
10. `validate.sh`: `dbt parse` aceita o resultado da conversão da fixture Cypress inteira.
11. `npm run cy:run` e `cy:run:stress` completos verdes (stress sobre fixture dbt de 200 tabelas).
12. `AGENTS.md` e `docs/identity.md` atualizados: fonte da verdade, regra de verificação por arquivo
    dbt, north stars 4 e 6; `docs/parity-inventory.md` com as linhas DBML marcadas
    `dropped — superseded by 0001/D6`.
