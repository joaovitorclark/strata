# UX/UI rework — run log

Orchestrator log. Branch base: `research/ux-ui-proposal` (`d34f4ed`).
Worktree: `/Users/jvclark/www/strata-ux-research`.

---

## Baseline — 2026-09-13 — BLOCKED (lint)

`npm ci` (747 packages). Gates run from the research worktree.

| Gate | Result | Numbers |
| --- | --- | --- |
| `typecheck` | ✓ | 3 tsconfigs, ~11s |
| `lint` | ✗ | **165 errors, 2 warnings** in 34 files |
| `format:check` | ✓ | Prettier clean |
| `test` | ✓ | **125 files / 881 tests**, 34.93s (Vitest 4.1.1) |
| `build` | ✓ | typecheck + vite, 2575 modules, `dist/assets/index-BqI5v3F5.js` 12 167 kB (gzip 2 135 kB), 1.83s |
| `cy:run` | ✓ | **18 specs / 83 tests**, 01:01 |
| `cy:run:stress` | ✓ | **3 specs / 8 tests**, 00:08 |

`:5174` was already occupied by a leftover `tsx server/index.ts` in `~/www/strata`. Baseline e2e used `PORT=5175 E2E_DATA_DIR=.e2e-data-ux-baseline`.

### Lint (the blocker)

Inherited from the LocalDrawDB port. `eslint.config.js` is the migration-foundation template (`typescript-eslint` recommended + `react-hooks` recommended). Previous waves gated on format/typecheck/test/build/cypress; lint was never green.

Top rules:

- `@typescript-eslint/no-explicit-any` × 100
- `react-hooks/refs` × 38 (28 of them in `Workspace.tsx`)
- `@typescript-eslint/no-unused-vars` × 14
- `react-hooks/set-state-in-effect` × 4
- plus `no-useless-escape`, `no-useless-assignment`, `react-hooks/exhaustive-deps`, `react-hooks/immutability`, `prefer-const`, `@typescript-eslint/no-unsafe-function-type`

Top files: `Workspace.tsx` (28), `dbtExport.test.ts` (21), `dbtImport.ts` (12), `routes.ts` (12), `domainRoutes.ts` (11).

README §2 requires every spec subagent to report `lint ✓`. With the baseline red, every spec would fail that gate. Waves not started.

---

## Lint fix — 2026-09-13 — VERDE (gates locais)

Opção 2: corrigir os 165, sem afrouxar o eslint. Asserções de teste existentes não mudaram (só tipos).

| Gate | Result | Numbers |
| --- | --- | --- |
| `lint` | ✓ | 0 errors |
| `typecheck` | ✓ | 3 tsconfigs |
| `format:check` | ✓ | Prettier clean |
| `test` | ✓ | **125 files / 881 tests**, 32.68s |
| `build` | ✓ | 2575 modules, `index-Cd1mYlH3.js` 12 167 kB (gzip 2 135 kB) |
| `cy:run` | ✓ | **83/83**, 01:04 (after restoring last-good parse to `useEffect`) |
| `cy:run:stress` | ✓ | **8/8**, 00:08 |

O que mudou (resumo):

- `any` → tipos estruturais / `unknown` + narrowing. Helpers: `server/unknownError.ts`, `server/__tests__/yamlDoc.ts`.
- `react-hooks/refs`: `useStable` via `useMemo`; refs de “último valor” em `useLayoutEffect`; `assignEditorRef` no lugar de devolver `RefObject`; Workspace desestrutura o hook.
- `set-state-in-effect`: wizard/records no padrão “adjust state during render”. Last-good parse **ficou em `useEffect`** com disable pontual — o setState durante o render fez `⌘Z` falhar com `ResizeObserver loop` (2/2 vermelho; depois do revert, 83/83).
- `immutability`: `layers` entra no `useMemo` de `actions`.
- unused / escapes / prefer-const / exhaustive-deps mecânicos.

Disable pontual restante: `react-hooks/set-state-in-effect` em dois `useEffect` de `useWorkspace.ts` (last-good parse). Não há `any`.

O que mudou (resumo):

- `any` → tipos estruturais / `unknown` + narrowing. Helpers: `server/unknownError.ts`, `server/__tests__/yamlDoc.ts`.
- `react-hooks/refs`: `useStable` via `useMemo`; refs de “último valor” em `useLayoutEffect`; `assignEditorRef` no lugar de devolver `RefObject`; Workspace desestrutura o hook.
- `set-state-in-effect`: last-good parse e sync de wizard/records no padrão “adjust state during render”.
- `immutability`: `layers` entra no `useMemo` de `actions`.
- unused / escapes / prefer-const / exhaustive-deps mecânicos.

### Stress times (no FPS counter in the current suite)

The 200-table pan test (`stress-large-diagram` “pans and zooms without the page becoming unresponsive”) is qualitative — Cypress does not record FPS. Durations:

| Spec | Tests | Duration |
| --- | --- | --- |
| `stress-large-diagram.cy.ts` (200 tables, pan/zoom, minimap lite) | 4 | 2s |
| `stress-node-height.cy.ts` | 1 | 2s |
| `stress-wide-table.cy.ts` (187-col hub, virtualisation) | 3 | 2s |
| **total** | **8** | **8s** |

`nodeHeight` vs paint (delta 0px every row):

| id | density | state | offsetHeight | predicted | delta |
| --- | --- | --- | --- | --- | --- |
| wide.hub | cozy | sigil | 34 | 34 | 0 |
| wide.hub | cozy | keys | 110 | 110 | 0 |
| wide.hub | cozy | full | 410 | 410 | 0 |
| wide.left | cozy | sigil / keys / full | 34 / 110 / 110 | same | 0 |
| wide.right | cozy | sigil / keys / full | 34 / 110 / 110 | same | 0 |
| wide.hub | compact | sigil | 34 | 34 | 0 |
| wide.hub | compact | keys | 102 | 102 | 0 |
| wide.hub | compact | full | 354 | 354 | 0 |
| wide.left | compact | sigil / keys / full | 34 / 102 / 102 | same | 0 |
| wide.right | compact | sigil / keys / full | 34 / 102 / 102 | same | 0 |

