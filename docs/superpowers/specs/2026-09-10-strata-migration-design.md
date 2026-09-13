# Strata Migration — Design Spec

**Date:** 2026-09-10
**Status:** approved, ready for implementation planning
**Implementers:** Cursor AI agents (Grok / Composer), working in parallel from small tasks

---

## 1. Purpose

Migrate the working LocalDrawDB application into the Strata repository on a new stack and a new
visual identity, reaching **feature parity with zero new features**.

### In scope

- New repo (`strata`), clean git history.
- New stack: Tailwind + shadcn/ui, `@xyflow/react` v12, Zustand + Immer slices, `features/` layout
  with a React-free domain core.
- New visual identity: the token system in [`docs/identity.md`](../../identity.md), dark-first with
  a full light theme.
- New layout paradigm: canvas-first, DBML in an on-demand bottom drawer — **not** the current fixed
  40 % code / 60 % diagram split pane.
- All existing behaviour preserved and verified against a written parity inventory.

### Out of scope — deliberately

These are real and planned, but they are **not** this migration. Each gets its own spec later.

| Deferred | Where it is recorded |
| --- | --- |
| dbt promoted to primary format | [`strata-transition.md`](../../strata-transition.md) §6 |
| `IStoragePort` wrapper around the server | [`convergence-and-platform-vision.md`](../../convergence-and-platform-vision.md) §4.3 (Phase 3) |
| Indexes as a column marker | [`identity.md`](../../identity.md) §12.1 — **has an open question, do not design yet** |
| TableGroups on canvas | [`identity.md`](../../identity.md) §12.2 |
| Git diff tab in the drawer | [`identity.md`](../../identity.md) §12.3 |
| Cypress e2e | Structura has it; Strata adds it after parity |

If a task tempts you into any row of that table, **stop and report** rather than widening scope.

---

## 2. Decisions and their rationale

| Decision | Rationale |
| --- | --- |
| **LocalDrawDB freezes** during the migration | Single cutover. No dual maintenance, no sync strategy, no drift. |
| **Parity + new stack only** | Smallest change that gets off the old stack. Everything after is cheaper once the new stack is in place. |
| **Strata starts with clean git history** | Strata's `git log` is its own narrative; LocalDrawDB stays as a consultable archive. Accepted cost: `git blame` on ported files points at the import commit. |
| **`server/` ports verbatim, untouched** | 11,001 lines, no React, and it carries the test suite that makes the whole migration safe. Wrapping it behind `IStoragePort` is Phase 3, not now. |
| **React layer is rebuilt, not ported** | The layout changes fundamentally, `styles.css` (3,199 lines) is fully replaced, and reactflow v11 → v12 breaks all 47 canvas files. There is no version of this that ports. |
| **Windows portable build revalidated last** | Kept in the repo, blocks no step, verified in Stage 6. |

---

## 3. Rules for implementing agents

**Read this section before every task. It is the difference between a migration and a rewrite.**

### 3.1 Verbatim means verbatim

When a stage says *port verbatim*, the **only** permitted edits are:

1. Import path rewrites (to the `@/` alias and the new folder layout).
2. Type errors caused solely by the TypeScript 5.6 → 6 version bump.
3. Prettier formatting (`printWidth: 100`).

You may **not**: rename identifiers, extract functions, split files, reorder code, delete "dead"
code, add or remove comments, change error messages, or "improve" anything. If you believe ported
code is wrong, **leave it exactly as it is** and write the concern in the task report. Someone will
decide later, with the tests as evidence.

This rule exists because the ported code is covered by tests that were written against its current
behaviour. Every unrequested edit is an untested change.

### 3.2 Hard rules inherited from Structura

- **No React or JSX under `src/features/*/model/`.** The domain core stays framework-free. A
  `import ... from "react"` in a `model/` file is a failed task.
- **Never hand-edit `src/components/ui/`.** Those are shadcn components; regenerate them with the
  shadcn CLI. Wrap them in your own components if you need different behaviour.
- **TypeScript strict mode stays green.** `npm run typecheck` is the gate, not a suggestion.
- **Prettier `printWidth: 100`,** enforced by `npm run format:check`.
- **i18n locales are `en` and `pt-BR`, and `pt-BR` is the fallback** — not `en`.

