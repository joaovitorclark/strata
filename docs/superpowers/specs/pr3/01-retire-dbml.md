# P1 — Aposentar o DBML por completo

**Onda:** 1 · **Depende de:** Onda C dbt integrada · **Decisão:** 0002 §3 · **Absorve:** `specs/dbt/06-migrate-and-retire-dbml.md`

## 1. Resultado

O Strata não sabe mais o que é DBML. Todo projeto é dbt. Nenhum código, rota, tipo, string, teste
ou fixture menciona DBML, com duas exceções: `scripts/migrate-dbml-to-dbt.mjs` e `docs/decisions/**`.

## 2. O que muda em relação à D6

Leia a D6 inteira; valem as §2 (migração) e §3 (lista de remoção) **com estas trocas**:

| D6 dizia | P1 faz |
| --- | --- |
| "Converter para dbt" no menu do projeto e banner em projetos DBML | **Script fora do app:** `node scripts/migrate-dbml-to-dbt.mjs <pasta-do-domínio>` com backup em `.strata/<projeto>/legacy/` e `migration-report.md`. O app não detecta nem converte nada. Um projeto sem `.strata/<projeto>/project.yml` simplesmente não aparece (e o Problemas do domínio diz "pasta sem projeto dbt: rode o script de migração"). |
| DBML continua como importador ao lado de SQL e dbt | **Sai o importador DBML.** Importar = abrir pasta dbt (P7) ou colar SQL `CREATE TABLE` (fica). |
| Aba DBML no drawer removida | Idem, e sai também "Editar no DBML", "Organizar DBML", "+ Metadados" e toda ação do navbar que só existia para o DBML. |

A lógica de conversão (`fromDbml.ts`) **muda de lugar** para `scripts/migrate-dbml/` e deixa de ser
importada por `src/` ou `server/`.

## 3. Inventário obrigatório

Antes de apagar, gerar `docs/superpowers/pr3-dbml-removal.md` a partir de
`rg -il dbml src server cypress scripts fixtures package.json` (hoje ~180 arquivos, sem contar
`cypress/reports/`): uma linha por arquivo com **apagar** / **reescrever sobre dbt** / **mover para o
script**, e para cada teste Cypress/Vitest apagado, a função que ele cobria e se ela continua
existindo (se continua, o teste é reescrito, não apagado).

## 4. Fixtures

- Cypress: `cypress/fixtures/data/**` só com domínios dbt (`varejo`, o domínio dbt da D1 e o
  `infer/` da S13). O domínio DBML de smoke é convertido pelo script e commitado já convertido.
- `fixtures/golden/**`: goldens de exportação regenerados a partir de `StrataModel`.
- Stress: gerador sintético passa a emitir projeto dbt (200 tabelas).

## 5. Gates (10)

1. `rg -i dbml src server cypress/e2e cypress/support cypress/fixtures scripts fixtures package.json`
   → só `scripts/migrate-dbml-to-dbt.mjs` e `scripts/migrate-dbml/**`.
2. `docs/superpowers/pr3-dbml-removal.md` presente, cobrindo 100% do resultado do `rg` inicial.
3. Vitest: o script converte a antiga fixture de smoke e o `kitchen-sink` com **zero perdas** no
   relatório; rodar duas vezes não altera nada na segunda.
4. Vitest (servidor): nenhuma rota aceita `format: "dbml"`; `PUT /api/projects/:id` só aceita
   `{format:"dbt", changes}`.
5. Vitest: pasta de domínio com projeto sem `.strata/<projeto>/project.yml` → não listado; Problemas
   do domínio mostra a mensagem da §2.
6. `createProject` cria `.strata/<projeto>/project.yml` + `models/<projeto>/{bronze,silver,gold}/`;
   o projeto recém-criado mostra o estado vazio (defeito pendente da S12).
7. Cypress: smoke completo sobre o domínio convertido passa.
8. Cypress stress (manual) sobre as 200 tabelas dbt registra tempo ≤ o do relatório da PR 2.
9. `npm run fixtures:varejo` sem diff; `bash scripts/dbt/validate.sh` exit 0.
10. Bundle: `npm run build` → nenhum chunk contém `@dbml/core` (checar com `rg -l "@dbml" dist`).

## 6. Fora de escopo
Qualquer mudança visual (P2+). Importar dbt de repositório remoto (P7).
