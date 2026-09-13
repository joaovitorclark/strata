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

Not started. Waiting on a lint decision.