### 3.3 Token and identity rules

- Colour, spacing, radius and elevation values come from `docs/identity.md` and
  `design-system/globals.css`. **Do not invent a colour.** If you need one that does not exist, stop
  and report.
- **Theme names in code and UI are `dark` and `light`.** The Catppuccin flavour names (Macchiato,
  Latte) are the source of the values and must never appear in user-facing strings.
- Token **names** mirror Structura's exactly. Adding a Strata-only token is allowed; renaming or
  redefining a Structura-owned one is not.

### 3.4 Task discipline

- A task is **not done** until its stated verification command has been run and its green output
  pasted into the task report. "It should work" is not a result.
- If a verification gate fails for a reason **outside your task's scope**, stop and report. Do not
  fix it. Do not widen scope to make your gate pass.
- Tasks are written to be independent. If you find you need a file another task owns, that is a
  dependency error in the plan — report it instead of editing across the boundary.

---

## 4. Target architecture

Mirrors Structura's layout so a Strata module can later be registered into the platform rather than
rewritten.

```
strata/
├─ docs/
│  ├─ identity.md                    # design system spec (already written)
│  ├─ strata-transition.md           # north star 1
│  ├─ convergence-and-platform-vision.md   # north star 2
│  ├─ parity-inventory.md            # ← produced by Stage 0, the parity contract
│  └─ superpowers/specs/             # this document
├─ design-system/                    # reference example; values fold into src/ at scaffold
├─ server/                           # Fastify + filesystem + git — ported verbatim
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                        # shell composition ONLY — target < 150 lines
│  ├─ index.css                      # ← design-system/globals.css
│  ├─ components/
│  │  └─ ui/                         # shadcn, CLI-generated, never hand-edited
│  ├─ features/
│  │  ├─ schema/
│  │  │  ├─ model/                   # ← src/dsl   (NO REACT)
│  │  │  ├─ store/                   # Zustand + Immer slices
│  │  │  └─ __tests__/
│  │  ├─ canvas/
│  │  │  ├─ components/              # rebuilt on @xyflow/react v12
│  │  │  ├─ utils/                   # ← pure geometry ported verbatim
│  │  │  └─ __tests__/
│  │  ├─ source/                     # CodeMirror DBML editor + the drawer
│  │  ├─ projects/                   # ← src/domains (git panel, domain picker, credentials)
│  │  ├─ records/                    # ← src/records
│  │  └─ command-palette/            # ← src/palette + src/help
│  ├─ hooks/
│  ├─ infrastructure/
│  │  └─ api/                        # ← src/api.ts — the seam IStoragePort replaces later
│  ├─ lib/                           # cn(), shared utils
│  └─ test/                          # vitest setup
├─ components.json                   # vendored from Structura
├─ tailwind.config.ts                # ← design-system/tailwind.config.ts
└─ vite.config.ts
```

### Why `infrastructure/api/` is a named seam

`src/api.ts` today talks to the Fastify server directly. Keeping it behind one narrow module means
Phase 3 (`IStoragePort`) changes one folder instead of hunting call sites across the app. Do not
scatter `fetch` calls anywhere else.

---

## 5. Stack and pinned versions

Pinned to Structura's `package.json` so components compile unchanged in both repos.

| Package | Version | Note |
| --- | --- | --- |
| `react` / `react-dom` | `^18.3.1` | same as LocalDrawDB |
| `@xyflow/react` | `^12.10.1` | **replaces `reactflow@^11.11.4`** |
| `zustand` | `^5.0.11` | LocalDrawDB has 5.0.14 — pin down to match |
| `immer` | `^11.1.16` | new to Strata |
| `tailwindcss` | `^3.4.19` | + `tailwindcss-animate@^1.0.7`, `autoprefixer@^10.5.4`, `postcss@^8.5.26` |
| `vite` | `^8.2.1` | **LocalDrawDB is on 5.4.8** |
| `@vitejs/plugin-react` | `^6.0.5` | |
| `typescript` | `^6.0.3` | **LocalDrawDB is on 5.6.2** |
| `vitest` | `^4.1.1` | **LocalDrawDB is on 2.1.2** |
| `prettier` | `3.9.6` | exact, not caret |
| `eslint` | `^10.8.1` | |
| `lucide-react` | `^1.28.0` | icon set; replaces hand-rolled `src/icons.tsx` |
| `i18next` / `react-i18next` | `^25.10.0` / `^16.6.0` | |
| `clsx` / `tailwind-merge` / `class-variance-authority` | `^2.1.1` / `^2.6.0` / `^0.7.1` | shadcn deps |
| `jsdom` / `@testing-library/react` | `^29.1.1` / `^16.0.0` | |

