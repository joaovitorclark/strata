# Strata — Canvas Mutation Coverage Design Spec

**Date:** 2026-09-12
**Status:** approved. Row assignment verified against the live inventory: 49 assigned, 49 unique, zero orphans.
**Depends on:** Plan 3 and Wave S complete. Baseline: **209 ☑ · 49 ☐ · 2 dropped**
**Implementers:** Cursor AI agents (Grok / Composer), orchestrated in one window

---

## 1. Purpose

Plan 3 gave the canvas a browser and verified that it **renders**. This plan verifies that it
**mutates**.

Of the 49 rows still unchecked, 48 are `Canvas` and one is `Editor`. They are not a random
remainder — they are a coherent surface: **every gesture and every callback through which the canvas
changes the model.** That is the entire `CanvasActions` contract, its 18 members, plus the gestures
that invoke them.

What Plan 3 already verified: selection, node drag, LOD transitions and their heights, FK versus
lineage edge rendering, edge peek, the layer edge, the minimap threshold, the virtualised column
window, scroll-aware anchoring.

What nothing has ever exercised: creating a `Ref` by dragging between column handles, creating
table-level and field-level lineage, renaming a table or a column, deleting a table or an edge,
adding a column, assigning colour or layer, collapsing or dragging a TableGroup, resizing,
multi-select, and the editor↔canvas cursor sync in both directions.

### In scope

Exactly the 49 rows, assigned one to one (§3). Nothing else.

### Out of scope

`IStoragePort` · dbt as primary format · indexes · TableGroups as a new feature (the existing
TableGroup *behaviour* is in scope; new design is not) · the git diff drawer tab · code splitting ·
Windows build verification. The last two remain the maintainer's pending decisions.

---

## 2. The method defect this plan corrects

Plan 3's Task 37 read:

> *"Cover, each with an assertion on observable result: Selection, Drag, LOD transitions, Edges, Edge
> peek, Layer edge."*

Six themes, for an inventory area of 54 rows. And its gate read *"every covered row ticked"* — which
is **self-fulfilling**: a task that covers six themes and is gated on what it covered always passes,
while 48 rows sit untouched and the plan reports success.

The fix is mechanical and this plan applies it throughout:

- **Every task names its exact inventory row numbers.** Not an area, not a theme — the numbers.
- **The gate is the count.** "All 16 of rows 47–63 are ☑ with a spec name, or carry a stated reason."
- **The row numbers are assigned in this document**, so the sum is checkable before a single agent
  runs: 16 + 5 + 8 + 7 + 12 + 1 = **49**.

A task may still fail to cover a row. It may not fail to *notice*.

---

## 3. Row assignment

| Task | Rows | Count |
| --- | --- | --- |
| 49 — `CanvasActions` contract | 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 63 | 16 |
| 50 — creation gestures | 40, 66, 67, 68, 69 | 5 |
| 51 — deletion and node chrome | 70, 71, 78, 79, 85, 86, 87, 88 | 8 |
| 52 — colour and layer palette | 80, 81, 82, 83, 84, 90, 91 | 7 |
| 53 — selection, hover, groups, controls, editor sync | 39, 41, 43, 46, 65, 73, 74, 75, 76, 89, 92, 247 | 12 |
| 54 — the ⓘ deviation | 42 | 1 |
| | **total** | **49** |

Row 57 (`layerOf`) is already ☑ and is not reassigned. Rows 219 and 244 stay dropped.

---

## 4. The hard part: dragging between handles

Half of what remains is gestures **between column handles**, not between nodes. `cy.dragNode`
targets `rf__node-${id}` and is useless for them.

Verified against `@xyflow/react@12.10.1`, not assumed:

- Handles render with the class `.react-flow__handle` and the attributes `data-nodeid`,
  `data-handleid`, `data-handlepos`. **They carry no `data-testid`** — unlike nodes and edges, which
  do.
- Strata's handle ids are the ones `columnHandleGeometry.ts` already parses: `s:<column>` and
  `t:<column>` for relations, `fl:s:<column>` and `fl:t:<column>` for field lineage.
- So a column handle is `[data-nodeid="vendas.pedido"][data-handleid="s:cliente_id"]`.
- A connection starts from the Handle's React `onMouseDown` prop. React Flow then registers
  `mousemove` and `mouseup` on the document (plus `touchmove`/`touchend`).
- **There is no `pointer*` listener anywhere in the connection path**, exactly as with node drag.

### 4.1 The guard, and why it is stronger than Plan 3's

Task 36 guarded `cy.dragNode` by asserting on the node's rendered `transform` — good, but still an
assertion about the DOM.

A connection helper admits a much better guard: **assert that the DBML gained exactly one `Ref:`.**

That is unfakeable. A helper that fires the wrong event type leaves the document untouched, and no
amount of DOM coincidence produces a new `Ref:` line in the source. The model is the ground truth,
and for every mutation spec in this plan the model is what should be asserted on — not a class name,
not an internal store value, not a rendered edge.

**This is the rule for the whole plan: a mutation is verified by the change it makes to the DBML.**
The canvas is an editor for a text document; if the text did not change, nothing happened.

---

## 5. The one known deviation

Row 42 — *"Hover ⓘ on a table opens table metadata"* — is not missing coverage. It is a behaviour
change.

Plan 2's autonomous decision 13 changed `TableInfoPopover`'s trigger to `hoveredTableId` because
Task 15's `TableNode` has no ⓘ affordance, which LocalDrawDB does have. That makes it the third
instance of the build-it-in-one-task, mount-it-in-another seam — after `LineagePorts` and
`removeSelectedRef`.

A repo-wide sweep for components never referenced outside tests found only three, all unused shadcn
primitives (`tabs`, `sheet`, `sonner`). **So this is the last one**, and Task 54 closes it with a
decision rather than a spec: restore the ⓘ for parity, or keep hover and drop the row with a
recorded reason. Either is defensible; leaving it ambiguous is not.

---

## 6. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **A connection helper that connects nothing** — the Structura scar, one level deeper. | Task 48 guards it on the DBML gaining a `Ref:`, and performs the deliberate-break check before anything depends on it. |
| 2 | **Specs asserting on the DOM instead of the model.** An edge can render from stale state; the DBML cannot. | §4.1 is a Global Constraint: mutation is verified against the document. |
| 3 | **Prompt-driven gestures** (rows 78, 79 use `prompt()`/`confirm()`). Cypress cannot drive native dialogs without stubbing. | Task 51 stubs `cy.window().then(w => cy.stub(w, 'prompt'))`; if a row genuinely cannot be driven, it is dropped with a reason, never silently ticked. |
| 4 | **Fixture drift.** These specs mutate the model, so a spec that does not reset leaks into the next. | `testIsolation: true` is already set; each mutation spec restores the fixture project in `beforeEach`. |
| 5 | **The count goes up while quality goes down** — agents ticking rows to clear the board. | Every tick names its spec file; Task 55 samples five ticked rows and re-runs their named spec in isolation. |

---

## 7. What "done" means

All 49 rows resolved: `☑` with a spec name, or `dropped` with a reason. No row left `☐`.

If that lands, the inventory reads **258 ☑ · 0 ☐ · 2+ dropped** against 260 — and, unlike Plan 2's
claimed 258, every tick will have a browser run behind it.
