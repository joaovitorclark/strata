# Strata — Canvas Verification Design Spec

**Date:** 2026-09-11
**Status:** approved. Wave M complete — inventory baseline is 201 ☑ / 57 ☐ / 2 dropped.
**Depends on:** Plan 2 and Wave M complete, including Task 34b (pins as a DBML block).
**Implementers:** Cursor AI agents (Grok / Composer), orchestrated in one window

---

## 1. Purpose

Plan 2 rebuilt the canvas and shipped 842 green tests. **None of them exercised the canvas.**

`jsdom` cannot drive `@xyflow/react`. Plan 2 discovered this the hard way and worked around it three
separate times:

| Where | What happened |
| --- | --- |
| Tasks 16, 26 | `<Canvas />` is mocked in both shell test files (`AppShell.test.tsx`, `Workspace.test.tsx`) |
| Autonomous decision 16 | 54 `Canvas` inventory rows ticked as *"wired; sem ReactFlow ao vivo no jsdom"* — code inspected, behaviour never run |
| Autonomous decision 11 | The Navbar's shadcn/Radix dropdown was **replaced with a hand-rolled `<ul role="menu">` because Radix does not open under jsdom** |

A verification attempt at the end of Wave L hung for ~100s and died.

The third row is the one that matters most: **a test-environment limitation changed production UI**,
silently, inside a task that reported green. It cost keyboard navigation, focus trap and
`aria-activedescendant`.

This plan gives the canvas an environment that can actually drive it, and then re-verifies what was
claimed without one.

### In scope

- Cypress, mirroring Structura's setup so the two repos share one e2e idiom.
- Smoke specs covering the canvas behaviours the inventory claims.
- **Stress specs** — the first real test of the claim the entire design rests on.
- Re-verification and honest re-ticking of every row Wave M's Task 29 returns to `☐`.
- Reverting the jsdom-driven UI compromise.
- Verifying the Windows portable build, which Plan 2 built but never ran.

### Out of scope, unchanged

dbt as primary format · `IStoragePort` · indexes · TableGroups · the git diff drawer tab. Plus
anything Wave M already owns: density wiring, pin persistence, `ProjectSwitcher` delete semantics,
the `tokenUrl` string, the missing `localdrawdb+oracle` golden.

---

## 2. The lesson Structura already paid for

`Structura/cypress/e2e/node-drag-smoke.cy.ts` opens with this:

> *"Proves `cy.dragNode` actually drags. The helper it exercises used to fire pointer events, which
> React Flow ignores — every test using it passed while moving nothing. This spec is small and fast
> on purpose: it is the guard that keeps the helper honest, so the slow stress specs can rely on
> it."*

**A canvas test that passes while nothing moves is the exact failure Plan 2 already produced once**,
in jsdom, at the scale of 54 inventory rows. Repeating it in Cypress would be worse, because a green
browser test carries far more authority than a green jsdom test.

Therefore: **the helper guard is built before any spec that depends on it** (Task 36), and it is not
optional.

Verified against `@xyflow/react@12.10.1` rather than taken from the docstring:

- Node dragging runs through **d3-drag**. It binds `mousedown.drag` on the element, then
  `mousemove.drag` and `mouseup.drag` on **`event.view` — the window — in capture phase**.
- Its `defaultFilter` is `!event.ctrlKey && !event.button`: the primary button is required.
- Only `mouse*` and `touch*` listeners exist. There is no `pointer*` listener in the chain, which is
  precisely why Structura's helper moved nothing.
- The node's rendered transform is `translate(${x}px,${y}px)`, built from
  `internals.positionAbsolute` — no space after the comma.

React Flow also ships its own selector contract, which this plan uses rather than inventing one:
`rf__wrapper`, `rf__background`, `rf__controls`, `rf__minimap`, `rf__node-${id}`, `rf__edge-${id}`.

---

## 3. How Strata differs from Structura

Mirror the idiom, not the plumbing. Two differences are load-bearing.

### 3.1 Strata is not a static SPA

Structura has no backend, so its Cypress `baseUrl` is `http://localhost:4173` — `vite preview`
serving static files.

Strata has an 11,000-line Fastify server that owns projects, git and every export. The built app is
served by that same server through `@fastify/static`, which the `start` script already runs.

**`baseUrl` is `http://localhost:5174`**, and the pre-test step is `npm run build && npm run start`
— one process serving both the app and the API. Do not add `vite preview`; it would serve the app
without the API behind it and every project load would fail.

### 3.2 Seeding is a data directory, not localStorage

Structura seeds a diagram by writing `structura_diagram-store` into `localStorage` before `cy.visit`.
Strata's state lives on the server's filesystem, so that mechanism does not exist.

Seed the way Plan 1's Task 2 already proved works — today's variable names are
`LOCALDRAWDB_DATA_DIR` / `LOCALDRAWDB_DOMAIN`, and Task 35 renames them before any script is
written, so **scripts use the new names**:

