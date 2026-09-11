# Strata — Canvas Verification Implementation Plan

> **For agentic workers (Cursor / Grok / Composer):** Tasks are grouped into **waves**. Every task
> in a wave is independent of its siblings. A wave does not start until the previous one is green.
> Read `## Global Constraints` before every task.

**Goal:** Give the canvas an environment that can actually drive it, then re-verify — honestly — the
behaviours Plan 2 claimed without one.

**Architecture:** Cypress mirroring Structura's idiom, against the Fastify server serving the built
app, seeded from a committed fixture data directory. Smoke specs verify behaviour; stress specs
execute the scale premise the whole design rests on and that has never been run.

**Tech Stack:** Cypress 15, mochawesome, the existing Fastify + Vite build.

**Spec:** [`../specs/2026-09-11-strata-canvas-verification-design.md`](../specs/2026-09-11-strata-canvas-verification-design.md)

**Prerequisites:** Plan 2 complete. **Wave M complete, including Task 29's inventory recount** —
this plan's Task 40 works from that number and cannot start without it.

---

## Global Constraints

Plan 1's and Plan 2's Global Constraints still apply where they touch code. These are additional.

**A row is ticked only when a spec ran.** Never because a handler is bound, an import resolves, or
the code "looks right." Plan 2 produced 54 rows ticked by code inspection; that is the defect this
plan exists to repair, and repeating it here would be worse, because a green browser test carries
more authority than a green jsdom one.

**A row that cannot be made to pass is dropped with a reason.** Never quietly re-ticked, never left
ambiguous. A drop is a decision someone can review.

**When the harness cannot drive a component, the test shrinks — the component does not.** This is
the rule autonomous decision 11 violated. It applies to Cypress too: if a spec cannot reach
something, say so and leave the component alone.

**React Flow ignores pointer events.** It listens for `mousedown` / `mousemove` / `mouseup`. Any
helper that fires `pointer*` will pass while moving nothing. Task 36 exists to keep this honest, and
no spec may use a drag or interaction helper before Task 36 is green.

**Never write to `../localdrawdb`,** and never point a spec at a real project directory. Every spec
runs against the committed fixture data directory.

**The final count is reported honestly even if it is lower than Plan 2's 258.** A smaller true
number is more useful than a larger aspirational one.

---

## Wave N — foundation, 1 agent

### Task 35: Cypress scaffold, env var rename, fixture data

**Files:**
- Create: `cypress.config.ts`, `cypress/support/{e2e.ts,commands.ts}`,
  `cypress/fixtures/seed.mjs`, `cypress/fixtures/data/**`
- Modify: `package.json`, `.prettierignore`, `.gitignore`,
  `server/domainContext.ts`

**Interfaces:**
- Produces: `npm run cy:open`, `npm run cy:run`, `npm run cy:run:stress`, `npm run e2e:serve`;
  the custom commands `cy.dragNode`, `cy.seedProject`; `STRATA_DATA_DIR` / `STRATA_DOMAIN`.

- [ ] **Step 1: Rename the environment variables**

`server/domainContext.ts` still reads `LOCALDRAWDB_DATA_DIR` and `LOCALDRAWDB_DOMAIN`. Plan 1's
Task 7 was authorised to change only the data-directory *string*, so the variable names survived.
Baking them into Cypress scripts would carry the old product's name into Strata's permanent tooling.

```ts
export function baseDataDir(): string {
  return process.env.STRATA_DATA_DIR ?? process.env.LOCALDRAWDB_DATA_DIR ?? DATA_DIR;
}
```

Same fallback shape for `STRATA_DOMAIN` in `getActiveDomainSlug`. Keep the old names working — they
appear in Plan 1's fixture-capture procedure, which must stay reproducible.

Gate: `npm run test -- server/` still green (34 files). The domain tests cover this resolution.

- [ ] **Step 2: Install and configure Cypress**

```bash
npm i -D cypress@15.20.1 mochawesome@8.0.1 mochawesome-merge@5.1.1 mochawesome-report-generator@6.3.2
```

