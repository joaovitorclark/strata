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

---

### Onda 2 — S03 ∥ S04 ∥ S05 — 2026-09-14 — VERDE

Branch `ux/wave-2` (`dc014c8`). Base: `51f9b8d` (topo verde da onda 1).

Worktrees: `/Users/jvclark/www/strata-ux-s03` (`ux/s03`), `/Users/jvclark/www/strata-ux-s04` (`ux/s04`), `/Users/jvclark/www/strata-ux-s05` (`ux/s05`), `/Users/jvclark/www/strata-ux-wave-2`.

#### Validação independente (README §2)

| Spec | typecheck | lint | format | test | build | cy:run | stress |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S03 `62c971a` | ✓ | ✓ | ✓ | **130 / 909** | 12 175 kB | **101/101** 01:21 (porta 5179) | n/a |
| S04 `d04684e` | ✓ | ✓ | ✓ | **131 / 910** | ✓ | **99/99** (porta 5181) | n/a |
| S05 `8ce10ad` | ✓ | ✓ | ✓ | **129 / 907** | 12 180 kB | **99/99** 01:20 (porta 5182) | **9/9** 00:09 |
| `ux/wave-2` integrado | ✓ | ✓ | ✓ | **132 / 912** | 12 186 kB | **111/111** 01:30 (porta 5183) | **9/9** 00:09 |

`files.test.ts` falhou 1× no worktree fresco (`inputDir` null); rerun 912/912. Pré-existente / ordem de workers (igual onda 1).

Smoke wall-clock 90s vs onda 1 72s **com 111 testes vs 94**. Por teste: ~0,81s vs ~0,77s (+5%). Abaixo do limiar de 10% por teste.

S03 cy:run independente inicial: 100/101. `row 76` falhava de forma consistente — o teste clicava `+` duas vezes a partir de `scale(1)` (antes do `InitialFitHelper`) e o fit da pill (~1,66) **aproximava** o zoom. Fit de produto ok. Correção: `waitForInitialFit()` + menu 200% antes do fit (`62c971a`).

#### Gates

- S03 **G1–G8** (8/8). Cypress G1–G6 em `canvas-zoom.cy.ts` / `canvas-rubber-band.cy.ts`; Vitest G7–G8.
- S04 **G1–G8** (8/8). Cypress G1–G5 em `tree-navigation.cy.ts`.
- S05 **G1–G10** (10/10). Vitest G1–G4 em `lod.test.ts`; Cypress G5–G9 em `canvas-detail-level.cy.ts`; G10 em `stress-wide-table.cy.ts`.

#### Testes removidos / reescritos

S03: `CommandPalette` Esc só com palette aberta; zoom saiu da status bar; row 76 espera fit inicial + 200%.

S04: árvore deixa de ser só outline; testes de affordance morta da árvore reescritos.

S05 (autorizado — zoom ≠ conteúdo): `lod.test.ts` `resolveLod(zoom → level)`; `canvas-lod.cy.ts`; S01 G19/G20 e zoomToFull/zoomToSigil; aresta agregada no nível Nome; stress-node-height pelo seletor de detalhe.

#### Merge

`git merge --no-ff ux/s03` depois `ux/s04` depois `ux/s05`. Auto-merge: `Workspace.tsx` (S03 tira zoom da StatusBar; S04 `onFocusTable`).

Conflitos resolvidos (compartilhados):

- `gestures.ts`: atalhos de zoom S03 **e** 1–4 de detalhe S05 (`⇧1` vs `1`).
- i18n `canvas.toolbar`: chaves de zoom S03 + detalhe S05.

Integração (orquestrador, não produto das specs):

- `Canvas.tsx` consome `visibleTableIdSet` / `filterEdgesByVisibleIds` (S04) sem editar `useCanvasEdges` (S05). Ends não-tabela (stubs) permanecem no conjunto permitido.
- Prettier em `canvas-select-sync.cy.ts` pós-merge S03.