Carried over from LocalDrawDB unchanged: `@dbml/core`, `dagre`, `fastify`, `@fastify/static`,
`js-yaml`, `node-sql-parser`, `xlsx`, `@uiw/react-codemirror`, `@codemirror/lang-sql`, `tsx`,
`html-to-image`, and the Windows build chain (`esbuild`, `postject`, `archiver`, `extract-zip`,
`playwright-core`).

### Scripts

```
dev          vite                                  # port 8080
dev:server   tsx watch server/index.ts
typecheck    tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit
lint         eslint .
format       prettier --write .
format:check prettier --check .
test         vitest run
build        npm run typecheck && vite build
```

---

## 6. Port stages and gates

Each stage ends at a **gate**. A stage is not complete until its gate command is green.

### Dependency graph — what can run in parallel

```
Stage 0a  scaffold ──┬──> Stage 1  server/ verbatim  ──┐
                     ├──> Stage 2  dsl/ verbatim     ──┼──> Stage 3 ──> Stage 4 ──> Stage 5 ──> Stage 6
Stage 0b  inventory ─┘                                 │
Stage 0c  fixtures  ───────────────────────────────────┘
```

**Stages 0a, 0b and 0c are independent of each other.** **Stages 1 and 2 are independent of each
other** and both only need 0a. Everything from Stage 3 on is sequential.

---

### Stage 0 — Scaffold, inventory, fixtures

Nothing is ported yet. Three independent workstreams.

**0a · Scaffold.** Vite + React 18 + TS 6 strict on port 8080. Tailwind + shadcn (vendor Structura's
`components.json`, generate `ui/` via CLI). `src/index.css` from `design-system/globals.css`;
`tailwind.config.ts` from `design-system/tailwind.config.ts`. Vitest, ESLint, Prettier, `@/` alias,
i18n scaffold with `en` and `pt-BR` (pt-BR fallback). Empty `features/` tree.

**0b · Parity inventory** → `docs/parity-inventory.md`. See §7.

**0c · Golden fixtures.** Run all 9 exporters in LocalDrawDB over the sample schema and commit their
output to `src/test/fixtures/golden/`. These are the objective parity evidence for Stage 6 and must
be captured while LocalDrawDB still runs.

**Gate:** `npm run build` green on the empty shell; `docs/parity-inventory.md` committed; 9 golden
fixture files committed.

---

### Stage 1 — `server/` verbatim · 11,001 lines · risk: near zero

Copy `server/` and `server/__tests__/` unchanged. Permitted edits per §3.1 only, plus any
`localdrawdb` string used in data-directory resolution.

**Explicit carry-over check:** the `data/` git-isolation fix (LocalDrawDB commit `5f40224`) lives in
`server/paths.ts` and `server/git.ts`. It already has a dedicated test —
`server/__tests__/gitDataDirIsolation.integration.test.ts` — so the check is simply that this test
is green, not a manual review.

**Gate:** **all 34 server test files green** under Vitest 4, **and** `npm run typecheck` green under
TS 6.

The 34 cover far more than the obvious: round-trips (`roundtrip`, `dbtRoundtrip`,
`dbtMetaRoundtrip`, `colorsRoundtrip`, `lineageRoundtrip`), git (`git`,
`gitDataDirIsolation.integration`, `isGitRepo.integration`, `prUrl`), every DDL exporter
(`oracleDdl`, `postgresDdl`, `exportDdl`, `sqlExport`, `xlsx`, `llmContext`), import
(`sqlImport`, `dbtImport`, `dbtImportRoute`, `routesImport`), projects and domains
(`projects`, `projectsRoutes`, `domains`, `domainRoutes`, `domainContext`, `pinnedProject`,
`files`, `filesActiveDomain`), and the control board. **This suite is the migration's insurance
policy — a red test here means stop, never adapt the assertion.**