`cypress.config.ts` — mirrors Structura's, with the `baseUrl` difference from spec §3.1:

```ts
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // Strata is not a static SPA: Fastify serves the built app AND the API on one
    // port. `vite preview` would serve the app with no API behind it.
    baseUrl: "http://localhost:5174",
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    testIsolation: true,
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: "cypress/reports/mochawesome",
      overwrite: false,
      html: false,
      json: true,
    },
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
  },
});
```

`testIsolation` is `true` here, unlike Structura. Its stress specs deliberately share state; ours
seed per spec, and order-dependent passes are a risk this plan cannot afford (spec §7 risk 4). Task
39 may set it `false` for stress specs only, via a second config.

- [ ] **Step 3: Build the fixture data directory**

`cypress/fixtures/seed.mjs` generates three projects and writes a data directory. Run it once and
**commit the output** — specs must not regenerate state at run time.

| Project | Shape | Serves |
| --- | --- | --- |
| `smoke` | 4 tables, 1 FK, 1 lineage edge, 3 medallion layers | Tasks 37, 38 |
| `wide` | 1 table with **187 columns**, plus 2 small neighbours with FKs into it | Task 39 — LOD, filter, scroll-aware edges |
| `large` | **200 tables**, ~3 columns each, grouped across layers | Task 39 — minimap threshold, fitView skip, frame budget |

Generate DBML in the script and import it through `POST /api/projects/:id/import` against a server
started on the fixture dir. This is Plan 1 Task 2's procedure, and it is the only sanctioned way to
create fixture state.

- [ ] **Step 4: Add the scripts**

```bash
npm pkg set scripts."e2e:serve"="cross-env STRATA_DATA_DIR=cypress/fixtures/data STRATA_DOMAIN=local PORT=5174 npm run start"
npm pkg set scripts."cy:open"="cypress open"
npm pkg set scripts."cy:run"="cypress run --spec 'cypress/e2e/!(stress-)*.cy.ts'"
npm pkg set scripts."cy:run:stress"="cypress run --spec 'cypress/e2e/stress-*.cy.ts'"
```

Running any spec is `npm run build && npm run e2e:serve` in one terminal, `npm run cy:run` in
another.

- [ ] **Step 5: Ignore generated and produced files**

`.prettierignore` gains `cypress/fixtures/data/`. `.gitignore` gains `cypress/reports/`,
`cypress/screenshots/`, `cypress/videos/`.

- [ ] **Step 6: Prove the harness reaches the app**

`cypress/e2e/boot-smoke.cy.ts`:

```ts
describe("boot", () => {
  it("serves the built app and loads the seeded project", () => {
    cy.visit("/");
    cy.contains("Strata").should("be.visible");
    cy.get('[data-testid="schema-tree"]').should("exist");
  });
});
```

**React Flow already provides most of the selector contract.** Verified in
`@xyflow/react@12.10.1` — it emits exactly six test ids, and you should use them rather than
inventing parallel ones:

```
rf__wrapper · rf__background · rf__controls · rf__minimap
rf__node-${id} · rf__edge-${id}
```

So a table node is `[data-testid="rf__node-vendas.pedido"]` and the minimap is
`[data-testid="rf__minimap"]` — no new attributes needed for either.

Add your own `data-testid` only to **Strata's own chrome**, which React Flow knows nothing about:
the navbar, icon rail, schema tree, inspector, status bar, DBML drawer and command palette. Never
select on Tailwind classes; never select on `react-flow__*` class names when a test id exists.

- [ ] **Step 7: Run and commit**

Run: `npm run build && npm run e2e:serve` then `npm run cy:run`
Expected: `boot-smoke` passes. Also `npm run test`, `npm run typecheck`, `npm run format:check` green.

```bash
git add -A && git commit -m "test(e2e): scaffold Cypress against the Fastify-served build"
```

---

## Wave O — the honesty guard, 1 agent

### Task 36: Prove the drag helper actually drags

