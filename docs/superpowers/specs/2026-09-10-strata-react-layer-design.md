# Strata Migration — React Layer (Stages 4–6) Design Spec

**Date:** 2026-09-10
**Status:** draft — staged outside the repo while Cursor executes Plan 1
**Depends on:** [`2026-09-10-strata-migration-design.md`](2026-09-10-strata-migration-design.md)
(Stages 0–3) being complete
**Implementers:** Cursor AI agents (Grok / Composer), orchestrated in one window

---

## 1. Purpose

Rebuild LocalDrawDB's React layer inside Strata on `@xyflow/react` v12 and the Catppuccin token
system, reaching feature parity. This is Stages 4, 5 and 6 of the migration spec.

**In scope:** the canvas and its nodes and edges, the application shell, every panel, the command
palette, the DBML drawer, and the parity revalidation.

**Out of scope, unchanged from the foundation spec:** dbt as primary format, `IStoragePort`, indexes
as a column marker, TableGroups on canvas, the git diff drawer tab, Cypress.

---

## 2. Correction to the foundation spec

The foundation spec claimed *"reactflow v11 → v12 breaks all 47 canvas files."* **That is wrong.**
It was written before the canvas source was read.

The truth, verified by reading every file: the reactflow API surface in use is **13 symbols**, and
the semantic breakage is **about 10 lines across 4 files** (§4). Every import statement changes
package name, but that is a rename, not a migration.

**The conclusion still holds — Stage 4 is a rebuild — but for a different reason.** It is a rebuild
because the *presentation* changes completely: 3,199 lines of hand-written CSS become Tailwind
tokens, the node gains the Level-of-Detail system, and the layout stops being a split pane. The
*geometry and logic* are portable and tested, and must be ported, not rewritten.

This correction lowers Stage 4's risk and changes its shape: it splits into a low-risk port with a
small patch, and a presentation rebuild.

---

## 3. What already exists — do not rebuild it

Reading the canvas source turned up substantial machinery that already solves problems this
migration was going to solve again. **Rebuilding any of it is a defect.**

### 3.1 Column virtualisation already exists

`src/canvas/hooks/useVirtualWindow.ts` exports `computeVirtualWindow` — a pure, tested function
returning `{ startIndex, endIndex, totalHeight, offsetY }`. Its own docstring states the case it was
built for:

> *"Para tabelas com 200 colunas num canvas de 100 tabelas, isso reduz o trabalho de render de 20.000
> ColumnRowContent para ~20 por tabela."*

The thresholds live in `src/canvas/scaleLimits.ts`:

| Constant | Value | Meaning |
| --- | --- | --- |
| `COLUMN_VIRTUALIZE_THRESHOLD` | 48 | above this many columns, the list virtualises and scrolls |
| `COLUMN_VIRTUAL_ROW_H` | 25 | column row height in px |
| `COLUMN_VIRTUAL_VIEW_ROWS` | 14 | rows visible in the scroll viewport |
| `COLUMN_VIRTUAL_OVERSCAN` | 3 | rows rendered beyond the viewport |
| `MINIMAP_MAX_TABLES` | 200 | above this, the minimap is hidden (paint cost) |
| `SKIP_INITIAL_FIT_TABLES` | 200 | above this, skip the first-frame `fitView` |
| `PAGE_WIZARD_THRESHOLD` | 500 | above this, offer the page-splitting wizard |
| `LARGE_DIAGRAM_HINT` | 200 | above this, show the large-diagram status hint |

The application already has a coherent scale strategy. Adopt it; do not invent a second one.

### 3.2 Scroll-aware edge anchoring already exists

The hardest part of a scrolling column list is that edges must follow columns as they scroll, and
must park at the viewport edge when their column scrolls out of view. This is solved in
`src/canvas/columnHandleGeometry.ts` (123 lines) plus `useColumnEdgeCoords.ts` and
`tableScrollStore.ts`. `columnAnchorY` returns `{ y, kind }` where `kind` is `'row' | 'above' |
'below'` — a column above the viewport anchors to the top edge, below anchors to the bottom.

This behaviour is subtle, correct, and tested. Port it.

### 3.3 A compact node mode already exists

`src/canvas/nodeMetrics.ts` takes `opts.compact` and produces a header-only card (used today for
lineage view). **This is the Sigil state.** It is not new work — it is an existing mode being
generalised and given a zoom trigger.

