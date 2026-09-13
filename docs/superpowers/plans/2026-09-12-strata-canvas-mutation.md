# Strata — Canvas Mutation Coverage Implementation Plan

> **For agentic workers (Cursor / Grok / Composer):** Tasks are grouped into **waves**. Every task in
> a wave is independent of its siblings. A wave does not start until the previous one is green.
>
> **Every task names its exact inventory row numbers, and its gate is the count.** Not a theme, not
> an area. The assignment sums to 49 and is checkable before you start.

**Goal:** Verify the canvas's mutation surface — the whole `CanvasActions` contract and the gestures
that invoke it — closing all 49 remaining inventory rows.

**Architecture:** Cypress specs that drive real gestures and **assert on the DBML**, not on the DOM.
The canvas is an editor for a text document; if the text did not change, nothing happened.

**Tech Stack:** Cypress 15, the existing fixture data directory and Fastify-served build.

**Spec:** [`../specs/2026-09-12-strata-canvas-mutation-design.md`](../specs/2026-09-12-strata-canvas-mutation-design.md)

**Prerequisite:** Plan 3 and Wave S complete. Baseline **209 ☑ · 49 ☐ · 2 dropped**.

---

## Global Constraints

Everything from Plans 1–3 still applies. These are additional.

**A mutation is verified by the change it makes to the DBML.** Not by a class name, not by a store
value, not by a rendered edge. Read the document back (through the source drawer or the API) and
assert on its text. An edge can render from stale state; the DBML cannot lie about whether the model
changed.

**A row is ticked only when a spec ran,** and the row records the spec file name. Unchanged from
Plan 3, and it is the rule this project exists to enforce.

**A row that cannot be driven is dropped with a reason.** Native `prompt()` and `confirm()` are
stubbable; a row is only undriveable after you have tried stubbing. Never tick to clear the board.

**Restore the fixture before each mutation spec.** These specs change the model. `testIsolation` is
already `true`; add a `beforeEach` that resets the project so a spec never inherits another's edits.

**No interaction helper may be used before Task 48 is green.** Same rule as Plan 3's Task 36, one
level deeper: this plan's helper connects handles, and a helper that connects nothing would pass
every spec in Wave U.

**When the harness cannot drive a component, the test shrinks — the component does not.**

**The seam rule, from Wave S:** three of that wave's four bugs were components built by one task and
mounted by none. If a task here finds something unmounted, that is a bug, not missing coverage —
report it as such and do not paper over it with a spec that avoids the gesture.

---

## Wave T — the helper and its guard, 1 agent

### Task 48: A connection helper that provably connects

**Files:**
- Create: `cypress/e2e/handle-connect-smoke.cy.ts`
- Modify: `cypress/support/commands.ts`

**Rows:** none. This task exists so Wave U's rows mean something.

**Interfaces:**
- Produces: `cy.connectHandles(fromNode, fromHandle, toNode, toHandle)` and
  `cy.dbmlText()`. Consumed by Tasks 50, 51, 53.

- [ ] **Step 1: Read the verified API before writing anything**

Confirmed against `@xyflow/react@12.10.1` — do not re-derive, and do not substitute guesses:

- Handles render as `.react-flow__handle` with `data-nodeid`, `data-handleid`, `data-handlepos`.
  **They carry no `data-testid`**, unlike nodes (`rf__node-${id}`) and edges (`rf__edge-${id}`).
- Strata's handle ids are what `columnHandleGeometry.ts` parses: `s:<column>` / `t:<column>` for
  relations, `fl:s:<column>` / `fl:t:<column>` for field lineage.
- A connection starts from the Handle's React `onMouseDown` prop; React Flow then registers
  `mousemove` and `mouseup` **on the document**.
- There is **no `pointer*` listener** anywhere in the connection path.

So a column handle is:

```
[data-nodeid="vendas.pedido"][data-handleid="s:cliente_id"]
```

- [ ] **Step 2: Write `cy.dbmlText()`**

Every spec in this plan asserts on the document, so reading it must be trivial and must not depend
on the source drawer being open:

```ts
Cypress.Commands.add("dbmlText", () => {
  return cy
    .request("GET", "/api/project")
    .then((res) => res.body?.dbml ?? "")
    .then((t: string) => t as unknown as Cypress.Chainable<string>);
});
```

Verified: `server/routes.ts:352` — `GET /api/project` returns `loadProject()`, and its sibling
`PUT /api/project` takes `{ dbml, canvas }`. So `res.body.dbml` is the document, and that same PUT
is the reset mechanism in Step 6.

- [ ] **Step 3: Write the failing guard**

The assertion is on the model, not the DOM. This is what makes the guard unfakeable:

The `smoke` fixture holds four tables — `vendas.cliente`, `vendas.pedido`, `vendas.item`,
`vendas.resumo` — and **exactly one** relation, `Ref: vendas.pedido.cliente_id > vendas.cliente.id`.
One pre-existing Ref makes the count assertion unambiguous: 1 becomes 2, or the helper did nothing.

`vendas.item` (`id` pk, `sku`) and `vendas.pedido` (`id` pk, …) are unrelated, so they are the pair
to connect. Drag from the non-key side to the key side, which is also what row 66 will assert.

```ts
describe("connectHandles helper", () => {
  beforeEach(() => cy.resetFixture("smoke"));

  it("actually creates a Ref in the DBML", () => {
    cy.dbmlText().then((before) => {
      expect((before.match(/^\s*Ref:/gm) ?? []).length, "fixture baseline").to.equal(1);

      cy.connectHandles("vendas.item", "s:sku", "vendas.pedido", "t:id");

      cy.dbmlText().should((after) => {
        const refs = after.match(/^\s*Ref:/gm) ?? [];
        expect(refs.length, "exactly one new Ref").to.equal(2);
        expect(after).to.contain("vendas.item.sku");
      });
    });
  });
});
```

- [ ] **Step 4: Write the helper with mouse events on the document**

```ts
Cypress.Commands.add(
  "connectHandles",
  (fromNode: string, fromHandle: string, toNode: string, toHandle: string) => {
    const sel = (n: string, h: string) => `[data-nodeid="${n}"][data-handleid="${h}"]`;

    cy.get(sel(fromNode, fromHandle)).then(($src) => {
      const s = $src[0].getBoundingClientRect();
      const sx = s.left + s.width / 2;
      const sy = s.top + s.height / 2;

      cy.get(sel(toNode, toHandle)).then(($dst) => {
        const d = $dst[0].getBoundingClientRect();
        const dx = d.left + d.width / 2;
        const dy = d.top + d.height / 2;

        // Start on the handle: React Flow binds this through the Handle's
        // onMouseDown prop.
        cy.wrap($src).trigger("mousedown", { button: 0, clientX: sx, clientY: sy, force: true });

        // Move on the document: React Flow registers mousemove/mouseup there,
        // not on the handle. Two moves — the first opens the connection, the
        // second positions it over the target.
        cy.document()
          .trigger("mousemove", { clientX: (sx + dx) / 2, clientY: (sy + dy) / 2, force: true })
          .trigger("mousemove", { clientX: dx, clientY: dy, force: true });

        // Release over the target handle. The drop target is resolved from the
        // element under these coordinates, so they must be the target's centre.
        cy.wrap($dst).trigger("mouseup", { clientX: dx, clientY: dy, force: true });
      });
    });
  },
);
```

- [ ] **Step 5: Perform the deliberate-break check**

Change `mousedown` to `pointerdown` and re-run. **The spec must fail, and it must fail because the
`Ref:` count did not change** — not because a selector missed.

If it still passes, the helper is not doing the work and every row Wave U ticks would be fiction.
Restore the mouse events and **report that you performed this check and what the failure looked
like.**

This step is the task. Plan 3's Task 36 proved the value of it once already.

- [ ] **Step 6: Write `cy.resetFixture(name)` on top of what already exists**