**This task is alone in its wave and nothing may depend on an interaction helper before it is
green.** Structura shipped a helper that fired pointer events, which React Flow ignores, and every
spec using it passed while moving nothing. That is the same class of defect as Plan 2's 54
inspected-not-executed rows, and it would be worse here.

**Files:**
- Create: `cypress/e2e/node-drag-smoke.cy.ts`
- Modify: `cypress/support/commands.ts`

**Interfaces:**
- Produces: `cy.dragNode(testId, dx, dy)`, trustworthy. Consumed by Tasks 37 and 39.

- [ ] **Step 1: Write the failing guard**

The assertion is on the node's rendered `transform`, not on any internal state:

```ts
function translateOf(style: string | undefined): { x: number; y: number } {
  const m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/.exec(style ?? "");
  if (!m) throw new Error(`no translate in style: ${style}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

describe("dragNode helper", () => {
  it("actually moves a node", () => {
    cy.visit("/?project=smoke");
    cy.get('[data-testid="rf__node-vendas.pedido"]').then(($n) => {
      const before = translateOf($n.attr("style"));
      cy.dragNode("vendas.pedido", 120, 80);
      cy.get('[data-testid="rf__node-vendas.pedido"]').should(($after) => {
        const a = translateOf($after.attr("style"));
        expect(a.x).to.be.closeTo(before.x + 120, 4);
        expect(a.y).to.be.closeTo(before.y + 80, 4);
      });
    });
  });
});
```

- [ ] **Step 2: Write the helper with mouse events, never pointer events**

Verified against `@xyflow/react@12.10.1` and its `d3-drag` dependency, not from memory:

- Node dragging goes through **d3-drag**. `drag.js` binds `mousedown.drag` **on the element**, then
  binds `mousemove.drag` and `mouseup.drag` **on `event.view` — the window — in capture phase**.
  Firing all three at the node is not how a real drag reaches d3.
- `defaultFilter` is `!event.ctrlKey && !event.button`, so `button: 0` is required and `ctrlKey`
  must not be set.
- Only `mouse*` and `touch*` are bound. There is no `pointer*` listener anywhere in the chain.

```ts
Cypress.Commands.add("dragNode", (id: string, dx: number, dy: number) => {
  cy.get(`[data-testid="rf__node-${id}"]`).then(($n) => {
    const r = $n[0].getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    // mousedown on the node: d3-drag binds `mousedown.drag` on the element.
    cy.wrap($n).trigger("mousedown", { button: 0, clientX: x, clientY: y, force: true });

    // move and up on the WINDOW: d3-drag binds those on event.view, in capture
    // phase. Firing them at the node only works by propagation and is exactly
    // the kind of accident that produces a drag helper that drags nothing.
    cy.window()
      .trigger("mousemove", { clientX: x + dx / 2, clientY: y + dy / 2, force: true })
      .trigger("mousemove", { clientX: x + dx, clientY: y + dy, force: true })
      .trigger("mouseup", { force: true });
  });
});
```

Two intermediate moves, not one: d3-drag starts the gesture on the first move and applies the delta
on subsequent ones.

**The node's rendered transform is `translate(${x}px,${y}px)` — no space after the comma.** The
regex in Step 1 allows either, but do not tighten it to require a space.

- [ ] **Step 3: Prove the guard is a guard**

Temporarily change `mousedown` to `pointerdown` and re-run. **The spec must fail.** If it still
passes, the assertion is not measuring movement and the whole spec is worthless. Restore the mouse
events afterwards and report that you performed this check.

This step is the point of the task. Skipping it leaves you with a guard that guards nothing.

- [ ] **Step 4: Run and commit**

Run: `npm run cy:run --spec cypress/e2e/node-drag-smoke.cy.ts`
Expected: PASS, and the deliberate-break check reported.

```bash
git add -A && git commit -m "test(e2e): guard that cy.dragNode actually drags"
```

---

## Wave P — specs, 3 agents in parallel

### Task 37: Canvas smoke specs

Covers the `Canvas` inventory rows Wave M returned to `☐`.

**Files:** `cypress/e2e/canvas-*.cy.ts`

Cover, each with an assertion on observable result:

- **Selection** — click a node selects it; click empty canvas clears; Escape clears.
- **Drag** — via `cy.dragNode`; position persists after a save/reload cycle.
- **LOD transitions** — zoom out past 55 % collapses nodes to Sigil; zoom past 110 % with a
  selection opens Full. Assert on rendered row count, not on a class name.
- **Edges** — an FK renders with a crow's foot and **does not animate**; a lineage edge **does**.
  Assert `animation-name` on the computed style, since this is the one behavioural difference
  `identity.md` §7 promises survives at any zoom.
- **Edge peek** — hovering an edge dims non-participating nodes.
- **Layer edge** — each node's 3px left edge resolves to its medallion layer token.

Gate: every covered row ticked in `docs/parity-inventory.md` with the spec name beside it.

### Task 38: Shell, keyboard and accessibility specs

The things jsdom could not reach — including what autonomous decision 11 gave up.

**Files:** `cypress/e2e/shell-*.cy.ts`

- **Export menu** — opens; contains all ten `EXPORTERS` entries; **arrow keys move focus**; Escape
  closes and returns focus to the trigger. This is the Radix behaviour the hand-rolled `<ul>` lost,
  and Wave M's Task 30 restored; this spec is what keeps it.
- **Command palette** — ⌘K opens, typing filters, capped at 12 results, arrows move the highlight,
  Enter runs, Escape closes, click-outside closes.
- **Palette navigation** — choosing a table focuses it on the canvas *and* scrolls the DBML drawer
  to its line. Both effects, per inventory rows 29–30.
- **Shortcuts** — ⌘S, ⌘Z, ⌘⇧Z, **⌘Y**, Delete, Escape, `?`. Row 38 (⌘Y) is wired outside the
  gestures registry and is the one most likely to have been lost.
- **Focus visibility** — tab through the navbar, rail and status bar; every stop has a visible ring.

Gate: rows for `Palette`, `Shortcut` and the Export menu ticked with spec names.

### Task 39: Stress specs — the scale premise, executed

**`identity.md` §1 principle 2 reads "Design for the 200-column table."** The LOD system, the
virtualisation thresholds, the scroll-aware anchors and every constant in `scaleLimits.ts` exist to
serve that claim, and **it has never been run.** The golden fixture has two tables.

**Files:** `cypress/e2e/stress-*.cy.ts`, and a second Cypress config if `testIsolation: false` is
needed.

**`stress-wide-table.cy.ts`** against the `wide` project (187 columns):

- Full state renders a **virtualised window**, not 187 rows. Assert the rendered row count is near
  `COLUMN_VIRTUAL_VIEW_ROWS` (14), not 187 — this is the one assertion that proves virtualisation is
  actually engaged rather than merely imported.
- The in-node filter narrows the list; typing `_at` leaves only timestamp columns.
- Scrolling the column list moves a connected edge's endpoint, and a column scrolled past the top
  anchors at the viewport edge rather than drifting outside the node (`columnAnchorY`'s
  `above`/`below` kinds).

**`stress-large-diagram.cy.ts`** against the `large` project (200 tables):

- The minimap is hidden at or above `MINIMAP_MAX_TABLES` — assert on
  `[data-testid="rf__minimap"]` not existing, which React Flow provides.
- The initial `fitView` is skipped at or above `SKIP_INITIAL_FIT_TABLES`.
- Pan and zoom complete without the page becoming unresponsive.

**`stress-node-height.cy.ts`** — the highest-value spec in this plan:

For a sample of nodes in each LOD state, assert the **rendered** `offsetHeight` equals what
`nodeMetrics.nodeHeight()` predicts for that node and state, within 2px.

`autolayout` positions every node from that prediction. Unit tests prove the prediction is
self-consistent; only a browser can prove it matches what is painted. If it does not, tables overlap
on every real diagram and no existing test would notice.

Gate: all three specs pass; the node-height comparison reported with actual numbers, not "matches."

---

## Wave Q — re-verification, 1 agent

### Task 40: Re-verify the inventory, honestly

**Files:** `docs/parity-inventory.md`, `docs/superpowers/plan-3-run-log.md`

- [ ] **Step 1: Take the true starting count**

From Wave M's Task 29: how many rows are `☑`, `☐`, and dropped. Record it as the baseline.

- [ ] **Step 2: Tick only what a spec covers**

Walk every `☐` row carrying `(needs live ReactFlow — Plan 3)`. For each, either:

- a spec from Tasks 37–39 exercises it → tick it, and **write the spec file name in the row**; or
- no spec covers it → leave it `☐`; or
- it cannot be made to pass → mark it `dropped — <reason>`.

**Do not tick a row because a neighbouring row's spec touches the same component.** One row, one
assertion.

- [ ] **Step 3: Report the honest delta**

```
Baseline (after Wave M task 29):  ☑ __   ☐ __   dropped __
After Plan 3:                     ☑ __   ☐ __   dropped __
Rows still ☐, with the reason each lacks coverage: …
```

If the final `☑` is below Plan 2's claimed 258, say so plainly. That is the plan working, not
failing.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: re-verify parity inventory against live browser runs"
```