#### Desvios / pendências

- **TableInfoPopover desmontado (S02) — S07 remonta** no tooltip do cabeçalho do nó.
- MiniMap ausente até **S12**.
- FocusControls / ViewTabs ainda stubs (ondas 4–5).
- S05: `ColumnRow.tsx`, `autolayout.ts`, `useWorkspace.ts` fora dos donos (barras simplificadas, layout pelo nível, persistência). Aceite cirúrgico.
- S03: `CommandPalette.tsx` + `Workspace.tsx` fora dos donos (Esc empilhado; props de zoom).
- Sem push.

#### Commits S03

`9d8789b` `04e24e6` `62c971a`

#### Commits S04

`d04684e`

#### Commits S05

`8ce10ad`

---

### Onda 3 — S06 ∥ S07 — 2026-09-14 — VERDE

Branch `ux/wave-3`. Base: `3fd980d` (topo verde da onda 2).

Worktrees: `/Users/jvclark/www/strata-ux-s06` (`ux/s06`), `/Users/jvclark/www/strata-ux-s07` (`ux/s07`), `/Users/jvclark/www/strata-ux-wave-3`.

#### Validação independente (README §2)

| Spec | typecheck | lint | format | test | build | cy:run | stress |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S06 `8bc6dd1` | ✓ | ✓ | ✓ | **133 / 915** | 12 230 kB | **116/116** 01:45 (porta 5184) | n/a |
| S07 `74c1f61` | ✓ | ✓ | ✓ | **133 / 914** | 12 195 kB | **118/118** 01:52 (porta 5185) | **9/9** 00:09 |
| `ux/wave-3` integrado | ✓ | ✓ | ✓ | **134 / 917** | 12 240 kB | **123/123** 01:56 (porta 5186) | **9/9** 00:09 |

Smoke wall-clock 116s vs onda 2 90s **com 123 testes vs 111**. Por teste: ~0,94s vs ~0,81s. O G10 da S07 (8 screenshots, 14,6s) infla a média; sem ele ~0,83s (+2%). Stress pan 200 tabelas continua 3s. Não é regressão de FPS.

#### Gates

- S06 **G1–G8** (8/8). Vitest G1–G3 `urlState.test.ts`; Cypress G4–G8 `url-state.cy.ts`.
- S07 **G1–G10** (10/10). Vitest G1–G2 `columnGlyphs.test.tsx`; Cypress G3–G7/G10 `node-anatomy.cy.ts`; G8 edges/handle-connect/stress; G9 = S05 G8 de altura.

#### Testes removidos / reescritos

S06: nenhum.

S07: row 42 de `canvas-select-sync` (popover remonta); stress hub copy `/cols/` → `/↔/`, `/more columns/` → `/colunas/` (anatomia). `canvas-edges` e `handle-connect-smoke` sem alteração de asserção.

#### Merge

`git merge --no-ff ux/s06` depois `ux/s07`. Auto-merge i18n (copy-link S06 + node S07). Sem conflito de produto.

#### Desvios / pendências

- S06: `setViewport` via store interno do React Flow (Canvas não é dono). Toaster da Navbar só monta se `matchMedia` existe (jsdom).
- S07: protótipo Claude não carregou — spec. Docs note 2 linhas (S05), não 3. `aria-label` do ⋯ em inglês para não quebrar Cypress existente. Screenshots em `cypress/screenshots/node-anatomy.cy.ts/` (gitignore).
- MiniMap ausente até **S12**. ViewTabs stub até S11. FocusControls até S08.
- Sem push.

#### Commits S06

`8bc6dd1`

#### Commits S07

`0c6bea1` `74c1f61`

---

### Onda 4 — S08 ∥ S09 ∥ S10 — 2026-09-14 — VERDE

Branch `ux/wave-4`. Base: `933067d` (topo verde da onda 3).