---

### Stage 2 — domain core verbatim · 4,296 lines · risk: near zero

`src/dsl/` → `src/features/schema/model/`, with its tests. Also move the React-free leaves:
`src/layers.ts`, `src/exportWarnings.ts`, `src/projectMessages.ts`.

**Gate:** **all 20 `dsl` test files green** (`parseDbt`, `edit`, `reconcile`,
`reconcileCorruption.repro`, `validateModel`, `lineageFields`, `renameDetect`, `renameCrlf`,
`propagateKeyRename`, `rolenames`, `rolenameEdit`, `rolenameClassify`, `tableGroupMembership`,
`largeDiagram`, `blocks`, `colors`, `dbmlNotes`, `lineLocate`, `normalize`, `v4`); `npm run
typecheck` green; **zero React imports** under `src/features/schema/model/` — verify with
`grep -rE "from ['\"]react" src/features/schema/model/` returning nothing.

---

### Stage 3 — Infrastructure seam · ~500 lines

`src/api.ts` → `src/infrastructure/api/`, behind a narrow module surface. `src/store/interaction.ts`
→ `src/features/schema/store/`, converted from plain Zustand to Zustand + Immer slices.

This is the one early stage where a **structural change is intended** — the slice conversion. It is
small and it is the only exception to §3.1 before Stage 4.

**Gate:** `npm run typecheck` and `npm run test` green.

---

### Stage 4 — Canvas on `@xyflow/react` v12 · ~6,200 lines · the first real work

Rebuild `src/features/canvas/` against v12 and the design system. The table node implements the
Level-of-Detail system in [`identity.md`](../../identity.md) §7 (Sigil / Keys / Full). Edges follow
§7's edge language: FK solid with crow's foot, lineage dashed and animated.

**Port verbatim into `features/canvas/utils/`** — these are pure geometry with no React:
`autolayout.ts` (753 lines, dagre), `nodeMetrics.ts`, `pageFilter.ts`, `columnHandleGeometry.ts`,
`focusTableView.ts`, `edgeFocus.ts`, `defaultTablePosition.ts`, `scaleLimits.ts`,
`lineageHandles.ts`.

**These helpers already have 12 test files** in `src/canvas/__tests__/` — `autolayout` (414 lines),
`pageFilter`, `nodeMetrics`, `columnHandleGeometry`, `focusTableView`, `edgeFocus`,
`lineageHandles`, `defaultTablePosition`, `focusColumn`, `statusLabel`, `pagesPanelState`,
`useVirtualWindow`. They port with the helpers and must stay green. Those tests are what make Stage
4 a rebuild of the *rendering* only, not of the geometry.

**Gate:** all 12 canvas test files green; loading the LocalDrawDB sample DBML produces the same
table count, the same edge count and the same edge endpoints.

---

### Stage 5 — Shell, panels, command palette · ~3,800 lines

`App.tsx` decomposed into the canvas-first layout from [`identity.md`](../../identity.md) §6: slim
navbar, icon rail + schema tree, full-bleed canvas, right inspector, bottom DBML drawer, status bar.
**Target: `App.tsx` under 150 lines** — it composes, it does not orchestrate.

Panels rebuilt on shadcn: ColumnPanel, LayersPanel, ProblemsPanel, RecordsPanel, GitPanel,
DomainPicker, CredentialsWizard, StatusLog, TableInfoPopover, SelectionBar, DbmlDiff.

Command palette rebuilt with its action list taken from the parity inventory (§7).

**Gate:** every row of `docs/parity-inventory.md` marked verified.

---

### Stage 6 — Revalidation

**Gate:** all 9 exporters produce output byte-identical to the Stage 0c golden fixtures; the Windows
portable build (`npm run build:win`) completes; the bundled `examples/` still load.

---

## 7. Parity inventory

**The artifact that makes Stage 5 safe.** Produced in Stage 0b, before anything moves.

The reason it exists: **the command palette's action list is built inline inside `App.tsx`** — the
1,905-line file that Stage 5 deletes. `App.tsx` is simultaneously the largest risk in this migration
and the source of truth for what the product does. Extracting it first is not optional.

Derive it by **reading the source**, not from memory. Cover:

| Source | What to extract |
| --- | --- |
| `src/App.tsx` | every entry of the `actions` array passed to `buildCommands` — label, shortcut, effect |
| `src/help/gestures.ts` | `CANVAS_GESTURES` and everything `shortcutsFromCommands` produces |
| `src/canvas/actions.ts` | every method on the `CanvasActions` context |
| each panel component | every control and what it does |
| `server/exportDispatch.ts` | the 9 formats — `dbt`, `erwin`, `llm-context`, `localdrawdb`, `mermaid`, `oracle-ddl`, `postgres-ddl`, `spark-ddl`, `xlsx` — with each one's options and warnings |
| `src/domains/GitPanel.tsx` + `server/git.ts` | every git operation exposed to the user |
| `src/api.ts` | every server endpoint the client calls |

**Format:** a Markdown checklist table, one row per user-visible behaviour:

```
| # | Area | Behaviour | Source | Verified in Strata |
|---|------|-----------|--------|--------------------|
| 1 | Palette | "Add table" (⌘⇧A) creates a table at viewport centre | App.tsx:1421 | ☐ |
```

One row = one thing a user can do. Stage 5's gate is every box ticked.

---

## 8. Testing strategy

LocalDrawDB ships **83 test files**. That is the single biggest asset this migration has, and the
whole stage order exists to keep them green from the first commit.

| Location | Files | Fate |
| --- | --- | --- |
| `server/__tests__/` | **34** | Port verbatim (Stage 1). The insurance policy. |
| `src/dsl/__tests__/` | **20** | Port verbatim (Stage 2). |
| `src/canvas/__tests__/` | **12** | Port verbatim with the geometry helpers (Stage 4). |
| `src/domains`, `records`, `palette`, `help`, `components`, `hooks`, `editor` | **10** | Port where the logic survives; rewrite where they assert on removed UI. |
| `src/__tests__/` (root) | **7** | 5 port; `no-ui-emoji` and `typescale` are rewritten — see below. |

**Carries over unchanged — this is the migration's spine.** The 34 server + 20 dsl + 12 canvas
files. These are what make Stages 1, 2 and 4 safe, and they are the reason those stages are
ordered first.

**Must be rewritten.** `src/__tests__/no-ui-emoji.test.ts` and `src/__tests__/typescale.test.ts`
assert against the old hand-written style system. Port their *intent* to the new token system: no
emoji in UI strings, and type sizes drawn only from the `tailwind.config.ts` scale.

**New.** A golden-output test running all 9 exporters over the sample schema, diffing against the
Stage 0c fixtures. This is the objective parity gate — the one check that cannot be argued with.

**Not in this migration.** Cypress e2e. Structura has it; Strata adds it after parity.

---

## 9. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **`App.tsx` is the parity source of truth and Stage 5 deletes it.** | Inventory extracted and committed in Stage 0b, before anything moves. |
| 2 | **`reactflow` v11 → v12 breaks all 47 canvas files.** | Stage 4 is scoped as a rebuild, not an upgrade. Pure geometry moves verbatim with its tests. |
| 3 | **Verbatim code lands on TypeScript 6 strict** (from 5.6) and may not compile. | Stages 1 and 2 gates include `typecheck`. Rule: fix **types only**, never logic (§3.1). If a type fix would change behaviour, stop and report. |
| 4 | **Vitest 2 → 4 may break test files** that port verbatim. | Same rule: adapt test *harness* calls, never test *assertions*. A changed assertion is a lost guarantee. |
| 5 | **Golden fixtures must exist before LocalDrawDB is archived.** | Stage 0c, and it is independent so it can run first. |
| 6 | **The `data/` git-isolation fix (`5f40224`) is easy to lose in the port.** | Already covered by `gitDataDirIsolation.integration.test.ts`, which is inside the Stage 1 gate. No manual check needed. |
| 7 | **Agents "improving" ported code.** | §3.1. This is the single most likely way this migration silently breaks. |

---

## 10. What comes next

After Stage 6, in this order and each with its own spec:

1. dbt promoted to primary format (`strata-transition.md` §6).
2. The three backlog gaps (`identity.md` §12) — indexes needs its open question answered first.
3. `IStoragePort` (Phase 3), then the packageable module, then convergence into Structura.