### 3.4 Consequence for the Level-of-Detail design

`docs/identity.md` §7 presents three states as though all three are new. Reframed against reality:

| State | Status | Work |
| --- | --- | --- |
| **Sigil** | `nodeMetrics({ compact: true })` exists | Generalise beyond lineage view; add zoom trigger |
| **Keys** | **genuinely new** | PK + FKs + pinned + counted overflow control |
| **Full** | virtualised scroll list exists | Restyle to tokens; add in-node filter and sections |

Genuinely new across the whole system: **the Keys state, zoom-driven state selection, column
pinning, the in-node filter, and edge peek.** Everything else is port-and-restyle.

---

## 4. The `@xyflow/react` v12 migration — exact breaking points

The complete v11 API surface in use, from `grep`:

```
BaseEdge  EdgeLabelRenderer  getSmoothStepPath  Handle  NodeResizeControl  Position
type EdgeProps  type Node  type Position
useNodeId  useReactFlow  useStore  useUpdateNodeInternals
```

Of those, `BaseEdge`, `EdgeLabelRenderer`, `getSmoothStepPath`, `Handle`, `NodeResizeControl`,
`Position`, `useNodeId`, `useReactFlow` and `useUpdateNodeInternals` are unchanged in v12.

**Everything that actually breaks:**

| # | File | Line(s) | v11 | v12 |
| --- | --- | --- | --- | --- |
| 1 | `Canvas.tsx` | 6 | `import 'reactflow/dist/style.css'` | `import '@xyflow/react/dist/style.css'` |
| 2 | `useColumnEdgeCoords.ts` | 48–49 | `useStore((s) => s.nodeInternals.get(id))` | `useInternalNode(id)` |
| 3 | `columnHandleGeometry.ts` | `sidePortFlowPoint`, `columnHandleFlowPoint` | `node.positionAbsolute ?? node.position` | `node.internals.positionAbsolute` |
| 4 | `columnHandleGeometry.ts` | same two functions | `node.width` | `node.measured?.width` |
| 5 | `focusTableView.ts` | 12, 13, 67 | `node.width`, `node.height` | `node.measured?.width`, `node.measured?.height` |
| 6 | all canvas files | imports | `from 'reactflow'` | `from '@xyflow/react'` |
| 7 | node data types | — | `Node<TableNodeData>` | v12 requires `TableNodeData extends Record<string, unknown>` |

`node.parentNode` → `node.parentId` is **not** an issue: `grep` confirms no usage.

### 4.1 The one design decision inside the migration

Items 3–5 change what a "node" means to the geometry helpers. v12 splits the concept: `Node` is the
user's node, `InternalNode` is the measured one, and only `InternalNode` carries `measured` and
`internals.positionAbsolute`.

**Decision: change the geometry helpers' parameter type to `InternalNode<TableNode>`, not to accept
both.** A helper that accepts either has to guess which it got, and that guess is where a
mispositioned edge comes from. `useColumnEdgeCoords` already obtains internal nodes; passing them
down keeps the type honest.

This is a **signature change to ported code**, which the foundation spec's verbatim rule forbids. It
is permitted here, explicitly and only for items 3–5, because v12 makes the old signature
unrepresentable. The 12 canvas tests are the check that behaviour did not change with it.

---

## 5. Component inventory — port versus rebuild

`src/canvas/` is 5,190 lines across 35 non-test files. It divides cleanly.

### 5.1 Port verbatim (+ the §4 patch where noted) — 2,191 lines

| File | Lines | Note |
| --- | --- | --- |
| `autolayout.ts` | 753 | dagre layout; 414-line test |
| `pageFilter.ts` | 309 | page/group filtering |
| `columnHandleGeometry.ts` | 123 | **§4 patch items 3–4** |
| `focusTableView.ts` | 109 | **§4 patch item 5** |
| `useColumnEdgeCoords.ts` | 88 | **§4 patch item 2** |
| `nodeMetrics.ts` | 69 | feeds autolayout — see §5.3 |
| `lineageHandles.ts` | 59 | |
| `edgeFocus.ts` | 51 | |
| `hooks/useVirtualWindow.ts` | 44 | |
| `scaleLimits.ts` | 29 | |
| `tableScrollStore.ts` | 22 | |
| `defaultTablePosition.ts` | 7 | |
| `actions.ts` | 81 | the `CanvasActions` contract — see §7 |
| `hooks/useCanvasNodes.ts` | 197 | builds the React Flow node array from the parsed model |
| `hooks/useCanvasEdges.ts` | 381 | **see below** — carries a perf optimisation with no test |

