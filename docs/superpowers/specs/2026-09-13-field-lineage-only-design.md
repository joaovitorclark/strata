# Field lineage only — design

**Date:** 2026-09-13
**Status:** approved in conversation, awaiting review of this document.
**Governs:** `docs/ux-direction.md` §6.1, which it closes.

---

## 1. Decision

Strata has **one** kind of lineage: **field → field mappings** (`lineageFields`).

Table → table lineage (`lineage` block, `lin:` edges, lineage ports, the `@origen` annotation) is
**removed from the model, the canvas, the importers and the exporters**. It is not hidden, not
migrated, not kept as dormant data.

> **A table has lineage if and only if at least one of its fields is mapped.** No mapped fields,
> no lineage.

Wherever a consumer needs "which table feeds which", it is **derived** from the field mappings.

Why this is safe to do now: every model in the current data directories is an example and can be
regenerated. There is no user data to preserve.

## 2. What the user sees

### 2.1 Zoom decides the granularity

For every ordered pair *(source table → target table)* that has at least one field mapping:

| Both nodes' LOD | Rendered |
| --- | --- |
| both `full` | one `fieldLineage` edge per mapping, column to column (today's edge) |
| either `keys` or `sigil` | **one aggregated edge**, table to table, labelled with the count (`3 campos`) |

- The aggregated edge is **derived and read-only**: no delete control, not reconnectable. Hover
  lists the mappings it stands for.
- Selecting a table already forces `full` (`resolveLod`), so selecting both ends of an aggregate
  opens it into its field edges. No new rule.
- Visibility, with the single **Linhagem** toggle on:
  - aggregated edges are **always shown** — they are the overview;
  - field edges keep today's rule — shown in lineage mode, or under focus / selected column.

LOD is per node, so the aggregate-versus-fields choice is per pair, taken from the two nodes'
resolved LOD. It must read the same `resolveLod` the node paints with, including pins and selection.

### 2.2 Controls

- `lineageVisible` and `fieldLineageVisible` collapse into **one** state, `lineageVisible`, shown as
  one **Linhagem** toggle in the layers panel.
- **Modo linhagem** stays, and means *creation*: in it, column rows expose the `fl:` handles.

### 2.3 Creating a mapping

In lineage mode, at `full` LOD, every column row renders `fl:s:<col>` (right) and `fl:t:<col>`
(left) handles. Dragging from `fl:s:` to `fl:t:` creates a mapping.

- `isValidConnection` in lineage mode accepts **only** `fl:s:` → `fl:t:`.
- `onConnect` in lineage mode calls `onCreateFieldLineage` and nothing else.
- This fixes parity row 68, which is the reason the gesture never worked.

**Mounting owner:** `ColumnRow.tsx` renders the handles; the task that adds them also carries the
Cypress gate proving a drag produces the DBML change (§5). The receiving logic in `Canvas.tsx`
already exists — the gate is on the *producer*.

## 3. What is removed

| Layer | Removed |
| --- | --- |
| DBML model | `Lineage {}` block: `parseLineageBlock`, `ParsedLineage`, `parsed.lineage`, its entry in `CUSTOM_TYPES` and `organize.ts`, add/remove edits in `edit.ts`, its checks in `validateModel.ts` and `exportWarnings.ts` |
| Canvas | `LineagePorts.tsx`, `lin:` edges in `useCanvasEdges`, `pickLineageHandles` and `DEFAULT_LINEAGE_*` if nothing else uses them, `onCreateLineage` / `onRemoveLineage`, port CSS in `Canvas.tsx` and `edgeClasses.css` |
| Store | `fieldLineageVisible` and its toggle (merged into `lineageVisible`) |
| Inspector | "Sources (linhagem)" as a table-level list — replaced by upstream tables derived from mappings |
| Server model | `LineageEntry`, `model.lineage` in `server/model.ts`, `dbmlIo.ts` read/write |
| SQL import | `@origen` annotation and `validateLineage`'s table branch; `mergeLineageEntries` |
| dbt import | building `lineage` from `ref()` / `source()` (`dbtImport.ts` ~307–333 and ~403–418) |

Existing DBML that still contains a `Lineage {}` block: the block is treated as unknown text and
**dropped on the next save**. No warning — there is no data to protect (§1).

## 4. What is derived

One pure function in `features/schema/model/` (no React), with its own test:

```ts
tableLineageFrom(fields: ParsedFieldLineage[]): { target: string; sources: string[] }[]
```

The server needs the same shape from its `FieldLineageEntry[]`; it gets its own equivalent in
`server/`, because the server does not import from `src/`.

Consumers switched to the derived value, with **unchanged behaviour when mappings cover the same
pairs**:

1. `autolayout.ts` — degree and layering (six reads of `parsed.lineage`)
2. `pageFilter.ts`
3. `useWorkspace.ts` (591, 599, 1097)
4. `useCanvasEdges.ts` — aggregated edges (§2.1)
5. `dbtExport.ts` `upstreams()` — `ref()` / `source()` from derived sources, refs still the fallback
6. `sqlExport.ts` `lineageSourcesForTable()`
7. `mermaid.ts` — if it draws table lineage, from derived sources

## 5. Verification

Per AGENTS.md: a mutation is verified by the DBML it changes; gates are counted.

**Unit (Vitest)**

- `tableLineageFrom`: empty; one mapping; several mappings same pair collapse to one source;
  several sources for one target; self-mapping excluded.
- Parser: a `Lineage {}` block no longer appears in the parsed model and does not break parsing.
- Edge builder: for a pair with 3 mappings — both `full` → 3 `fieldLineage` edges, 0 aggregated;
  one side `keys` → 0 field edges, 1 aggregated with count 3; one side `sigil` → same.
- `dbtExport`: a model whose mappings come from two upstream tables emits two `ref()` CTEs.
- `dbtImport`: a project with `ref()` and no field `meta` yields **zero** lineage; a project with
  field `meta` yields exactly those mappings.
- Round-trip golden fixtures (`dbtRoundtrip`, `dbtMetaRoundtrip`, `lineageRoundtrip`) regenerated
  without table lineage, and the diff reviewed by hand before committing.

**Cypress**

- Drag `fl:s:` → `fl:t:` in lineage mode → the `lineageFields` block in the DBML gains exactly that
  line. With a guard spec that breaks the gesture and confirms the test fails.
- Outside lineage mode, no `fl:` handle is in the DOM.
- Zoom out below `LOD_SIGIL_BELOW` → aggregated edge present with the count; zoom in above
  `LOD_FULL_ABOVE` and select → field edges present.
- Dragging port to port (the old L1 gesture) creates nothing: DBML unchanged.

**Removal sweep** — before closing, each of these returns no hit outside tests of the removal:
`parsed.lineage`, `model.lineage`, `ParsedLineage`, `LineageEntry`, `LineagePorts`, `lin:`,
`onCreateLineage`, `onRemoveLineage`, `fieldLineageVisible`, `@origen`. Count: 10.

## 6. Data

- Regenerate the example models (Cypress fixture data and the working copy used to run the app) so
  every lineage they show is field-mapped. Table-only lineage in them is deleted, not converted.
- `docs/parity-inventory.md`: rows about table lineage become `dropped — superseded by field-only
  lineage (this spec)`. Row 68 becomes `☑` with the Cypress spec above.
- `docs/ux-direction.md` §6.1 is marked closed with a link here; `docs/identity.md` edge table
  loses the table-lineage variant and gains the aggregated edge.

## 7. Out of scope

- **Inferring field mappings from dbt `ref()` and column names** — next spec. Until then a dbt
  project imports with only the lineage its `schema.yml` `meta` carries.
- The floating chrome, the Liam-style node, tree-click navigation, focus highlighting — the general
  UX work in `ux-direction.md` §2–§3.
- Any change to foreign-key relations.