**`cy.seedProject(name)` already exists** (`cypress/support/commands.ts:73`, from Plan 3's Task 35).
It finds the fixture project by slug, activates it, and visits — but it does **not** restore the
model, so a mutation spec would inherit the previous spec's edits.

Build on it; do not write a second seeding path:

```ts
Cypress.Commands.add("resetFixture", (name: FixtureProject) => {
  cy.seedProject(name);
  cy.readFile(`cypress/fixtures/data/domains/local/projects/${name}/project.dbml`).then((dbml) => {
    cy.request("PUT", "/api/project", { dbml, canvas: {} });
  });
  cy.reload();
});
```

`PUT /api/project` is the endpoint verified in Step 2. Passing `canvas: {}` resets node positions
too — without that, a spec that dragged a node leaves it moved for the next one.

Prove the reset works: mutate the model, call `resetFixture`, and assert `cy.dbmlText()` matches the
committed fixture file exactly. A reset that does not reset is the same class of defect as a helper
that does not drag.

- [ ] **Step 7: Run and commit**

Run: `npm run build && npm run e2e:serve`, then `npm run cy:run`
Expected: `handle-connect-smoke` passes, the break check reported, existing 24 specs still green.

```bash
git add -A && git commit -m "test(e2e): guard that cy.connectHandles actually creates a Ref"
```

---

## Wave U — coverage, 5 agents in parallel

Each task owns exact rows. **Its gate is that every one of them is `☑` with a spec file name, or
`dropped` with a reason. None may be left `☐`.**

Drive real gestures. Assert on the DBML wherever the row describes a mutation.

### Task 49: The `CanvasActions` contract — 16 rows

**Rows: 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 63.**

The contract is reproduced in Plan 2's Global Constraints. Each row is one member. Assert the
observable effect, not that the callback fired.

| Row | Member | Drive | Assert |
| --- | --- | --- | --- |
| 47 | `onSelectColumn` | click a column row | ColumnPanel opens for that table+column |
| 48 | `onRenameColumn` | rename via the column panel | DBML renames it **in every `Ref:`**; a duplicate name is rejected with a status message |
| 49 | `onGoToColumn` | the "go to" affordance | source drawer opens and the editor line is that column's |
| 50 | `onRenameTable` | rename a table | DBML renames it, canvas ids migrate, duplicate id rejected |
| 51 | `onRemoveTable` | remove a table | DBML loses the table **and its related `Ref:` lines** |
| 52 | `onAddColumn` | add a column | DBML gains `nova_coluna string` in that table |
| 53 | `colorOf` | — | header colour of a coloured table matches the `Colors {}` entry |
| 54 | `onSetColor` | pick and clear a colour | `Colors {}` gains then loses the entry |
| 55 | `onSetGroupColor` | group colour | `Colors {}` gains then loses the `@group` entry |
| 56 | `onResizeTable` | resize | stored width/height are rounded |
| 58 | `layerColorOf` | — | a layer chip's colour matches its `LayerGroup` colour |
| 59 | `onSetLayer` | assign and clear | DBML `LayerGroup` membership changes both ways |
| 60 | `layers` | — | the layer list the node sees matches the `LayerGroup` blocks |
| 61 | `onAddLayer` | add a layer | DBML gains a `LayerGroup` with that name and colour |
| 62 | `onToggleGroup` | collapse/expand | the group's member tables hide and reappear |
| 63 | `tableMeta` | — | resolved sources, sample rows, PK/FK, dbt badges and notes match the model |

Rows 53, 58, 60 and 63 are **readers**, not mutations: assert the rendered value against the model,
since there is no document change to observe.

### Task 50: Creation gestures — 5 rows

**Rows: 40, 66, 67, 68, 69.** All use `cy.connectHandles`.

| Row | Drive | Assert |
| --- | --- | --- |
| 40 | drag a column handle onto another column | DBML gains exactly one `Ref:` |
| 66 | drop a source handle on a target handle | the `Ref:` is oriented with the **PK side as target** |
| 67 | lineage mode on, drag between edge ports | DBML `Lineage {}` gains a table-level entry |
| 68 | lineage mode on, drag between `fl:` field handles | DBML gains a field-level (L2) mapping |
| 69 | drag an existing relation edge endpoint onto another column | the existing `Ref:` retargets — count unchanged, target changed |

Row 69 uses React Flow's reconnect path, which binds through `onReconnectSourceMouseDown` /
`onReconnectTargetMouseDown` — also mouse events. If `cy.connectHandles` does not reach it, write a
sibling helper and **guard it the same way Task 48 guarded the first one** before using it.

### Task 51: Deletion and node chrome — 8 rows

**Rows: 70, 71, 78, 79, 85, 86, 87, 88.**

| Row | Drive | Assert |
| --- | --- | --- |
| 70 | select table node(s), Delete **and** Backspace | DBML loses those tables and their refs |
| 71 | select a relation / lineage / field-lineage edge, Delete | DBML loses exactly that edge |
| 78 | double-click the table title | `prompt` stub returns a new `schema.tabela`; DBML renames |
| 79 | click × on a table | `confirm` stub returns true; DBML loses the table and its refs |
| 85 | drag the bottom-right corner | stored size changes |
| 86 | "+ coluna" | DBML gains a column |
| 87 | double-click a column name, type, Enter | DBML renames; **Escape cancels and leaves it unchanged** |
| 88 | Alt+click a column | source drawer opens at that column's line |

Rows 78 and 79 use native dialogs. Stub them:

```ts
cy.window().then((w) => {
  cy.stub(w, "prompt").returns("vendas.pedido_novo");
  cy.stub(w, "confirm").returns(true);
});
```

Row 87 has two assertions in one row — Enter commits **and** Escape cancels. Cover both; a row is
not satisfied by half of it.

### Task 52: Colour and layer palette — 7 rows

**Rows: 80, 81, 82, 83, 84, 90, 91.**

| Row | Drive | Assert |
| --- | --- | --- |
| 80 | click the colour/layer control | the palette opens |
| 81 | pick a swatch | `Colors {}` gains the table entry with that hex |
| 82 | "Sem cor (usar camada)" | `Colors {}` loses the entry; the node falls back to its layer colour |
| 83 | pick a layer | `LayerGroup` membership changes |
| 84 | "sem camada" | membership is cleared |
| 90 | open the group palette, pick a colour | `Colors {}` gains the `@group` entry |
| 91 | "Sem cor" for the group | the `@group` entry is removed |

The swatches come from `TABLE_COLORS` in `@/features/canvas/tableColors` (Catppuccin, set in Wave E
Task 11). Assert the written hex is one of those — a hex from anywhere else means something
bypassed the palette.

### Task 53: Selection, hover, groups, controls, editor sync — 12 rows

**Rows: 39, 41, 43, 46, 65, 73, 74, 75, 76, 89, 92, 247.**

| Row | Drive | Assert |
| --- | --- | --- |
| 39 | hover a column or a ref | connected FK relations highlight |
| 41 | click a column | the column panel opens |
| 43 | ⌘/Ctrl+click, and rubber-band drag | multiple tables selected |
| 46 | Escape twice with a column selected | **first press drops the column, second clears the table** |
| 65 | drag a TableGroup by its handle | every member table moves with it |
| 73 | click a table body | it focuses **and** the editor scrolls to its block |
| 74 | click a TableGroup | the group is selected and the Records panel filters to it |
| 75 | hover a table | related tables stay highlighted (hover-focus) |
| 76 | Controls: fit view, lock interactivity | viewport fits; locked canvas rejects a node drag |
| 89 | the chevron on a group label | collapses and expands |
| 92 | make the DBML invalid | the stale-model banner appears and says the canvas shows the last valid model |
| 247 | move the editor cursor into a table block | the canvas pans to and selects that table |

Rows 73 and 247 are the editor↔canvas sync **in both directions** — canvas-to-editor and
editor-to-canvas. They are separate rows because they are separate code paths.

Row 76: zoom in/out is already covered by `canvas-lod.cy.ts`; this row is fit view and lock only.

---

## Wave V — the deviation and the close

### Task 54: Resolve the ⓘ deviation — 1 row

**Row: 42** — *"Hover ⓘ on a table opens table metadata."*

This is not missing coverage. Plan 2's autonomous decision 13 changed `TableInfoPopover`'s trigger
to `hoveredTableId` because Task 15's `TableNode` has no ⓘ affordance. LocalDrawDB has one.

It is the **third and last** instance of the build-in-one-task, mount-in-another seam — a repo-wide
sweep found only three never-referenced components, all unused shadcn primitives, so nothing else is
hiding.

Decide, do not defer:

- **Restore parity:** add the ⓘ affordance to `TableNode` as LocalDrawDB has it, trigger the popover
  from it, write the spec, tick row 42. Preferred if the popover carries information a hover cannot
  reasonably surface on its own.
- **Keep hover:** drop row 42 with the reason *"trigger changed to hover; ⓘ affordance deliberately
  not restored"*, and write a spec covering the hover trigger so the behaviour is still verified
  even though the row is dropped.

Either is defensible. Leaving it ambiguous is not. Report which you chose and why.

### Task 55: Final gate, sampling, and log

- [ ] **Step 1: Run everything**

`npm run test` · `npm run typecheck` · `npm run format:check` · `npm run cy:run` ·
`npm run cy:run:stress`

- [ ] **Step 2: Verify the count**

Every one of the 49 rows is `☑` with a spec file name or `dropped` with a reason. **Zero rows left
`☐`.** Report the final tally against 260.

- [ ] **Step 3: Sample five ticked rows and re-run their named specs in isolation**

Pick five at random from across the five Wave U tasks. Run each named spec file alone. If one passes
only as part of a larger run, it depends on leaked state and the row is not verified — untick it and
say so.

This step exists because the failure mode of a coverage plan is ticking to clear the board, and a
sample is the cheapest defence against it.

- [ ] **Step 4: Log**

`docs/superpowers/plan-4-run-log.md`, one entry per task, plus the sampling result and the ⓘ
decision.

---

## Plan exit criteria

- [ ] `handle-connect-smoke` green **and** its deliberate-break check performed and reported
- [ ] All five suites green
- [ ] **All 49 rows resolved — zero `☐`**
- [ ] Five sampled rows re-verified in isolation
- [ ] The ⓘ decision made and recorded

---

## Wave summary

| Wave | Tasks | Agents | Blocked by |
| --- | --- | --- | --- |
| T | 48 | 1 | Wave S complete |
| U | 49, 50, 51, 52, 53 | 5 parallel | 48 |
| V | 54, then 55 | 1 sequential | Wave U |