---

## Wave R — deferred verification, 2 agents in parallel

### Task 41: Verify the Windows portable build

Plan 2's Task 28 produced `dist-win/Strata-win.zip` (104.5 MB) and **never ran it**. The gate said
"the portable artifact runs"; compiling is not running.

Two honest obstacles, both reported by Wave L: the host is Darwin, and host Node is 24.5.0 against
the project's 22.11.0 pin, which the build README associates with a `STATUS_ACCESS_VIOLATION` SEA
crash on Windows.

- [ ] **Step 1: Rebuild on the pinned Node version** (`nvm use` against `.nvmrc`) and record whether
      the artifact differs from the 24.5.0 build.
- [ ] **Step 2: State plainly which of these is available** — a Windows machine, a Windows VM, or
      CI with a Windows runner. If none is, **say the build is unverified** and stop. Do not mark
      Task 28's gate satisfied.
- [ ] **Step 3: If a Windows environment exists**, launch the artifact, load the `smoke` fixture
      project, and confirm the canvas renders.

Gate: either a recorded successful launch, or an explicit statement that verification is blocked on
environment, naming which. **Never a silent pass.**

### Task 42: Measure the bundle

Autonomous decision 7 noted `@xyflow/react` lands in the main chunk with no code splitting, at
roughly 12 MB. Measure it; do not change it.

