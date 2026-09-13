# Plan 4 run log

Orchestrator log for canvas mutation coverage (Tasks 48–55). One entry per task.
Baseline inventory (after Onda S): **209 ☑ · 49 ☐ · 2 dropped**.

`$LDB` was not written. Cypress ran serialised against `:5174` (`npm run e2e:serve` → `.e2e-data/` copy). Agents wrote specs; they did not run Cypress against the shared port.

---

## Extra 2 — the guard found the wrong bug (before 48b)

Task 48's deliberate break (`mousedown` → `pointerdown`) was meant to prove `cy.connectHandles` actually connects. It failed on **Ref count** the first time (the right failure). A later break failed in the **baseline** instead of the new Ref — the suite had dirtied the committed smoke fixture.

A guard that only said "red" would have hidden that. The first `git checkout` of the fixture treated the symptom. Task 48b fixes the cause.

---

## Task 48 — VERDE

Commit: `6374798`

Portões que EU rodei: `handle-connect-smoke.cy.ts` green; deliberate `mousedown` → `pointerdown` failed on Ref count (not a missing selector); restore → green.

Linhas do inventário: n/a (helper guard).

Decisões: helper is mouse-only; handles selected by `data-nodeid` + `data-handleid`.

Bloqueio: —

---

## Task 48b — VERDE

Commit: `866b78e`

Portões que EU rodei: guarda **duas vezes seguidas** sem resetar entre elas; `git status cypress/fixtures/` limpo nas duas.

O quê: `.e2e-data/` no `.gitignore`; `scripts/e2e-serve.mjs` apaga, copia `cypress/fixtures/data/` com `fs.cpSync`, sobe com `STRATA_DATA_DIR=.e2e-data`. `resetFixture` não usa `git checkout` / `cy.exec`.

`resetFixture` (commit da Task 49) passou a ativar, PUT do DBML+canvas commitados, GET de confirmação, **um** `cy.visit("/")` — `seedProject`+`reload` deixava o app em "Carregando…".

Bloqueio: —

---

## Task 49 — VERDE

Commit: `2cca0f5`

Portões: `npx cypress run --spec cypress/e2e/canvas-actions.cy.ts` → **19 passing**.

Linhas: ☑ **47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 63** → `canvas-actions.cy.ts`.

Mutação: gesto → `saveViaPaletteShortcut()` → `cy.dbmlText()`. Readers (53, 58, 60, 63) assertem o valor renderizado contra o modelo.

Bloqueio: —

---

## Task 50 — VERDE (com drop honesto)

Commit: `35f2d96`

Portões: `canvas-create.cy.ts` → **5 passing** (inclui guarda `reconnectHandle`).

Linhas: ☑ **40, 66, 67, 69**. Dropped **68**.

Guarda `reconnectHandle`: quebra `mousedown` → `pointerdown` falha no **texto do Ref** (`> vendas.cliente.id` permanece), não num seletor.

**68:** `ColumnRow` não monta handles `fl:`. Spec contou 0. `onConnect` já aceita `fl:`. Handles não foram adicionados.

Bloqueio: —

---

## Task 51 — VERDE

Commit: `3154e53`

Portões: `canvas-delete-chrome.cy.ts` → **11 passing**.

Linhas: ☑ **70, 71, 78, 79, 85, 86, 87, 88**.

**78/79:** `prompt` / `confirm` stubados (não dropados). 79 não tem × no TableNode — o affordance é o menu **Delete** + confirm.

**87:** Enter confirma **e** Escape cancela (dois `it`s).

Bloqueio: —

---

## Task 52 — VERDE

Commit: `607cdb9`

Portões: `canvas-palette.cy.ts` → **7 passing**.

Linhas: ☑ **80, 81, 82, 83, 84, 90, 91**.

Hexes de `TABLE_COLORS`. Paleta de grupo: primeiro botão da row (DOM é `rgb(...)`, não o hex no `style`).

Bloqueio: —

---

## Task 53 — VERDE (com dois drops honestos)

Commit: `338d719`

Portões: `canvas-select-sync.cy.ts` → **15 passing**.

Linhas: ☑ **39, 41, 43, 73, 74, 75, 76, 89, 92, 247**. Dropped **46, 65**.

**43:** Cmd/Ctrl+click marca as duas tabelas `.selected`. Rubber-band tentado: pane-drag sem Shift pana (`onlyRenderVisibleElements` desmonta nós); `selectionOnDrag && panOnDrag !== true` é false (Canvas deixa `panOnDrag` no default); Shift real suprime o pan mas o box da Pane (`onPointerDownCapture`) não marca `.selected`. Canvas não foi reescrito.

**46:** CommandPalette escuta Escape em capture no `window` e chama `clearCanvasSelection()` antes do handler empilhado do Canvas. Primeiro Esc já tira a tabela. Paleta não reescrita.

**65:** `dragHandle` do GroupNode (label e borda; MouseEvent nativo; `trigger`+`view` como `cy.dragNode`). Membros ficam em dx=0. `onNodeDrag` de produção moveria se o XYDrag latchasse. GroupNode não reescrito.

Bloqueio: —

---

## Task 54 — VERDE (ⓘ = hover, não restore)

Commit: `f7b8e62`

Decisão: **manter hover**. `TableInfoPopover` já mostra sources, sample, PK/FK, dbt e notes via `hoveredTableId`. O ⓘ do LocalDrawDB seria um segundo trigger do mesmo conteúdo e exigiria reescrever TableNode. Spec do hover: `canvas-select-sync.cy.ts` (row 42 it) + `canvas-actions.cy.ts` (row 63).

Linha: dropped **42**.

Bloqueio: —

---

## Task 55 — portão final

Portões que EU rodei nesta sessão:

| Comando | Resultado |
| --- | --- |
| `npm run test` | 125 files / 880 tests (segunda corrida). Primeira corrida: flake em `server/__tests__/files.test.ts` (`inputDir` null — isolamento de domínio entre arquivos). Isolado e a suite completa na segunda: green. |
| `npm run typecheck` | 0 |
| `npm run format:check` | 0 |
| `npm run cy:run` | **83 passing** / 18 specs / 1m10s |
| `npm run cy:run:stress` | **8 passing** (large 4, node-height 1, wide 3). node-height, vermelho no Plan 3 Task 39, agora verde. |
| `git status cypress/fixtures/` | limpo |

### Contagem

```
Baseline (Onda S):     ☑ 209   ☐ 49   dropped 2
After Plan 4 Task 54:  ☑ 254   ☐  0   dropped 6
```

254 + 6 = 260. Zero ☐.

Drops deste plano: **42, 46, 65, 68** (mais 219 e 244 do Task 26).

### Amostra isolada (Step 3)

Cinco linhas ☑, uma de cada task da Onda U. Spec de cada uma **sozinho** (`npx cypress run --spec <file>`):

| Linha | Task | Spec | Isolado |
| --- | --- | --- | --- |
| 47 | 49 | `canvas-actions.cy.ts` | 19 passing |
| 40 | 50 | `canvas-create.cy.ts` | 5 passing |
| 87 | 51 | `canvas-delete-chrome.cy.ts` | 11 passing |
| 81 | 52 | `canvas-palette.cy.ts` | 7 passing |
| 73 | 53 | `canvas-select-sync.cy.ts` | 15 passing |

Nenhum spec passou só na corrida grande. Nenhum ☑ destiqueado.

### ⓘ

Registado na Task 54: hover, não restore.

Bloqueio: —