Worktrees: `/Users/jvclark/www/strata-ux-s08` (`ux/s08`), `/Users/jvclark/www/strata-ux-s09` (`ux/s09`), `/Users/jvclark/www/strata-ux-s10` (`ux/s10`), `/Users/jvclark/www/strata-ux-wave-4`.

#### Validação independente (README §2)

| Spec | typecheck | lint | format | test | build | cy:run | stress |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S08 `c2ae86e` | ✓ | ✓ | ✓ | **926 / 926** | 12 253 kB | **128/128** 02:36 (porta 5187) | **10/10** 00:14 |
| S09 `0e20ad7` | ✓ | ✓ | ✓ | **924 / 924** | 12 246 kB | **132/132** 02:37 (porta 5188) | **9/9** 00:11 |
| S10 `77ad7bf` `032b94b` | ✓ | ✓ | ✓ | **924 / 924** | 12 267 kB | **130/130** 02:27 (porta 5189); inspector→node-anatomy **14/14 ×2** | n/a |
| `ux/wave-4` integrado | ✓ | ✓ | ✓ | **940 / 940** | 12 294 kB | **144/144** 02:47 (porta 5192) | **10/10** 00:15 |

Smoke 167s vs onda 3 116s **com 144 testes vs 123**. Por teste: ~1,16s vs ~0,94s. Os 21 testes novos (foco, estilo, precisão, inspector) explicam o wall-clock extra (~26s nesses specs); G10 S07 continua a inflar. Stress pan 200 tabelas 4s vs 3s. Não parar.

#### Gates

- S08 **G1–G11** (11/11). Vitest G1–G5 `focusGraph.test.ts`; Cypress G6–G10 `focus-mode.cy.ts`; G11 `stress-focus-mode.cy.ts`.
- S09 **G1–G12** (12/12). Vitest G1 `edgeMarkers.test.ts`; Cypress G2–G6 `edges-style.cy.ts`; G7 `canvas-edges` + `handle-connect-smoke`; G8 stress; G9–G12 `edges-precision.cy.ts`.
- S10 **G1–G9** (9/9). Cypress G1–G7 `inspector.cy.ts`; Vitest G8 `edit.test.ts`; G9 `s10-inspector.test.ts`.

#### Testes removidos / reescritos

S08: nenhum.

S09: `canvas-edges.cy.ts` animação da linhagem agregada `lineage-flow` → `none` em repouso (G3 / decisão mauve). Crow's foot e Delete/DBML intactos.

S10: `Inspector.test.tsx` reescrito para Accordion/resumo/lote. G6 de `node-anatomy.cy.ts` **não** enfraquecido. Integração wave-4: o unit do inspector passa a esperar **Rastrear** (S08 `enterFieldTrace`).

#### Merge

`git merge --no-ff ux/s08` depois `ux/s09` depois `ux/s10`. Auto-merge i18n e `tailwind.config.ts` (S09 `--rel-lineage` + S10 accordion). Sem conflito de produto. `useUrlSync` S06 intocado. S08 classNames (`edge--focus`, `lineage-flow`) + CSS S09 coexistiram. `useCanvasNodes` S04 intocado (opacidade de foco via CSS em `FocusControls`).

#### Desvios / pendências

- S08: opacidade do resto via stylesheet em `FocusControls` (G11 &lt; 300ms). Lista do rastreio na pill.
- S09: marcadores IE ainda alias `cf-many` / `cf-one` no DOM para G7.
- S10: "Rastrear" só com `enterFieldTrace`; sessão de rename em capture (`columnRenameSession`) para sobreviver a remount do React Flow após o inspector. `afterEach` de higiene no inspector.cy.ts.
- ViewTabs stub até **S11**. MiniMap stub até **S12**.
- Sem push.

#### Commits S08

`c2ae86e`

#### Commits S09

`0e20ad7`

#### Commits S10

`77ad7bf` `032b94b`

#### Integração orquestrador

`bc4d345` — Inspector "Rastrear" após merge S08.