> **`useCanvasEdges` is the most dangerous file in this migration to rewrite.** Its header reads
> *"rebuild estrutural separado do highlight (Fase 3 perf)"*, and `mergeEdgeState` preserves edge
> object identity across rebuilds so that hovering does not re-render every edge on the canvas.
> There is no test for that property. A hand-written replacement will look correct, pass every gate,
> and make a 200-table diagram crawl — and the cause will be months behind by the time anyone
> notices. Port it.
>
> One coupling to carry forward: it calls `edgeClassForTier` from `edgeFocus.ts`, which returns CSS
> class names from the old stylesheet. Port unchanged; §5.2's edge rebuild must provide token-based
> rules under those exact class names.

### 5.2 Rebuild against the token system — 2,020 lines

| File | Lines | Becomes |
| --- | --- | --- |
| `Canvas.tsx` | 621 | the `<ReactFlow>` shell, v12, token-styled |
| `TableColumnList.tsx` | 316 | the LOD body — Sigil / Keys / Full |
| `TableNode.tsx` | 227 | the node card: layer edge, header, LOD body |
| `GroupNode.tsx` | 115 | layer/table group container |
| `RelationEdge.tsx` | 110 | FK: solid, crow's foot, `--rel-fk` |
| `FieldLineageEdge.tsx` | 87 | field-level lineage |
| `LineageEdge.tsx` | 53 | table-level lineage: dashed, animated, `--rel-lineage` |
| `EdgeMarkers.tsx` | 44 | SVG markers, token-coloured |
| `ExternalGroupNode.tsx` | 39 | aggregated cross-page stub |
| `LineagePorts.tsx` | 30 | lineage handles |
| `CanvasLeftDock.tsx` | 6 | absorbed into the shell |

Panels move to `features/` rather than living under `canvas/`: `ColumnPanel` (272),
`LayersPanel` (262), `ColumnMappings` (177), `ProblemsPanel` (115), `StatusLog` (105),
`PageImportWizard` (87), `SelectionBar` (69), `TableInfoPopover` (66), `useDraggablePanel` (67).

### 5.4 `src/editor/` — 519 lines, omitted from an earlier draft of this spec

The editor directory was referred to only as "port the CodeMirror wiring" and none of its files were
named. It divides the same way:

| File | Lines | Fate |
| --- | --- | --- |
| `Outline.tsx` | 208 | **rebuild** — the DBML structure tree, virtualised. Larger than `Editor.tsx`; a feature, not wiring. Reuse `computeVirtualWindow`. |
| `Editor.tsx` | 106 | rebuild — becomes the drawer body |
| `dbmlFold.ts` | 52 | **port** — CodeMirror folding ranges for DBML blocks |
| `RenameConfirmModal.tsx` | 34 | rebuild — the rename-impact confirmation, driven by `model/reconcile.ts` |
| `syncEditorCanvas.ts` | 23 | **port** — cursor↔canvas sync predicates, has a test |
| `cursorLineExtension.ts` | 10 | **port** |
| `__tests__/Outline.virtualize.test.tsx` | 44 | port, must stay green |
| `__tests__/syncEditorCanvas.test.ts` | 42 | port, must stay green |

`RenameConfirmModal` is 34 lines and is the easiest thing in this plan to lose silently. It is the
flow that asks whether renaming a key column should propagate to its child foreign keys. Without it,
renames change models without asking — and `propagateKeyRename.test.ts` (ported in Plan 1) covers
the *mechanism* but not the *prompt*.

### 5.3 A metrics decision that must be made before Stage 4 starts

`nodeMetrics.nodeHeight()` is a **pure function of the table data** and `autolayout` depends on it —
if the node's rendered height stops matching what `nodeHeight` predicts, layout collides.

The LOD system changes rendered height by state. Therefore `nodeHeight` must take the LOD state as
an argument, and `autolayout` must pass the state each node will actually be in.

**A conflict to resolve first.** `identity.md` §5 declares density tokens `--row-compact: 22px` and
`--row-cozy: 28px`. The existing code uses `COLUMN_VIRTUAL_ROW_H = 25`, and `nodeMetrics`,
`columnHandleGeometry`, `autolayout` and 12 canvas tests all derive from that constant.