Smoke Cypress durations (for later comparison): `canvas-actions` 13s (19 tests), `canvas-select-sync` 8s (15), `canvas-delete-chrome` 7s (11). Rest under 5s. Total 61s / 83 tests.

### Smoke spec list (83 passing)

boot-smoke 1 · canvas-actions 19 · canvas-create 5 · canvas-delete-chrome 11 · canvas-drag 1 · canvas-edges 3 · canvas-layer-edge 1 · canvas-lod 1 · canvas-palette 7 · canvas-peek 1 · canvas-select-sync 15 · canvas-selection 1 · handle-connect-smoke 2 · node-drag-smoke 1 · shell-command-palette 8 · shell-export-menu 1 · shell-focus-visibility 1 · shell-shortcuts 4.

---

## Waves

### Onda 1 — S01 ∥ S02 — 2026-09-14 — VERDE

Branch `ux/wave-1` (`7fa0678` + follow-up de seletores). Base: `b99027d`.

Worktrees: `/Users/jvclark/www/strata-ux-s01` (`ux/s01`), `/Users/jvclark/www/strata-ux-s02` (`ux/s02`), `/Users/jvclark/www/strata-ux-wave-1`.

#### Validação independente (README §2)

| Spec | typecheck | lint | format | test | build | cy:run | stress |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 `d3e2b89` | ✓ | ✓ | ✓ | **128 / 904** | 12 164 kB | **87/87** 01:04 (porta 5176) | **8/8** 00:08 |
| S02 `3b9fdb1` | ✓ | ✓ | ✓ | **126 / 885** | 12 178 kB | **90/90** 01:10 (porta 5177) | n/a |
| `ux/wave-1` integrado | ✓ | ✓ | ✓ | **129 / 907** | 12 174 kB | **94/94** 01:12 (porta 5178) | **8/8** 00:08 |

Primeira corrida S01 em paralelo com S02 falhou 1/87 (`handle-connect-smoke`, `ResizeObserver loop`). Isolada e a suíte serial: 87/87. Não é regressão de produto.

`files.test.ts` falhou 1× no worktree fresco (sem `data/`); rerun 907/907. Pré-existente / ordem de workers.

Smoke wall-clock 72s vs baseline 64s (+12%) **com 94 testes vs 83**. Por teste: ~0,77s vs ~0,77s. Sem regressão de FPS (a suíte não mede FPS). Stress pan 200 tabelas qualitativo; `nodeHeight` delta 0px.

#### Gates

- S01 **G1–G31** (31/31). Cypress G16–G21 em `s01-field-lineage.cy.ts`.
- S02 **G1–G10** (10/10). Vitest G1–G2; Cypress G3–G10 em `shell-chrome.cy.ts`.

#### Testes removidos / reescritos

S01 (autorizado — linhagem só de campo):

- `canvas-create.cy.ts` rows 67–68 (gesto L1 porta-a-porta) **removidos**.
- `canvas-delete-chrome` / `canvas-edges` / fixture smoke: `Lineage {}` → `LineageFields`; aresta `lin:` → `fl:` / `fla:`.
- Paridade 44, 67, 116, 118 dropped — superseded by field-only lineage.

S02 (autorizado — chrome no frame):

- Seletores de overlay → `left-panel-layers`, `edge-visibility`, `status-log`, `inspector`.
- Share/avatar: `queryByRole` nulo.
- TableInfoPopover desmontado do canvas (row 42 / 159).
- MiniMap/Controls saíram do Canvas (paridade 76, 77).

Integração (orquestrador, não produto):

- Cypress S01 passou a abrir aba Camadas + `setEdgeVisibility("Linhagem")`.
- row 63: `"Sources (linhagem)"` → `"Origens (mapeamentos)"` (i18n S01 + inspector S02).
- Stress MiniMap: asserções passam a **não** esperar `rf__minimap` até S12.

#### Merge

`git merge --no-ff ux/s01` depois `ux/s02`. Auto-merge: `Canvas.tsx` (deleções S01 + `toolbar` S02), `Workspace.tsx` (chrome S02 sem props L1), i18n.

Conflitos resolvidos (não-donos / overlap conhecido):

- `LayersPanel`: estrutura S02; sem checkbox `fieldLineageVisible`; toggles de aresta na pill.
- `canvas-create.cy.ts`: ficou a deleção S01 (sem rows 67–68).
- `canvas-delete-chrome` / `canvas-edges`: EdgeVisibility S02 + arestas de campo S01.
- `parity-inventory.md` 116–118: as duas notas.

#### Desvios / pendências

- **TableInfoPopover desmontado (S02) — S07 remonta** no tooltip do cabeçalho do nó. Componente permanece em `src/`.
- MiniMap ausente até **S12**. `MiniMapToggle.tsx` continua stub `null`.
- ZoomControls / DetailLevelSelect / FocusControls / ViewTabs ainda stubs da S02 (Onda 2+).
- Canvas LOD de linhagem vive em `useCanvasEdges` (`useFlowZoom`), não em `Canvas.tsx` (ciclo 2 da S01).
- Sem push.

#### Commits S01

`8cfd7e9` `08a0334` `77b9574` `22edc55` `d3e2b89`

#### Commits S02

`b54bcae` `747cb03` `639399f` `57de8e3` `405cb6b` `11ba63c` `3089ece` `3b9fdb1`

