# AGENTS.md — Strata

> Orientation for AI agents and humans working in this repository.
>
> **Status (2026-09-14): UX rework done; the current phase is the migration to dbt as the source of
> truth.** 267 files under `src/`, 71 under `server/`, 155 unit-test files (984 tests), 38 Cypress
> specs (163 smoke + stress). The UX rework — specs S01–S12 plus two external reviews — is integrated
> in `research/ux-ui-proposal`; the migration follows
> [`docs/decisions/0001-dbt-as-source-of-truth.md`](docs/decisions/0001-dbt-as-source-of-truth.md)
> in phases D1–D7 and S13 (`docs/superpowers/specs/dbt/`).
>
> LocalDrawDB is **frozen and archival**: read it for reference, never write to it. **Parity with it
> no longer governs**; the decision record and the specs do.

## What Strata is

**Strata** is a **local-first modeler for databases and data lakehouses**. You draw tables, columns,
keys, relationships, field lineage and medallion layers on a canvas, and generates the dbt
transformation between them. **The source of truth is a dbt project** (YAML + SQL, with visual
metadata under `.strata/`); DDL is an editable projection; Spark SQL and the other formats are
outputs. Every domain is a git repository.

> **Transition:** until phase D6 lands, projects in the legacy DBML format still exist and must keep
> working. A project is dbt when `<domain>/.strata/<project>/project.yml` exists.

It is the next generation of [**LocalDrawDB**](https://github.com/joaovitorclark/localdrawdb),
rebuilt here with a new visual identity, a canvas-first layout, and an architecture that mirrors
[**Structura**](https://github.com/clarkjoao/Structura)'s contracts so it can later be registered
into that platform rather than rewritten for it.

Dois formatos convivem: um domínio pode ter projetos DBML (`projects/<slug>/`) e projetos dbt no
layout da 0001 (marca `.strata/<projeto>/project.yml`); D2 edita dbt pelo canvas e pelo inspector.

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

CI (GitHub Actions) runs `npm ci` then typecheck, lint, format:check, test, and build on every PR and every push to `main` and `research/**`; e2e (`cy:run`) needs verify; stress (`cy:run:stress`) is manual via `workflow_dispatch`.

The app needs the server: it is not a static SPA. Projects, git and every export live behind
Fastify, and the built app is served by it through `@fastify/static`.

## Where things live

```
server/                     Fastify + filesystem + git. Ported verbatim from LocalDrawDB.
src/
  features/
    dbt-source/             dbt project ⇄ StrataModel ⇄ ParseResult; YAML edits (lib `yaml`). NO REACT.
    schema/model/           the legacy DBML domain core — parse, edit, validate. NO REACT. Retired by D6.
    schema/store/           Zustand + Immer slices
    canvas/utils|hooks/     geometry, autolayout, virtualisation — ported, heavily tested
    canvas/components/      the React canvas, on @xyflow/react v12
    source/ projects/ panels/ command-palette/ shell/
  infrastructure/api/       the ONLY place that calls fetch — the seam IStoragePort replaces later
  components/ui/            shadcn, CLI-generated. Never hand-edited.
docs/decisions/             decision records — the contract a spec may not contradict
docs/                       north stars, identity, parity inventory, specs and plans
.github/workflows/ci.yml    verify (typecheck, lint, format, test, build) + e2e; stress is manual
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
4. **Canvas-first.** The code lives in an on-demand bottom drawer (tabs: dbt files, DDL, records,
   diff). No permanent split pane.
5. **Visual identity is the Catppuccin ramp, dark-first.** See [`docs/identity.md`](docs/identity.md).
   **Theme names in code and UI are `dark` and `light`.** Macchiato and Latte are where the values
   come from; they are not user-facing vocabulary and must never appear in `src/`.
6. **dbt is the source of truth.** Decided in
   [`docs/decisions/0001-dbt-as-source-of-truth.md`](docs/decisions/0001-dbt-as-source-of-truth.md):
   semantic data in the dbt YAML under `config.meta.strata`, visual data in `.strata/`, one dbt
   project per domain, managed models marked by tag + meta + `@generated` + lockfile. Being
   implemented in phases D1–D7.

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

**A mutation is verified by the change it makes to the project's files.** For dbt projects, the
diff of `models/**`, `seeds/**` and `.strata/**`; for legacy projects, the DBML. Not by a class name,
not by a store value, not by a rendered edge. If the files did not change, nothing happened.

**Nothing Strata does not understand is ever removed.** Manual SQL, macros, custom tests, adapter
configs and YAML comments survive every operation. This rule exists because two data-loss defects
were found in review: regex edits on a text document overwrote a table and emptied views.

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

**Know which server your tests hit.** Several agents run e2e servers at once. Before Cypress, confirm
with `lsof -iTCP:<port>` that the listening process has its cwd in *your* worktree — a green run
against someone else's build was once reported as proof.

### How work is split

Two kinds of agent work here, with fixed roles:

| | Implementation agent (orchestrator + subagents) | Review / design session |
| --- | --- | --- |
| Does | specs with countable gates, in waves | research, decision records, specs, prototypes, reviews, small surgical fixes, integration |
| Branches | `ux/<task>`, one worktree each (`~/www/strata-ux-<task>`) | `fix/<topic>`, `docs/<topic>`, `review/<topic>` in `~/www/strata-claude` |
| E2E ports | 5170–5199 | 5290–5299 |
| Integrates into `research/ux-ui-proposal` | **never** | yes, after reviewing the diff against the spec and running the suite |

Rules: nobody pushes or opens a PR without the owner asking. The implementation agent stops at the
end of each wave and waits for integration before starting the next one from the updated
`research/ux-ui-proposal`. A prototype approved by the owner beats the spec text where they disagree,
and the divergence goes in the report.

## The parity inventory

[`docs/parity-inventory.md`](docs/parity-inventory.md) was the contract of the LocalDrawDB migration:
260 rows, one per thing a user can do. That migration closed. The inventory is now **historical**:
when a spec deliberately changes one of those behaviours, the row becomes `dropped — superseded by
<spec>` in the same change. A row is never quietly removed.

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
| [`docs/decisions/`](docs/decisions/) | decision records; 0001 makes dbt the source of truth |
| [`docs/ux-ui-research.md`](docs/ux-ui-research.md) | the UX/UI research against Liam, erwin and Oracle Data Modeler |
| [`docs/identity.md`](docs/identity.md) | the design system — tokens, type, the table node, edge language |
| `docs/superpowers/specs/ux/` | UX rework specs S01–S12 (done) |
| `docs/superpowers/specs/dbt/` | dbt migration phases D1–D7 and S13 (in progress) |
| `docs/superpowers/ux-run-log.md` | what the implementation agent did, wave by wave |
| [`docs/strata-transition.md`](docs/strata-transition.md) | north star: what Strata becomes and why (predates 0001; 0001 wins) |
| [`docs/convergence-and-platform-vision.md`](docs/convergence-and-platform-vision.md) | north star: the fusion with Structura |
| [`docs/parity-inventory.md`](docs/parity-inventory.md) | the 260-row LocalDrawDB contract — historical; rows change only as `dropped — superseded by <spec>` |
| `docs/superpowers/specs/` · `plans/` | older phase specs and plans |

Approved prototypes (owner-approved, referenced from their specs): table node (S07), transform screen
(D7), canvas editing (D2).

New work goes: spec → plan → tasks. Never straight to code.

## Keeping this file honest

This file was wrong for eleven waves — it claimed the repo held documents only while 207 source
files sat beside it — because no task owned it. **If something here becomes stale, fix it in the
same change that made it stale.**