**Decision: change the tokens to match the code — cozy 25px, compact 21px.** Changing the constant
instead would shift every layout expectation in the test suite for a purely cosmetic 3px. Update
`identity.md` §5 and `design-system/globals.css` accordingly. This is the one place where the design
system yields to the code, and it yields because the code has tests and the token does not.

---

## 6. Layout composition

Per `identity.md` §6. `App.tsx` composes and does not orchestrate — **target under 150 lines**,
against the current 1,905.

```
features/shell/
├─ AppShell.tsx        grid: navbar / (rail · tree · canvas · inspector) / statusbar
├─ Navbar.tsx          mark, breadcrumb, ⌘K chip, theme toggle, Export dbt, Share, avatar
├─ IconRail.tsx        tables · layers · lineage · code · search · settings
├─ SchemaTree.tsx      monospace table list, layer edge per row, column count
├─ Inspector.tsx       selected table/column properties
├─ StatusBar.tsx       Problems · DBML handle · zoom · density
└─ SourceDrawer.tsx    bottom drawer, CodeMirror DBML, Format/Copy
```

State that lived in `App.tsx` moves to Zustand slices beside the interaction slice Plan 1's Task 10
created — never back into a component.

---

## 7. The parity gate

Stage 5 is complete when every row of `docs/parity-inventory.md` is verified. That file is produced
by Plan 1's Task 3 and **does not exist yet**; it is the reason this spec's plan cannot be finished
today (§10).

Two contracts inside it are already known and can be designed against now:

**`CanvasActions`** (`src/canvas/actions.ts`, 81 lines) is the canvas's entire public behaviour
surface. The rebuilt canvas must implement it method-for-method. Its shape is stable and readable
today, so Stage 4 does not wait on the inventory.

**The 9 export formats** are fixed: `dbt`, `erwin`, `llm-context`, `localdrawdb`, `mermaid`,
`oracle-ddl`, `postgres-ddl`, `spark-ddl`, `xlsx`. Stage 6 diffs each against the golden fixtures
Plan 1's Task 2 captured. `localdrawdb` additionally takes a `dialect` of `spark | oracle`.

---

## 8. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **Rebuilding machinery that already exists** (§3) — virtualisation, scroll-aware anchoring, compact mode. | §3 is required reading in the plan's Global Constraints, and §5.1 names every file that must be ported rather than written. |
| 2 | **LOD height diverging from `nodeMetrics`**, silently breaking autolayout. | `nodeHeight` takes the LOD state; the 414-line autolayout test is the gate. |
| 3 | **Edge anchoring regressions** are visual and easy to miss — a wrong `positionAbsolute` misplaces edges only on scrolled tables. | The §4 patch is a single task with the `columnHandleGeometry` and `useColumnEdgeCoords` tests as its gate, done before any node is restyled. |
| 4 | **`App.tsx` is deleted before the inventory is checked.** | The inventory is committed in Plan 1. Stage 5 tasks reference row numbers; deletion is the last step, not the first. |
| 5 | **Density token conflict** (§5.3) shipping unresolved and shifting layout. | Resolved in this spec: tokens change, constant does not. It is a Stage 4 prerequisite task. |
| 6 | **A rebuilt panel quietly losing a control.** | Every panel task lists its controls from the inventory and gates on them. |

---

## 9. Dependency on Plan 1

This plan cannot start until Plan 1's exit criteria are met — specifically:

- `src/features/schema/model/` exists and its 20 tests are green (the canvas imports the domain).
- `src/infrastructure/api/` exists (panels call it).
- `src/features/schema/store/` exists (canvas state extends it).
- `src/index.css` and `tailwind.config.ts` are wired (everything is styled from tokens).
- `fixtures/golden/` holds the nine exports (Stage 6's gate).
- `docs/parity-inventory.md` exists (Stage 5's gate).

---

## 10. What is still blocked

**Stage 4 can be planned in full today.** Its inputs are the canvas source, `identity.md`, and the
v12 migration table in §4 — all available.

**Stage 5 can be planned structurally but not completely.** The shell, panels and drawer are known.
The **command palette's action list is not**, because it exists only inline inside the 1,905-line
`App.tsx` and is extracted by Plan 1's Task 3. The plan document marks that task as blocked rather
than inventing its contents.

**Stage 6 can be planned in full** — the formats and the fixture comparison are both fixed.
