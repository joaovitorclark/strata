# Strata — UX Direction

**Date:** 2026-09-12
**Status:** direction, not a spec. Written to carry two things forward that exist nowhere else:
a diagnosis found by using the app, and a change in what governs decisions.

---

## 1. What changed

Until now, **parity with LocalDrawDB governed.** Every decision was measured against
`docs/parity-inventory.md`, and "does LocalDrawDB do it this way" settled arguments. That was
correct for a migration and it is finished as a rule.

**From here, the user experience governs.** Strata does not have to do what LocalDrawDB did. Where
the old behaviour is worse, it changes, and the affected inventory rows become deliberate drops with
a reason rather than obligations.

This was decided after the first real session of using the app on a 75-table model.

---

## 2. The diagnosis: the canvas is smaller than it looks

Dragging a table, panning, zooming, creating a relation, and the general feel of the canvas were all
reported as bad. They have **one cause**.

`AppShell.tsx` is correct. It builds the frame `docs/identity.md` §6 specifies — `grid h-svh`, rows
`auto 1fr auto`, columns from `shellColumns()`. Navbar, rail, tree, canvas, inspector, status bar,
drawer: each has a slot.

**`Workspace.tsx` ignores that frame and rebuilds the chrome as floating cards over the canvas.**
Eight of them, every one at `z-20`:

| Line | Anchor |
| --- | --- |
| 435 | `absolute left-3 top-3` — the action bar (`Salvar`, `Diff`, `Importar`, `+ Tabela`…), with `flex-wrap` so it grows |
| 186 | `absolute right-3 top-3` |
| 196 | `absolute right-3 top-12` |
| 200 | `absolute right-3 top-24` |
| 256 | `absolute bottom-10 right-3` |
| 266 | `absolute bottom-12 right-3` — a `w-72` card |
| 239 | `absolute bottom-0 left-0 right-0` |
| 46 | `absolute z-20`, generic |

Five of them claim the same corner at stacked offsets, all at the same z-index. With no ordering
discipline, overlap is a matter of render luck — which is exactly what was observed: the "Camadas"
toggle sitting on top of `Desfazer` / `Refazer`.

`identity.md` §6 already says where these belong: actions in the **navbar**, Problems and zoom in the
**status bar**, layers in the **left panel**. They are frame slots, not floating cards.

**Why this explains all four complaints.** The canvas fills 100% of its grid cell but roughly 40% of
it is covered by chrome that should be in the frame. Every gesture — moving a node, panning, pulling
a relation from one column to another — happens in a fraction of the space it appears to have, with
overlays as obstacles mid-gesture. There is no separate drag bug to find.

### The first thing to fix, unrelated to the above

Clicking a table in the schema tree selects it but **does not navigate to it**. On a 75-table
diagram that is useless.

The machinery already exists and is tested: `focusTableInView` in
`features/canvas/utils/focusTableView.ts`, exposed as `ws.focusTableWithPan` in
`useWorkspace.ts:521` and already wired to five other consumers. `SchemaTree.tsx:120` calls
`selectTable` alone.

This is the fourth instance of the same seam — something built and tested in one place, never called
from the place that needs it. See AGENTS.md, "whoever builds a component names who mounts it."

---

## 3. Liam ERD as a reference

<https://liambx.com> — read as a reference for navigation and clarity, not as a target to clone.

**What it is** (from its own landing page; the live app has not been driven yet — the next session
should): an ER diagram tool that reads an existing schema and renders it for reading and sharing.
Sources include PostgreSQL, MySQL, SQLite, BigQuery, Prisma, Rails and Drizzle. `npx @liam-hq/cli
init` wires it into CI so the diagram stays in sync with the schema; a web "Quick View" visualises
any SQL schema instantly.

### 3.1 What the visual experience actually is

Driven and looked at, not inferred. It is built on **React Flow** — the same library Strata uses —
so nothing observed here is out of reach.

**The node.** Icon plus table name in the header, then one row per column, each row separated by a
**1px divider** so the node reads as a *table* rather than a list. A column row contains exactly two
things: the name, and a glyph on the left that carries the semantics — key for primary, link for
foreign, filled diamond for not-null, hollow for nullable. **No type is shown. No badges. No colour
per table.** Everything is grey; green appears only on key glyphs. Edges are thinner and quieter
than the nodes: hairline, curved, neutral.

