# Strata Transition — from LocalDrawDB to Strata

> **Context document, not a spec.** It explains *what* Strata should become and *why*, so specs and plans can be derived later. Scope: the transformation of the existing LocalDrawDB application into Strata. The future fusion with Structura is covered in [`convergence-and-platform-vision.md`](convergence-and-platform-vision.md).

## 1. Overview & goal

LocalDrawDB is a working, local-first modeler for databases and data lakehouses. It uses **DBML as its source of truth**, renders an interactive diagram, and exports to several targets. Strata keeps that essence but changes three big things:

1. **Identity & look** — a new name (Strata) and a new visual language (Catppuccin, dark-first) that no longer resembles dbdiagram.io.
2. **Primary functional format** — **dbt** becomes the first-class import/export target.
3. **Architecture readiness** — the codebase is re-shaped to mirror Structura's engine and contracts, so it can later be imported into the Structura platform (see doc 2).

Two capabilities must be **preserved and improved**, because they are already strengths:

- **Git-based project management** (LocalDrawDB is ahead of Structura here).
- **Local-first operation** (no database, no Docker required to run).

## 2. Name & identity

- **New name: `Strata`.** Retire the "LocalDrawDB" name across the product (wordmark, `package.json`, docs, window titles, build artifacts).
- The name evokes **strata / layers** — a natural fit for lakehouse **medallion layers (bronze / silver / gold)** and for a tool that helps you *structure* data. It also sits close in spirit to **Structura**, the platform it will join.
- **Logo direction:** stacked, offset layers (a "strata" mark).

## 3. What Strata is (product essence to preserve)

Carry forward LocalDrawDB's substance:

