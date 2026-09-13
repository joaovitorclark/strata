# AGENTS.md — Strata

> Orientation for AI agents and humans working in this repository.
>
> **Status: migrated and verified. The current phase is user experience.** The application is here —
> 207 files under `src/`, 67 under `server/`, 133 test files, 880 unit tests, 83 Cypress specs.
> The parity inventory closed at **254 ☑ · 0 ☐ · 6 dropped** of 260.
>
> LocalDrawDB is **frozen and archival**: read it for reference, never write to it. And **parity
> with it no longer governs** — see [`docs/ux-ui-research.md`](docs/ux-ui-research.md), which is the
> document that describes what the work is now.

## What Strata is

**Strata** is a **local-first modeler for databases and data lakehouses**. You draw tables, columns,
keys, relationships, lineage and medallion layers on a canvas; **DBML is the editable source of
truth**; the model exports to nine formats and every project is versioned in git.

It is the next generation of [**LocalDrawDB**](https://github.com/joaovitorclark/localdrawdb),
rebuilt here with a new visual identity, a canvas-first layout, and an architecture that mirrors
[**Structura**](https://github.com/clarkjoao/Structura)'s contracts so it can later be registered
into that platform rather than rewritten for it.

## Running it

```bash
npm run dev            # Vite, port 8080
npm run dev:server     # Fastify API, port 5174
npm run start          # production: Fastify serves the built app AND the API on 5174

npm run test           # Vitest
npm run typecheck      # tsc over app, node and server configs
npm run lint           # eslint
npm run format:check   # prettier, printWidth 100
npm run build          # typecheck && vite build

npm run e2e:serve      # serves the build against a copy of the Cypress fixture data
npm run cy:run         # Cypress smoke specs
npm run cy:run:stress  # Cypress stress specs (187-column table, 200-table diagram)
```

The app needs the server: it is not a static SPA. Projects, git and every export live behind
Fastify, and the built app is served by it through `@fastify/static`.

## Where things live

```
server/                     Fastify + filesystem + git. Ported verbatim from LocalDrawDB.
src/
  features/
    schema/model/           the DBML domain core — parse, edit, validate, lineage. NO REACT.
    schema/store/           Zustand + Immer slices
    canvas/utils|hooks/     geometry, autolayout, virtualisation — ported, heavily tested
    canvas/components/      the React canvas, on @xyflow/react v12
    source/ projects/ panels/ command-palette/ shell/
  infrastructure/api/       the ONLY place that calls fetch — the seam IStoragePort replaces later
  components/ui/            shadcn, CLI-generated. Never hand-edited.
docs/                       north stars, identity, parity inventory, specs and plans
cypress/                    e2e specs and the committed fixture data
```

## Non-negotiable north stars

1. **Git-native project management is the differentiator.** Domains → projects, each versioned;
   branch, commit, push, PR. Do not regress it. It should eventually become a platform-level
   capability that every Structura domain inherits.
2. **Local-first now, SaaS later.** Core editing must never *require* a remote server.
3. **Mirror Structura's contracts, don't fork them.** Token names, the descriptor registry,
   `IStoragePort`, the Plugin API, the importer/exporter contributions. Strata-only concepts are
   **new names alongside**, never redefinitions.
4. **Canvas-first.** DBML stays the source of truth but lives in an on-demand bottom drawer. No
   permanent split pane — nothing about the layout should let anyone compare Strata to dbdiagram.io.
5. **Visual identity is the Catppuccin ramp, dark-first.** See [`docs/identity.md`](docs/identity.md).
   **Theme names in code and UI are `dark` and `light`.** Macchiato and Latte are where the values
   come from; they are not user-facing vocabulary and must never appear in `src/`.
6. **DBT-first is the goal, not the state.** Today dbt is one of nine export targets with a working
   round-trip. Promoting it to *the* primary format is specified in
   [`docs/strata-transition.md`](docs/strata-transition.md) §6 and has not been done.

## How this repo works

Eleven waves of migration produced these rules. They are not style preferences; each one was written
after something broke.

### On ported code

**Verbatim means verbatim.** Code ported from LocalDrawDB admits exactly three edits: import paths,
type errors from the TypeScript version, and Prettier. No renaming, no refactoring, no deleting
"dead" code. The ported code is covered by tests written against its current behaviour, so every
unrequested edit is an untested change.

**Never adapt a test assertion.** A red ported test means the port is wrong, not the test. Adapting a
test *harness* call to a newer API is allowed and must be called out.

**Relocation is permitted; rewriting is not.** Strata does not have to inherit LocalDrawDB's filing.
A move qualifies only if the thing is already exported, has no React, has its own test that travels
with it, is copied byte-identically, and lands where this repo's conventions already say it goes.
*If you have to decide what the new shape should be, it is a rewrite — stop.*

**Do not rebuild what exists.** Column virtualisation, scroll-aware edge anchoring and a compact node
mode were all inherited working and tested. Rebuilding one is a defect, not a style choice.

### On verification

**Code wired is not behaviour verified.** A parity row is ticked only when a test actually exercised
it — never because a handler is bound or an import resolves. This rule exists because 54 rows were
once ticked by code inspection and every one of them was wrong.

**A mutation is verified by the change it makes to the DBML.** Not by a class name, not by a store
value, not by a rendered edge. The canvas is an editor for a text document; if the text did not
change, nothing happened.

**When the harness cannot drive a component, the test shrinks — the component does not.** jsdom
cannot drive React Flow or Radix. That is a fact about the harness, and it once leaked into
production UI as a hand-rolled menu that cost keyboard navigation and focus trapping.

**A test helper that performs a gesture needs a guard that proves it.** React Flow ignores pointer
events; a helper firing them passes while doing nothing. Every such helper gets a spec that
deliberately breaks it and confirms the failure is real.

**Gates must be countable.** "Cover these themes" is self-fulfilling. Name the rows, count them.

### On working in parallel

**Whoever builds a component names who mounts it, and the mounting task carries that in its gate.**
Three separate bugs — unrendered lineage ports, a dead Delete key, a missing info affordance — were
all components built by one task and mounted by none.

**Verify a claim by running it, not by reading it.** Gates written from reading the source, without
executing anything, failed in four consecutive waves. Install the package and compile the probe.

## The parity inventory

[`docs/parity-inventory.md`](docs/parity-inventory.md) is the contract: 260 rows, one per thing a
user can do, extracted from LocalDrawDB before it was frozen. **The migration is complete when every
row is `☑` with the test that covers it, or `dropped` with a reason.** A row is never quietly
removed.

## Relationship to Structura

Structura is the **host platform** Strata will join, and Strata is the first external domain to be
absorbed. Its public contracts — the node descriptor registry, `IStoragePort`, the Plugin API, the
discriminated-union component model, the io importer/exporter contributions — are the integration
surface to align to. `docs/convergence-and-platform-vision.md` has the detail.

Alignment already done: token names, `darkMode: ["class"]`, the `features/` layout with a React-free
domain, `@xyflow/react` v12, pinned shared dependency versions, and an exporter registry shaped like
`ExporterContribution`.

## Documents

| Path | What it is |
| --- | --- |
| [`docs/identity.md`](docs/identity.md) | the design system — tokens, type, the table node and its Level-of-Detail, edge language, and the backlog in §12 |
| [`docs/strata-transition.md`](docs/strata-transition.md) | north star: what Strata becomes and why |
| [`docs/convergence-and-platform-vision.md`](docs/convergence-and-platform-vision.md) | north star: the fusion with Structura |
| [`docs/parity-inventory.md`](docs/parity-inventory.md) | the 260-row contract |
| `docs/superpowers/specs/` | design specs — the *why* of each phase |
| `docs/superpowers/plans/` | implementation plans — the *what*, as tasks with gates |

New work goes: spec → plan → tasks. Never straight to code.

## Keeping this file honest

This file was wrong for eleven waves — it claimed the repo held documents only while 207 source
files sat beside it — because no task owned it. **If something here becomes stale, fix it in the
same change that made it stale.**
