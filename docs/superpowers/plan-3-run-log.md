# Plan 3 run log

Orchestrator log for canvas verification (Tasks 35–42). One entry per task.
Baseline inventory (honest, after Wave M Task 30): **201 ☑ · 57 ☐ · 2 dropped**.

Pré-requisito Task 34b: `90b8d29` (SHA recorded in `ed52f66`).

---

## Task 35 — VERDE
Commit: `0d13647`
Portões que EU rodei: `npm run test` → 125 files / 875 tests; `npm run format:check` → 0; `npm run build` (typecheck + vite) → 0; `npm run e2e:serve` :5174 + `npm run cy:run` → boot-smoke 1 passing (912ms)
Linhas do inventário: n/a (scaffold; nenhuma linha marcada)
Decisões que tomei sozinho: matei LocalDrawDB residual na :5174 antes do Cypress (senão o spec batería no produto errado); `files.ts` `getDataDir()` ganhou o mesmo fallback `STRATA_*` (senão o rename era no-op sem slug); negação no `.gitignore` para `data/` não engolir `cypress/fixtures/data/`; `cy.dragNode` é stub que lança (Task 36 implementa); POST import + PUT porque import não persiste.
Preocupações: aviso Cypress 15 `allowCypressEnv` (config do plano verbatim); `git check-ignore -v` sai 0 na negação mas os 8 arquivos entram no índice; plano dizia 34 files em `server/`, hoje 37; `/?project=` o app ainda não honra — `activeId` commitado = smoke.
Bloqueio: —

## Task 36 — VERDE
Commit: `baf5f6c`
Portões que EU rodei: `npx cypress run --spec cypress/e2e/node-drag-smoke.cy.ts` → PASS (881ms); quebra deliberada `mousedown`→`pointerdown` (orquestrador, não o relatório) → FAIL `expected 700 to be close to 820 +/- 4` (nó não moveu); restore → PASS (882ms); `npm run cy:run` → boot-smoke + node-drag-smoke 2 passing
Linhas do inventário: n/a (guarda do helper; nenhuma linha marcada)
Decisões que tomei sozinho: o helper literal do plano era insuficiente no Cypress 15 (sem `event.view`, `window.trigger` não é EventTarget, zoom do InitialFit, `nodeDragThreshold=4`). Extras só de mouse, autorizados pelo brief. Não reescrevi o Canvas.
Preocupações: `cy.dragNode(dx,dy)` está em unidades de flow/translate, não pixels de tela. Tasks 37/39 têm de usar este helper como está. Aviso `allowCypressEnv` continua.
Bloqueio: — (Onda P não começa até o humano liberar)