- **DBML as the editable source of truth** for the model.
- **Interactive canvas** (tables, columns, PK/FK, relationships with crow's-foot).
- **Lineage** (table-to-table and field-to-field) distinct from FK relationships.
- **Layers / medallion grouping** (bronze / silver / gold), table groups, colors.
- **Records / sample data** panels; **Problems** panel (model validation).
- **Undo/redo**, outline, command palette, search.
- **Multi-target export** (see §6 for the DBT-first reprioritization).

## 4. Visual identity — Catppuccin, dark-first

**Decided:** the palette is **Catppuccin** — **Macchiato** for dark mode (default), **Latte** for light mode (added later). **Mauve is the primary accent** (Catppuccin's signature, matching how the Catppuccin VSCode theme uses color).

Canonical role mapping (Catppuccin Macchiato hex):

| Role | Color | Hex |
| --- | --- | --- |
| Canvas / editor background | Base | `#24273a` |
| Navbar / sidebar / panels background | Mantle | `#1e2030` |
| Deepest wells / code gutter | Crust | `#181926` |
| Cards / nodes surface | Surface0 | `#363a4f` |
| Hover / separators / borders | Surface1 / Surface2 | `#494d64` / `#5b6078` |
| Primary text | Text | `#cad3f5` |
| Muted text | Subtext0 | `#a5adcb` |
| Faint text / delimiters | Overlay2 | `#939ab7` |
| **Primary accent** (logo, active item, primary button, focus) | **Mauve** | `#c6a0f6` |
| Links / tags / relationship lines | Blue | `#8aadf4` |
| Success / PK badge | Green | `#a6da95` |
| Warning | Yellow | `#eed49f` |
| Error / destructive | Red | `#ed8796` |

DBML **syntax highlighting** (per the Catppuccin style guide): keywords → Mauve; strings → Green; numbers/constants → Peach `#f5a97f`; types → Yellow; operators → Sky `#91d7e3`; braces/delimiters → Overlay2; comments → Overlay2 (italic); active line number → Lavender `#b7bdf8`.

**Typography:** Inter (UI sans) + JetBrains Mono (code, column names, data types). **Shape/depth:** `~0.5rem` radius, soft layered shadows, dotted-grid canvas, subtle accent glow.

> ⚠️ **Color/pixel polish is a separate, dedicated UX effort.** The images in `docs/assets/` are *exploratory* — they communicate **layout and direction**, not final colors. The palette (Catppuccin) is decided; the exact application will be refined in the dedicated UX pass.

## 5. UX & layout paradigm — a deliberate break from dbdiagram.io

The signature of dbdiagram.io is a **fixed split**: code editor on the left, diagram on the right. Strata abandons that. Target layout:

- **Slim top navbar** — logo + wordmark + breadcrumb (`Domain / project`), a command/search chip (`⌘K`), theme toggle, **Export** (dbt-forward), primary action, avatar.
- **Left sidebar** — an icon rail (tables, layers, lineage, code, search, settings) + a **Schema tree** (tables in monospace).
- **Full-bleed canvas** — dotted grid, table nodes as rounded cards with a mauve header accent, PK/FK badges, blue relationship lines.
- **Right inspector** — properties of the selected table/column (schema, columns, PK, FKs, color, indexes) in shadcn-style controls.
- **DBML lives in an on-demand slide-up bottom drawer** (`</> DBML`) with Format/Copy actions and full syntax highlighting. The DBML remains the source of truth; it simply stops being the primary surface. Day-to-day editing is **canvas-first**; you "drop to code" when you want. A full-screen "Source" mode may also be offered.

Exploratory references (layout/direction only — colors not final):

![Strata main page — exploratory Catppuccin Macchiato mockup](assets/mockup-main-macchiato.png)

![Strata with the DBML drawer open — exploratory mockup](assets/mockup-dbml-drawer.png)

## 6. DBT-first — the priority functional change

Today LocalDrawDB's "native" reimportable export is **SQL with metadata encoded in comment tags** (`@layer`, `@map`, etc.). Strata **reprioritizes to dbt**:

- **dbt becomes the primary, functional format** — get as close as possible to a real dbt project:
  - `models/**/*.sql`
  - `models/**/schema.yml` (columns, `data_type`, tests, and Strata metadata under `meta`: colors, layers, groups, PK, records, lineage)
  - `dbt_project.yml`
- **Round-trip** (import *and* export) with dbt should be a first-class, lossless-as-possible path.
- The legacy **SQL-with-commented-tags** format (and other exporters: Spark, Oracle, Postgres, erwin, Mermaid, PNG) becomes **secondary / compatibility**, not the center of gravity.
- Design the export layer so exporters are **pluggable** and match Structura's importer/exporter contracts (see doc 2), so the dbt path can later be contributed to Structura.

## 7. Git-based project management — keep and improve

This is where Strata (LocalDrawDB) is **ahead of Structura**, and it must not regress. Today LocalDrawDB supports git-backed domains/projects: clone a repo, switch/create branches, commit, push, and compute PR URLs, with data-dir isolation and self-healing registries.

Direction:

- **Preserve** the git-native project model (domains → projects, each versioned).
- **Improve** it: smoother branch/PR flows, model-aware diffs, conflict handling, clearer status, and safer data isolation.
- Treat it as a **future platform-level capability** — the convergence plan (doc 2) proposes git-native project management become a shared capability across the Structura platform, benefiting every future domain.

## 8. Tech-stack alignment targets (to ease convergence)

These change the stack toward Structura's so a future import is low-friction (details and rationale in doc 2):

- **Canvas:** migrate `reactflow` v11 → **`@xyflow/react` v12** (Structura's version).
- **Styling:** adopt **Tailwind CSS + shadcn/ui** with CSS-variable tokens; layer Catppuccin values on top of the shadcn token contract.
- **State:** **Zustand + Immer**, organized in **slices**.
- **Structure:** a **`features/`** layout with a **React-free domain core** (schema model: tables, columns, refs, lineage, groups) — mirror Structura's hard rule of "no React/JSX in the domain."
- **Tooling:** path alias `@/`, **Vitest**, shared ESLint/Prettier conventions, **i18n** (`en` / `pt-BR`).

## 9. Out of scope for now

- Final color micro-polish (dedicated UX effort).
- Any actual merge into Structura (mirror the contracts now; import later — see doc 2).
- SaaS / online multi-tenant concerns (local-first first).

## 10. Reference: current LocalDrawDB stack

React 18 + Vite + TypeScript, Zustand, `reactflow` v11, a **Fastify** server with **filesystem persistence** (`data/` → domains/projects) and **git integration**, hand-written CSS (`src/styles.css`), CodeMirror DBML editor, exporters (dbt/Spark/Oracle/Postgres/erwin/Mermaid/PNG), and a Windows portable build. Preserve capability; modernize form.