**Compare one row of Strata's node:** layer edge · icon · name · `⋯` menu · coloured dot · column
name · type · PK/FK badge. **Eight visual elements against Liam's two** — plus mauve, blue, green,
yellow, peach, a layer colour and a table header colour all competing, where Liam has grey and one
green.

That is the whole of the appeal. It is not a better palette or nicer icons. It is **subtraction**.

**The chrome.** One floating pill, centred at the bottom: `— 53% +`, fit, layout, and
`show: All Fields ▾`. One overlay, one place, predictable. Strata has eight at `z-20` across five
corners.

**And `show: All Fields` is Strata's Level-of-Detail, exposed as an explicit control** rather than
driven by zoom. That difference is worth taking seriously: an explicit density selector is
*predictable* — the user decides what they see — while a zoom-driven one changes the content under
them as they navigate. Strata already has the machinery (`resolveLod`, `lodHeight`, the three
states); what it lacks is the control.

### 3.2 The trap in copying it

**Liam can subtract because it is a viewer.** It never needs an edit affordance, so the eight
elements in Strata's row — the `⋯` menu, the type, the badges, the colour control — simply do not
exist for it. Removing them from Strata to look like Liam would remove the editing.

The resolution is **progressive disclosure**, which `identity.md` §1 already claims as a principle
and the implementation does not honour: Liam's calm at rest, Strata's affordances on demand. Type
and editing chrome appear on hover, on selection, or in the inspector — not on all 187 rows all the
time.

Concretely, to take from Liam without becoming it:

1. **Two elements per row at rest** — glyph and name. Type moves to hover or the inspector.
2. **Glyphs instead of lettered badges**, carrying key, nullability and FK in one mark.
3. **Row dividers**, so a table reads as a table.
4. **Monochrome plus one accent.** Colour only where it means something; layer colour on the node
   edge is enough without also colouring the header.
5. **Edges quieter than nodes.**
6. **One control pill**, not eight overlays.
7. **An explicit density control** alongside (or instead of) zoom-driven LOD.

Each of those is subtraction, and none of them costs an affordance.

**What it does that Strata should learn from:**

- **Relationship highlighting** as a primary navigation aid, not a hover nicety.
- **Filtering** to reduce a large schema to what matters right now.
- **Shareable links that encode focus** through query params — you send someone the diagram *at the
  place you are talking about*. Strata has no equivalent, and for a tool whose projects live in git
  and get discussed in PRs, that is a real gap.
- **Very low friction to first value** — paste a schema, see a diagram.

**The distinction that matters: Liam is a viewer, Strata is a modeler.** Liam renders what already
exists in a database; nothing is edited. Strata is where the model is *designed*, and it carries
lineage, medallion layers, git-backed projects, dbt round-trip and nine export targets.

So take Liam's thinking about **navigating and sharing a large schema**. Do not take its information
architecture wholesale — it is shaped by never needing an edit affordance, and Strata needs them
everywhere.

---

## 4. Not negotiable

Whatever changes, these stay:

- **Lineage**, table-level and field-level, distinct from foreign keys. Almost nothing else has it.
- **Editing the model as code**, not only through the canvas. Which *language* is open (§5); that
  there is a text surface is not.
- Everything in `AGENTS.md` under "Non-negotiable north stars" — git-native projects, local-first,
  mirroring Structura's contracts, canvas-first.

---

## 5. The open question: what is the editable artifact?

Today DBML is the source of truth. The willingness to drop it in favour of editing SQL or YAML
directly is on the table, and deserves reflection rather than a quick answer.

The question is not "DBML or SQL or YAML". It is:

> **Is the thing the user edits one file in a modeling language, or the actual dbt project?**

**Keeping DBML.** It is designed for *modeling* — `[ref: > table.col]` expresses a relation inline,
which is the single most common thing a user writes. It is compact enough that a 75-table model
stays readable. And `features/schema/model/` — 4,296 lines and 20 test files — is built on it, with
all nine exporters downstream.