```
STRATA_DATA_DIR=<fixture dir>  STRATA_DOMAIN=local  PORT=5174  npm run start
```

A committed fixture data directory gives every spec the same deterministic diagram, and no spec ever
touches a real project.

> **Rename these env vars.** They still read `LOCALDRAWDB_*`: Plan 1's Task 7 was authorised to change
> only the data-directory *string*, not variable names. Baking `LOCALDRAWDB_DATA_DIR` into Cypress
> scripts would carry the old product's name into Strata's permanent tooling. Rename to
> `STRATA_DATA_DIR` and `STRATA_DOMAIN`, reading the old names as a fallback, before any spec script
> is written. This is the "do not inherit the dirt" rule from Plan 2's Global Constraints.

---

## 4. What the stress specs are actually for

Structura ships `stress-panels-render`, `stress-panels-interaction` and
`stress-panels-performance`. Strata needs the same shape for a different reason.

**`docs/identity.md` §1 principle 2 reads: "Design for the 200-column table."** The whole
Level-of-Detail system, the virtualisation thresholds, the scroll-aware edge anchoring, the
`MINIMAP_MAX_TABLES` and `SKIP_INITIAL_FIT_TABLES` limits — every one of those exists to serve a
scale claim that **has never been executed**. The golden fixture's sample schema has two tables.

So the stress specs are not a nice-to-have appended to the end of a plan. They are the first
occasion on which the product's central design premise gets tested at all:

| Claim | Source | Spec |
| --- | --- | --- |
| A 187-column table stays usable | `identity.md` §7 | LOD transitions, in-node filter, virtualised scroll |
| Edges follow columns as a table scrolls | `columnHandleGeometry.ts` | anchor `kind` flips to `above`/`below` at the viewport edge |
| A 200-table diagram is navigable | `scaleLimits.ts` | minimap hides, initial `fitView` skipped, frames hold |
| Node heights match `nodeMetrics` | Plan 2 Global Constraints | rendered height equals `nodeHeight()` prediction, or autolayout collides |

The last row deserves emphasis: `autolayout` positions every node from a *predicted* height. Unit
tests prove the prediction is self-consistent. **Only a browser can prove the prediction matches
what is painted.** If it does not, tables overlap on every real diagram, and no existing test would
notice.

---

## 5. Re-verification is subtraction, not addition

Wave M's Task 29 returns every row ticked by code inspection to `☐` with the note
`(needs live ReactFlow — Plan 3)`. This plan's job is to move those rows back to `☑` **one at a
time, each behind a spec that ran**.

Rules:

- A row is ticked only when a Cypress assertion exercises it. Not "the handler is bound."
- A row that cannot be made to pass is **dropped with a reason**, never quietly re-ticked.
- The final count is reported honestly even if it is lower than Plan 2's 258. A smaller true number
  is more useful than a larger aspirational one.

The number this plan starts from is unknown until Task 29 reports it, which is why this plan lists
Task 29 as a prerequisite rather than guessing.

---

## 6. Reverting the jsdom compromise

Autonomous decision 11 is reverted by Wave M's Task 30, which restores the shadcn `DropdownMenu` and
**shrinks the jsdom test** rather than the component. This plan supplies what that test can no
longer assert: a Cypress spec that opens the menu, walks it with the keyboard, and checks focus
behaviour — the things Radix provides and a hand-rolled `<ul>` does not.

The rule this establishes, and which outlives both plans: **when the harness cannot drive a
component, the test shrinks — the component does not.**

---

## 7. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **A drag helper that fires the wrong event type** — every spec passes while nothing moves. Structura's documented scar. | Task 36 is a dedicated guard spec, built before anything depends on the helper. |
| 2 | **Re-verification degenerates into re-ticking.** An agent under pressure marks rows to clear the board. | Every tick must name the spec and assertion that covers it; Task 40's report lists row → spec. |
| 3 | **Stress specs are slow and get skipped in CI.** | Separate script, as Structura does (`cy:run:stress`). Slow is acceptable; absent is not. |
| 4 | **`testIsolation: false`** (Structura's setting) lets state leak between tests and produces order-dependent passes. | Keep it for stress specs only; smoke specs seed per spec. |
| 5 | **The Windows build cannot be verified on Darwin.** Plan 2 produced a 104.5 MB zip and never ran it; host Node 24.5.0 versus the 22.11.0 pin risks a known SEA crash. | Task 41 states the honest options; it does not pretend a build is verified because it compiled. |

---

## 8. What this plan does not fix

The bundle has no code splitting and `@xyflow/react` is pulled into the main chunk. That is a real
product concern for a local-first app, but it is a performance task, not a verification one, and it
should not ride along on a plan whose whole point is to stop claiming things are verified when they
are not. Task 42 measures it and records the number; changing it is a separate decision.