- [ ] **Step 1:** `npm run build`, then record every chunk over 200 KB with its gzipped size.
- [ ] **Step 2:** Record which chunk holds `@xyflow/react`, `@dbml/core`, `xlsx` and CodeMirror.
- [ ] **Step 3:** Write the numbers into `docs/superpowers/plan-3-run-log.md` with a one-paragraph
      note on what splitting would be worth.

**Do not implement code splitting in this plan.** It is a performance change on a plan whose entire
purpose is to stop claiming things are verified when they are not. It gets its own decision.

---

## Plan exit criteria

- [ ] `npm run test`, `npm run typecheck`, `npm run format:check` green
- [ ] `npm run cy:run` green
- [ ] `npm run cy:run:stress` green, with the node-height comparison reported numerically
- [ ] `node-drag-smoke` passes **and** the deliberate-break check was performed and reported
- [ ] Every inventory row is `☑` with a spec name, `☐` with a stated reason, or `dropped` with a
      reason — none ambiguous
- [ ] The honest before/after count is recorded, whatever direction it moved
- [ ] The Windows build is either verified or explicitly declared unverified, naming the blocker

---

## Wave summary

| Wave | Tasks | Agents | Blocked by |
| --- | --- | --- | --- |
| N | 35 | 1 | Wave M complete |
| O | 36 | 1 | 35 |
| P | 37, 38, 39 | 3 parallel | 36 |
| Q | 40 | 1 | 37, 38, 39 |
| R | 41, 42 | 2 parallel | 40 |