**Editing the dbt project directly** (`models/**/*.sql` + `schema.yml`). `AGENTS.md` north star 6
says dbt-first is the goal. Editing the real artifact removes a translation layer and the drift that
comes with it, and SQL is what every other tool in the ecosystem reads, Liam included. The costs are
real: DDL is verbose, a relation takes far more typing than `[ref:]`, and **SQL cannot express
lineage or medallion layers at all** — those would live in `schema.yml` under `meta`, which is
already where Strata puts them. So this path does not remove the metadata sidecar; it makes it
load-bearing.

**YAML alone** is not an option: `schema.yml` describes columns and tests but does not define the
models. It is half of dbt, not an alternative to DBML.

**What to weigh.** How often is the text surface used to *author* versus to *inspect and correct*?
If authoring, DBML's ergonomics matter a lot. If inspecting, editing the real dbt files matters more
and DBML becomes a lossy intermediate nobody asked for. That question is about how the product is
actually used, and it has not been answered.

A third shape exists and should be considered: **keep DBML as the editing surface and make the dbt
project the persisted form**, with the drawer able to show either. That keeps the ergonomics and
removes the "which file is real" ambiguity, at the cost of a round-trip that must be lossless — a
property `dbtRoundtrip`, `dbtMetaRoundtrip` and the golden fixtures already test for.

---

## 6. Decided versus open

**Decided:** parity no longer governs · the chrome belongs in the frame, not floating over the
canvas · tree click must navigate · lineage and a code surface stay.

**Open:** the editable artifact (§5) · whether to adopt shareable focus links · how far to go in
rebuilding the canvas's information architecture · what happens to the inventory rows that a UX
change deliberately invalidates.

---

## 7. Known defects carried forward

Plan 4 closed at **254 ☑ · 0 ☐ · 6 dropped** of 260 — zero unchecked, which was the criterion.
Four of the six drops are real defects rather than deliberate decisions, and they are deferred here
rather than fixed because fixing them inside the current canvas architecture would be thrown away by
§2's rework.

| Row | Defect |
| --- | --- |
| 68 | **Field-level lineage cannot be created.** `ColumnRow.tsx` mounts the relation handles (`t:` at :86, `s:` at :144) but never the `fl:s:` / `fl:t:` ones — while `Canvas.tsx:533,546` already contains the logic to *accept* those connections. The canvas knows how to receive L2 lineage; the handles you would drag from do not exist. |
| 46 | **Escape's two-stage behaviour is broken.** A capture-phase listener in the command palette clears the table on the first press, so the column is never dropped first. This is the *second* appearance of that exact pathology — the Delete key was dead for the same reason (a capture listener calling `preventDefault` with no handler behind it). |
| 43 | **Rubber-band selection does not work.** `selectionOnDrag` is inert while `panOnDrag` remains the default, so dragging the pane always pans. `⌘`/`Ctrl`-click multi-select does work. |
| 65 | **TableGroup drag is unverified**, not known-broken. The group's drag handle does not latch React Flow's drag in the test harness; production may well move the members. Unknown. |

### The seam pattern, and why the sweep missed it

Row 68 is the **fifth** instance of one thing: something exists on one side of a seam and nothing
calls it from the other.

1. `LineagePorts` — component built, never mounted.
2. `TableInfoPopover` — the ⓘ affordance never added.
3. `removeSelectedRef` — callback never passed through.
4. `focusTableWithPan` — never called from `SchemaTree`, which is the surface that needs it most.
5. `fl:` handles — JSX elements never rendered, while the receiving logic exists.

A sweep for components never referenced outside tests found only unused shadcn primitives, and
concluded nothing was hiding. **That sweep was too narrow**: it catches shape 1 and misses the other
four. The general shape is *defined or handled but never produced* — a handler for a connection
nobody can start, a callback nobody passes, a prop nobody sets.

A useful check before the rework: for every branch that consumes an identifier (`fl:`, a handle id,
an action name), find the code that produces it. Where nothing does, that is a dead affordance.

---

**Known and unfixed**, found the same session, unrelated to any of the above:

- `vite.config.ts` lost LocalDrawDB's `/api` → Fastify proxy, so `npm run dev` serves the frontend
  with no API behind it. Everything has been tested through `npm run start` or `e2e:serve`, which
  serve both on one port, so nothing caught it.
- `/api/meta` reports the `DATA_DIR` constant rather than the resolved `baseDataDir()`, so it lies
  whenever `STRATA_DATA_DIR` is set.
