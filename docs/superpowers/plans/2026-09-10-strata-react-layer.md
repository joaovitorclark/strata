# Strata Migration — React Layer (Stages 4–6) Implementation Plan

> **For agentic workers (Cursor / Grok / Composer):** Tasks are grouped into **waves**. Every task
> in a wave is independent of its siblings and may run in a separate agent. A wave does not start
> until every task in the previous wave is green. Read `## Global Constraints` before every task.
>
> **Every task owns named areas of [`docs/parity-inventory.md`](../../parity-inventory.md)** and is
> gated on them. All 260 rows are assigned; none is assigned twice.

**Goal:** Rebuild LocalDrawDB's React layer in Strata on `@xyflow/react` v12 and the Catppuccin
token system, reaching verified feature parity.

**Architecture:** The canvas divides in two. 2,191 lines of geometry, graph-building and layout logic
— most of it covered by 12 test files — are **ported** with a small, precisely-scoped v12 patch.
2,020 lines of presentation are **rebuilt** against the design system, plus `src/editor/` (519).
The presentation rebuild never touches the geometry.

**Tech Stack:** `@xyflow/react` 12.10.1, React 18, Tailwind + shadcn/ui, Zustand + Immer, CodeMirror,
Vitest 4.

**Spec:** [`../specs/2026-09-10-strata-react-layer-design.md`](../specs/2026-09-10-strata-react-layer-design.md)

**Prerequisite:** Plan 1 (`2026-09-10-strata-migration-foundation.md`) complete, all exit criteria met.

---

## Global Constraints

Everything in Plan 1's Global Constraints still applies. **Read that section too.** These are
additional and specific to this plan.

**§3 of the spec is required reading.** LocalDrawDB already implements column virtualisation,
scroll-aware edge anchoring, and a compact node mode. **Rebuilding any of them is a defect, not a
style choice.** Spec §5.1 names every file that must be ported rather than written.

**The verbatim rule still holds, with one narrow exemption.** Files in spec §5.1 are ported. The
only permitted edits are Plan 1's three (imports, TS 6 types, Prettier) **plus** the seven specific
v12 changes enumerated in spec §4. Nothing else. In particular: do not "modernise" `autolayout.ts`,
do not reformat `columnHandleGeometry.ts`'s maths, do not rename `TableNodeData`.

**Ported tests are the gate and are never edited.** The 12 canvas test files come across unchanged.
A red one means the port is wrong. Only a Vitest 2 → 4 harness API change is permitted and each must
be listed in the task report.

**Every colour comes from tokens.** No hex literal may appear in a component. If you need a colour
that `design-system/globals.css` does not define, stop and report. The old `TABLE_COLORS` palette in
`actions.ts` is the previous client's brand palette and is replaced in Task 11 — never copy it
forward.

**Node heights must agree with `nodeMetrics`.** `autolayout` positions nodes using
`nodeMetrics.nodeHeight()`. If a node renders at a height that function did not predict, layout
collides. Any change to rendered height changes `nodeHeight` in the same task.

**`CanvasActions` is a contract, not a suggestion.** All 18 members must survive with their exact
names and signatures. It is consumed by deep nodes through context; renaming a member breaks call
sites you cannot see from your task.

**Do not delete `App.tsx` before Task 26.** It is the parity reference until the inventory is fully
checked.

---

## The `CanvasActions` contract

Reproduced here because five separate tasks implement against it and an agent sees only its own task.

```ts
export type TableMeta = {
  sources: string[];
  sample: { columns: string[]; rows: string[][] } | null;
  pks: string[];
  fks: { column: string; ref: string }[];
  refsIn: string[];
  note?: string;
  columnNotes: { column: string; note: string }[];
  resourceType?: "model" | "source" | "seed" | "snapshot";
  materialization?: "table" | "view" | "incremental" | "ephemeral";
  tags?: string[];
  has: boolean;
};

export type CanvasActions = {
  onSelectColumn: (table: string, column: string) => void;
  onRenameColumn: (table: string, oldName: string, newName: string) => void;
  onGoToColumn?: (table: string, column: string) => void;
  onRenameTable: (tableId: string, newName: string) => void;
  onRemoveTable: (tableId: string) => void;
  onAddColumn: (table: string) => void;
  colorOf: (tableId: string) => string | undefined;
  onSetColor: (tableId: string, color: string | null) => void;
  onSetGroupColor: (group: string, color: string | null) => void;
  onResizeTable: (tableId: string, width: number, height?: number) => void;
  layerOf: (tableId: string) => string | undefined;
  layerColorOf: (layerId?: string) => string | undefined;
  onSetLayer: (tableId: string, layerId: string | null) => void;
  layers: Layer[];
  onAddLayer: (name: string, color: string) => void;
  onToggleGroup: (name: string) => void;
  tableMeta: (tableId: string) => TableMeta;
};

export type ExternalLinkBadge = {
  stubId: string;
  label: string;
  count: number;
  direction: "out" | "in";
};

export type TableNodeData = TableView & {
  headerColor: string;
  meta: TableMeta;
  externalLinks?: ExternalLinkBadge[];
  linkedColumns?: string[];
};
```

---

## Wave E — prerequisite, 1 agent

### Task 11: Reconcile density tokens and replace the legacy table palette

Two conflicts between the design system and the code, both of which must be settled before any node
renders. Small task, but everything downstream depends on the numbers being right.

**Files:**
- Modify: `design-system/globals.css`, `docs/identity.md` (§5 and §7)
- Create: `src/features/canvas/tableColors.ts`

**Interfaces:**
- Produces: `--row-cozy: 25px`, `--row-compact: 21px`; `TABLE_COLORS` exported from
  `@/features/canvas/tableColors` as Catppuccin values. Consumed by Tasks 13, 21.

- [ ] **Step 1: Change the density tokens to match the code**

In `design-system/globals.css` and `src/index.css`:

```css
--row-compact: 1.3125rem;  /* 21px */
--row-cozy: 1.5625rem;     /* 25px — matches COLUMN_VIRTUAL_ROW_H */
```

The code wins here, not the design system. `COLUMN_VIRTUAL_ROW_H = 25` is depended on by
`nodeMetrics`, `columnHandleGeometry`, `autolayout` and 12 canvas test files. Moving the constant to
28 to satisfy a token would shift every layout expectation in that suite for a cosmetic 3px.

- [ ] **Step 2: Update the spec so it stops disagreeing with itself**

In `docs/identity.md` §5, change the row-height line to read 25px cozy / 21px compact, and add:
"these match `COLUMN_VIRTUAL_ROW_H` in `scaleLimits.ts`; the constant is the source of truth."

In `docs/identity.md` §7, update the Full state's height from 420px to the real figure:
`34 header + 14 × 25 rows + 26 footer = 410px`.

- [ ] **Step 3: Replace the legacy table palette**

`$LDB/src/canvas/actions.ts` ends with `TABLE_COLORS` — twelve hex values (`#13284b`, `#00995d`, …)
that are the **previous client's brand palette**. They must not come forward.

`src/features/canvas/tableColors.ts`:

```ts
/**
 * Header colours offered in the table colour picker. Catppuccin hues, in the
 * order the picker shows them. Values are the Macchiato variants: a saved
 * project stores the literal hex, so these are written out rather than read
 * from tokens, and existing projects keep whatever hex they already hold.
 */
export const TABLE_COLORS = [
  "#c6a0f6", // mauve
  "#8aadf4", // blue
  "#a6da95", // green
  "#eed49f", // yellow
  "#f5a97f", // peach
  "#ed8796", // red
  "#8bd5ca", // teal
  "#91d7e3", // sky
  "#b7bdf8", // lavender
  "#f5bde6", // pink
  "#ee99a0", // maroon
  "#939ab7", // overlay2
] as const;

export type TableColor = (typeof TABLE_COLORS)[number];
```

Saved projects hold their old hex values and will keep rendering them — only the picker's options
change. That is intentional; do not migrate stored colours.

- [ ] **Step 4: Verify**

Run: `npm run test && npm run build`
Expected: PASS.

Run: `grep -n "13284b\|00995d\|1c3a6b" src/ -r`
Expected: prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(design): align density tokens to COLUMN_VIRTUAL_ROW_H and replace legacy table palette"
```

---

## Wave F — geometry, 1 agent

This wave is alone because everything in Waves G and H imports from it.

### Task 12: Install xyflow v12 and port the geometry layer

1,613 lines, 12 test files, all of which must be green at the end. This is the highest-value task in
the plan: it moves the hard, correct, tested maths without redesigning it.

**Files:**
- Create: `src/features/canvas/utils/{autolayout,pageFilter,columnHandleGeometry,focusTableView,nodeMetrics,lineageHandles,edgeFocus,scaleLimits,defaultTablePosition,pagesPanelState,statusLabel}.ts`
- Create: `src/features/canvas/hooks/{useVirtualWindow,useColumnEdgeCoords,useCanvasNodes,useCanvasEdges}.ts`
- Create: `src/features/canvas/store/tableScrollStore.ts`
- Create: `src/features/canvas/actions.ts`
- Create: `src/features/canvas/__tests__/**` (12 files, from `$LDB/src/canvas/__tests__/`)
- Modify: `.prettierignore`

**Interfaces:**
- Produces: `computeVirtualWindow`, `columnAnchorY`, `columnHandleFlowPoint`, `sidePortFlowPoint`,
  `needsScrollAwareHandles`, `tableBodyHeight`, `columnScrollViewport`,
  `parseRelationColumnHandle`, `parseFieldLineageColumnHandle`, `nodeWidth`, `nodeHeight`,
  `autolayoutPositions`, `autolayoutLineagePositions`, `useColumnEdgeCoords`, `useTableScrollStore`,
  the `scaleLimits` constants, and the `CanvasActions` / `TableNodeData` / `TableMeta` /
  `ExternalLinkBadge` types plus `CanvasActionsCtx` and `useCanvasActions`.
  Consumed by every task in Waves G and H.

- [ ] **Step 1: Install**

```bash
npm i @xyflow/react@12.10.1
npm i dagre@^0.8.5 && npm i -D @types/dagre@^0.7.54
```

- [ ] **Step 2: Copy the 12 test files first**

```bash
mkdir -p src/features/canvas/__tests__
cp $LDB/src/canvas/__tests__/*.test.ts src/features/canvas/__tests__/
```

Rewrite their relative imports to `@/features/canvas/...`. Change nothing else in them.

**Three of the twelve need more than a path rewrite.** Handle them exactly as follows and list what
you did in the task report.

**`pagesPanelState.test.ts` and `statusLabel.test.ts` do not test geometry.** They import
`parsePagesCollapsed` from `LayersPanel.tsx:24` and `statusLabel` from `StatusLog.tsx:18` — two
`export function` declarations that happen to live inside component files this task does not build.

Extract both into `src/features/canvas/utils/` as part of this task:

```
$LDB/src/canvas/LayersPanel.tsx :: parsePagesCollapsed  →  src/features/canvas/utils/pagesPanelState.ts
$LDB/src/canvas/StatusLog.tsx   :: statusLabel          →  src/features/canvas/utils/statusLabel.ts
```

Copy the function bodies **verbatim** — this is a move, not a rewrite. Then point the two tests at
the new paths.

This is the right home regardless of the gate: they are pure functions with pure tests, and pure
logic does not live inside a React component under this repo's `features/` discipline. Tasks 23 and
24 import them from `utils/` rather than redefining them, which also removes a dependency those
tasks did not know they had.

**`focusColumn.test.ts` imports `useInteraction` from `../../store/interaction`.** Plan 1 renamed
that store to `useSchemaStore` at `@/features/schema/store`, keeping LocalDrawDB's member names.
Alias it **at the import site** so the test body stays byte-identical:

```ts
import { useSchemaStore as useInteraction } from "@/features/schema/store";
```

Do **not** re-export `useInteraction` from the store. Plan 1's Decision 12 settled that the store
has one public name; a re-export would reintroduce the two-vocabularies problem that decision
removed. The alias is local to this file and public to nothing.

**General rule, it will recur in Tasks 22–24:** when a ported test imports a module Plan 1 renamed,
alias it at the import line. Never rename inside the test body, and never add a compatibility
re-export to the source module.

- [ ] **Step 3: Run to verify they fail**

Run: `npm run test -- src/features/canvas`
Expected: FAIL — 12 files with unresolved imports. If any passes, they are not running; stop.

- [ ] **Step 4: Copy the geometry files**

```bash
mkdir -p src/features/canvas/{utils,hooks,store}
cd $LDB/src/canvas
cp autolayout.ts pageFilter.ts columnHandleGeometry.ts focusTableView.ts nodeMetrics.ts \
   lineageHandles.ts edgeFocus.ts scaleLimits.ts defaultTablePosition.ts \
   $STRATA/src/features/canvas/utils/
# NOTE: useColumnEdgeCoords.ts lives at the canvas root in LocalDrawDB, not under
# hooks/. The other three are under hooks/. Destination is hooks/ for all four —
# they are all hooks; only LocalDrawDB's filing was inconsistent.
cp hooks/useVirtualWindow.ts hooks/useCanvasNodes.ts hooks/useCanvasEdges.ts \
   $STRATA/src/features/canvas/hooks/
cp useColumnEdgeCoords.ts $STRATA/src/features/canvas/hooks/
cp tableScrollStore.ts $STRATA/src/features/canvas/store/
cp actions.ts $STRATA/src/features/canvas/
```

**`useCanvasNodes.ts` (197) and `useCanvasEdges.ts` (381) are ports, not rebuilds.** They build the
React Flow node and edge arrays from the parsed model, and `useCanvasEdges` carries a performance
optimisation that is invisible until it is gone: its header reads *"rebuild estrutural separado do
highlight (Fase 3 perf)"*, and `mergeEdgeState` preserves edge object identity across rebuilds so
hovering does not re-render every edge on the canvas. Rewriting these two by hand produces a canvas
that looks correct and is slow, with no test to catch it.

One coupling to hand forward: `useCanvasEdges` calls `edgeClassForTier` from `edgeFocus.ts`, which
returns CSS class names from the old stylesheet. Port it unchanged and **report the class names it
emits** — Task 14 must provide token-based equivalents under those exact names.

- [ ] **Step 4b: Extend `.prettierignore` before running any gate**

`src/features/canvas/` is about to receive verbatim ports, and `npm run format:check` is an exit
criterion. Add, under the existing "Ignorado ATÉ o fim do Stage 6" section:

```
src/features/canvas/utils/
src/features/canvas/hooks/
src/features/canvas/store/
src/features/canvas/actions.ts
src/features/canvas/__tests__/
```

Note what is **not** listed: `src/features/canvas/components/`. That directory holds the rebuilt
presentation from Tasks 13–16, which is new code and must stay formatted.

This gap was found auditing the plan, not by hitting it — Wave D lost a cycle to exactly this when
the ported server tree met an unfiltered `prettier --check .`.

- [ ] **Step 5: Apply the v12 patch — and only this patch**

Seven changes, exactly as spec §4 enumerates. Nothing else in these files may be edited.

**5a — package name, everywhere:** `from "reactflow"` → `from "@xyflow/react"`.

**5b — `actions.ts`:** delete only the `TABLE_COLORS` constant (it moved to
`@/features/canvas/tableColors` in Task 11). **Leave `TableNodeData` exactly as it is.**

Do **not** add `& Record<string, unknown>` to it. That instruction appeared in an earlier draft of
this plan and was wrong on both counts, verified by compiling against `@xyflow/react@12.10.1` with
TypeScript 6:

- It is **unnecessary.** `Node<NodeData extends Record<string, unknown>>` is satisfied by any type
  *alias* through TypeScript's implicit index signature, and `TableView` and `TableNodeData` are
  both aliases. `InternalNode<Node<TableNodeData>>` compiles clean without it.
- It is **harmful.** Intersecting with `Record<string, unknown>` gives `data` a catch-all index
  signature, so `node.data.nmae` type-checks silently. The probe confirmed it: with the
  intersection the typo compiled; without it, `TS2339: Property 'nmae' does not exist`. `data` is
  the most-accessed object in the whole canvas — do not disable typo detection on it.

If a v12 constraint error does appear here, **stop and report it** rather than reaching for the
intersection.

**5c — `columnHandleGeometry.ts`:** the two flow-point functions take an `InternalNode`, per spec
§4.1. Change only these two signatures and the two property reads inside them.

```ts
import type { InternalNode, Node } from "@xyflow/react";

export function sidePortFlowPoint(
  node: InternalNode<Node<TableNodeData>>,
  side: "source" | "target",
): { x: number; y: number; kind: ColumnAnchorKind } {
  const { center } = columnScrollViewport(node.data);
  const origin = node.internals.positionAbsolute;
  const w = node.measured?.width ?? nodeWidth(node.data) ?? 230;
  const xLocal = side === "source" ? w : 0;
  const yLocal = clampLocalY(node.data, center);
  return { x: origin.x + xLocal, y: origin.y + yLocal, kind: "row" };
}

export function columnHandleFlowPoint(
  node: InternalNode<Node<TableNodeData>>,
  columnName: string,
  side: "source" | "target",
  scrollTop: number,
): { x: number; y: number; kind: ColumnAnchorKind } | null {
  const anchor = columnAnchorY(node.data, columnName, scrollTop);
  if (!anchor) return null;
  const origin = node.internals.positionAbsolute;
  const w = node.measured?.width ?? nodeWidth(node.data) ?? 230;
  const xLocal = side === "source" ? w : 0;
  return { x: origin.x + xLocal, y: origin.y + anchor.y, kind: anchor.kind };
}
```

`columnAnchorY`, `clampLocalY`, `tableBodyHeight`, `columnScrollViewport`,
`needsScrollAwareHandles` and both handle parsers are **unchanged** — they take `data`, not a node.

**5d — `useColumnEdgeCoords.ts` lines 48–49:** v12 replaces the `nodeInternals` store slice with a
dedicated hook.

```ts
import { useInternalNode } from "@xyflow/react";
// ...
const sourceNode = useInternalNode<Node<TableNodeData>>(source);
const targetNode = useInternalNode<Node<TableNodeData>>(target);
```

Delete the now-unused `useStore` import. The `useMemo` body and its dependency array are unchanged.

**5e — `focusTableView.ts` lines 12, 13, 67:** `node.width` → `node.measured?.width`,
`node.height` → `node.measured?.height`. The `?? 0` and `?? bounds.height` fallbacks stay.

**5f — TS 6 type errors** and **5g — Prettier**, per Plan 1's rules.

- [ ] **Step 6: Run the suite**

Run: `npm run test -- src/features/canvas`
Expected: PASS — **all 12 test files green**: `autolayout`, `pageFilter`, `nodeMetrics`,
`columnHandleGeometry`, `focusTableView`, `edgeFocus`, `lineageHandles`, `defaultTablePosition`,
`focusColumn`, `statusLabel`, `pagesPanelState`, `useVirtualWindow`.

`autolayout.test.ts` is 414 lines and is the one that proves the dagre layout survived. If it is
red, the port is wrong — do not touch the test.

- [ ] **Step 7: Prove no stray reactflow references remain**

Run: `grep -rn "from ['\"]reactflow" src/ ; grep -rn "nodeInternals\|positionAbsolute\b" src/features/canvas/`
Expected: the first prints nothing; the second prints only `internals.positionAbsolute` lines.

- [ ] **Step 8: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/features/canvas package.json package-lock.json
git commit -m "feat(canvas): port the geometry layer to @xyflow/react v12"
```

---

## Wave G — presentation, 3 agents in parallel

All three import from Task 12 and none from each other.

### Task 13: The table node and its Level-of-Detail body

The signature component. Spec §3.4 is required reading: **Sigil and Full already exist as
mechanisms** — this task gives them a zoom trigger and a token skin, and builds Keys, which is new.

**Files:**
- Create: `src/features/canvas/components/TableNode.tsx`,
  `src/features/canvas/components/TableColumnList.tsx`,
  `src/features/canvas/components/ColumnRow.tsx`,
  `src/features/canvas/utils/lod.ts`,
  `src/features/canvas/__tests__/lod.test.ts`

**Interfaces:**
- Consumes: `TableNodeData`, `useCanvasActions`, `computeVirtualWindow`, `nodeHeight`,
  `scaleLimits` constants, `TABLE_COLORS`.
- Produces: `TableNode` (registered as node type `"table"` by Task 16); `resolveLod(zoom, opts)` and
  the `LodState` type from `@/features/canvas/utils/lod`; `lodHeight(data, state)`.

- [ ] **Step 1: Write the failing LOD test**

`src/features/canvas/__tests__/lod.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveLod } from "@/features/canvas/utils/lod";

describe("resolveLod", () => {
  it("collapses to a sigil when zoomed out", () => {
    expect(resolveLod(0.4, {})).toBe("sigil");
  });

  it("shows keys at normal zoom", () => {
    expect(resolveLod(1, {})).toBe("keys");
    expect(resolveLod(0.55, {})).toBe("keys");
    expect(resolveLod(1.1, {})).toBe("keys");
  });

  it("opens fully past the threshold", () => {
    expect(resolveLod(1.3, {})).toBe("full");
  });

  it("lets a pinned state override the zoom", () => {
    expect(resolveLod(0.4, { pinned: "full" })).toBe("full");
    expect(resolveLod(1.5, { pinned: "sigil" })).toBe("sigil");
  });

  it("opens the selected node early", () => {
    expect(resolveLod(1, { selected: true })).toBe("full");
  });
});

describe("keyColumns", () => {
  const data = {
    columns: [{ name: "id" }, { name: "cliente_id" }, { name: "total_brl" }, { name: "nota" }],
    meta: { pks: ["id"], fks: [{ column: "cliente_id", ref: "vendas.cliente.id" }] },
  } as never;

  it("keeps primary and foreign keys with no pins", () => {
    expect(keyColumns(data).map((c) => c.name)).toEqual(["id", "cliente_id"]);
  });

  it("adds pinned columns without duplicating keys", () => {
    expect(keyColumns(data, ["total_brl", "id"]).map((c) => c.name)).toEqual([
      "id",
      "cliente_id",
      "total_brl",
    ]);
  });
});
```

Add `keyColumns` to the import at the top of the test file.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/features/canvas/__tests__/lod.test.ts`
Expected: FAIL — unresolved module.

- [ ] **Step 3: Write `utils/lod.ts`**

```ts
import {
  COLUMN_VIRTUAL_ROW_H,
  COLUMN_VIRTUAL_VIEW_ROWS,
} from "@/features/canvas/utils/scaleLimits";
import type { TableNodeData } from "@/features/canvas/actions";
import { TABLE_HEADER_H, TABLE_FOOTER_H } from "@/features/canvas/utils/columnHandleGeometry";

export type LodState = "sigil" | "keys" | "full";

export const LOD_SIGIL_BELOW = 0.55;
export const LOD_FULL_ABOVE = 1.1;

/** Height of the sigil card — header only, no column body. */
export const SIGIL_H = 34;

export function resolveLod(
  zoom: number,
  opts: { pinned?: LodState; selected?: boolean },
): LodState {
  if (opts.pinned) return opts.pinned;
  if (zoom < LOD_SIGIL_BELOW) return "sigil";
  if (opts.selected) return "full";
  return zoom > LOD_FULL_ABOVE ? "full" : "keys";
}

/**
 * Columns the Keys state shows: primary keys, every foreign key, then any the
 * user pinned.
 *
 * Pins arrive as a parameter rather than a field on the column, because pinning
 * is user state that lives in the store (Task 17), not in the parsed model. This
 * function must stay pure — `lodHeight` calls it, and `autolayout` calls that.
 * Task 17 passes real pins; until then callers pass none.
 */
export function keyColumns(
  data: TableNodeData,
  pinned: readonly string[] = [],
): TableNodeData["columns"] {
  const keep = new Set<string>([
    ...(data.meta.pks ?? []),
    ...(data.meta.fks ?? []).map((f) => f.column),
    ...pinned,
  ]);
  return data.columns.filter((c) => keep.has(c.name));
}

/**
 * Rendered height per state. `autolayout` positions nodes from this, so it must
 * agree with what TableColumnList actually paints — see Global Constraints.
 */
export function lodHeight(
  data: TableNodeData,
  state: LodState,
  pinned: readonly string[] = [],
): number {
  if (state === "sigil") return SIGIL_H;
  const shown = state === "keys" ? keyColumns(data, pinned).length : data.columns.length;
  const rows =
    state === "keys"
      ? shown + (data.columns.length > shown ? 1 : 0) // +1 for the "+N more" control
      : Math.min(data.columns.length, COLUMN_VIRTUAL_VIEW_ROWS);
  return TABLE_HEADER_H + rows * COLUMN_VIRTUAL_ROW_H + TABLE_FOOTER_H;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- src/features/canvas/__tests__/lod.test.ts`
Expected: PASS — 7 tests (5 for `resolveLod`, 2 for `keyColumns`).

- [ ] **Step 5: Teach `nodeMetrics` about the LOD state**

`nodeHeight` currently takes `{ compact?, layout? }`. Add `state?: LodState`, and when it is given,
return `lodHeight(data, state)` plus the existing `LAYOUT_SAFETY` when `opts.layout` is set. Leave
every other branch of that function untouched — `autolayout.test.ts` covers them.

- [ ] **Step 6: Build the three states**

`TableColumnList.tsx` renders by state:

- **sigil** — nothing; the header carries `{columns.length} cols · {rel} rel`.
- **keys** — `keyColumns(data)` as `ColumnRow`s, then, when columns are hidden, a real
  `<button>` reading `+ {n} more columns`. Never a fade, never a truncation.
- **full** — `computeVirtualWindow` over the whole column list exactly as
  `$LDB/src/canvas/TableColumnList.tsx` does it today, with a filter input in the header. Read that
  file and keep its virtualisation and its scroll reporting to `useTableScrollStore` — edge
  anchoring depends on that scroll position being published.

`ColumnRow.tsx` renders one column: key dot (`--key-pk` filled / `--key-fk` ring / `--key-pin`),
name in `font-mono text-xs`, type in `text-2xs text-muted-foreground`, and a lettered badge (`PK`,
`FK`, `UQ`) whose text colour is `--foreground` — per `identity.md` §3, colour never carries meaning
alone.

`TableNode.tsx` composes: a 3px left edge in the layer colour (`--layer-bronze|silver|gold|raw`),
the header (`--surface` background, mono table name, `⋯` menu), and the body.

- [ ] **Step 7: Verify composite primary keys survive the Keys state**

`TableView` carries `compositePks?: string[][]` **separately from** `ColumnView.pk: boolean`
(verified in `$LDB/src/dsl/parse.ts:32-55`). A column that is part of a composite key may therefore
have `pk: false` and appear only in `compositePks`.

`keyColumns` reads `data.meta.pks`. **Whether `meta.pks` already flattens composites is unverified**,
and the golden fixture's sample schema has no composite key — so this path has no test coverage
anywhere in the migration.

Check how `meta.pks` is built (`$LDB/src/App.tsx`, the `tableMeta` implementation). Then write this
test with whatever the answer is:

```ts
it("surfaces every column of a composite primary key", () => {
  const data = {
    columns: [{ name: "dia" }, { name: "regiao" }, { name: "receita_brl" }],
    compositePks: [["dia", "regiao"]],
    meta: { pks: [], fks: [] },
  } as never;
  expect(keyColumns(data).map((c) => c.name)).toEqual(["dia", "regiao"]);
});
```

If it fails, `keyColumns` must union `data.compositePks?.flat() ?? []` into its `keep` set. Report
which of the two it turned out to be — a lakehouse gold table keyed on `(day, region)` is exactly
the shape this product exists for, and a Keys state that hides half its key is a real defect.

- [ ] **Step 8: Verify heights agree with layout**

Run: `npm run test -- src/features/canvas`
Expected: PASS — all 13 files (the 12 ported plus `lod`). A red `autolayout.test.ts` means Step 5
changed a branch it should not have.

- [ ] **Step 9: Commit**

```bash
git add src/features/canvas && git commit -m "feat(canvas): table node with zoom-driven level of detail"
```

---

### Task 14: Edges

Three edge types plus markers, on tokens. Spec §5.2. The behavioural rule from `identity.md` §7:
**lineage animates, foreign keys never do** — that difference must survive at a zoom where hue does
not.

**Files:**
- Create: `src/features/canvas/components/{RelationEdge,LineageEdge,FieldLineageEdge,EdgeMarkers}.tsx`

**Interfaces:**
- Consumes: `useColumnEdgeCoords`, `parseRelationColumnHandle`, `parseFieldLineageColumnHandle`,
  `edgeFocus` helpers.
- Produces: the three components, registered as edge types `"relation"`, `"lineage"`,
  `"fieldLineage"` by Task 16.

- [ ] **Step 1: Read the originals**

`$LDB/src/canvas/RelationEdge.tsx` (110), `LineageEdge.tsx` (53), `FieldLineageEdge.tsx` (87),
`EdgeMarkers.tsx` (44). Keep their path maths and their `useColumnEdgeCoords` wiring. What changes
is colour, stroke and marker styling.

- [ ] **Step 2: Apply the edge language**

| Type | Stroke | Width | Animation | Terminal |
| --- | --- | --- | --- | --- |
| `relation` (FK) | `hsl(var(--rel-fk))` | 1.5 | none, ever | crow's foot |
| `lineage` | `hsl(var(--rel-lineage))` | 1.8, `linecap=round` | `animate-lineage-flow` | tapered arrow |
| `fieldLineage` | `hsl(var(--rel-lineage))` | 1.4, dashed | `animate-lineage-flow` | tapered arrow |
| any, focused | `hsl(var(--rel-active))` | +1 | as above | as above + glow |

The `lineage-flow` keyframe already exists in `tailwind.config.ts` and is already wrapped in
`prefers-reduced-motion` by `globals.css`.

- [ ] **Step 3: Verify**

Run: `npm run test -- src/features/canvas && npm run build`
Expected: PASS.

Run: `grep -nE "#[0-9a-fA-F]{6}" src/features/canvas/components/*Edge*.tsx src/features/canvas/components/EdgeMarkers.tsx`
Expected: prints nothing — no hex literals in components.

- [ ] **Step 4: Commit**

```bash
git add src/features/canvas && git commit -m "feat(canvas): edge language — FK solid, lineage flowing"
```

---

### Task 15: Group nodes and lineage ports

**Files:**
- Create: `src/features/canvas/components/{GroupNode,ExternalGroupNode,LineagePorts}.tsx`

**Interfaces:**
- Consumes: `useCanvasActions` (`onToggleGroup`, `onSetGroupColor`, `layerColorOf`),
  `lineageHandles`.
- Produces: node types `"group"` and `"externalGroup"` for Task 16.

- [ ] **Step 1: Port the structure, restyle the surface**

Read `$LDB/src/canvas/GroupNode.tsx` (115), `ExternalGroupNode.tsx` (39), `LineagePorts.tsx` (30).
Keep their behaviour. Restyle: group container gets a dashed 1px border in the layer colour at 45 %
alpha over a 5 % fill, and its label sits in a `--card` chip pinned to the top-left corner, outside
the border.

**This is the medallion LayerGroup container only.** DBML `TableGroup` rendering is explicitly out of
scope (`identity.md` §12.2) — if the original code paths handle both, port both, but design nothing
new for TableGroup.

- [ ] **Step 2: Verify**

Run: `npm run test -- src/features/canvas && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/canvas && git commit -m "feat(canvas): group and external-group nodes"
```

---

## Wave H — canvas shell, sequential

### Task 16: The canvas shell on v12

**Files:**
- Create: `src/features/canvas/components/Canvas.tsx`, `src/features/canvas/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 12–15.
- Produces: `<Canvas />` and the `nodeTypes` / `edgeTypes` maps.

- [ ] **Step 1: Read the original**

`$LDB/src/canvas/Canvas.tsx`, 621 lines. It registers:

```ts
const nodeTypes = { table: TableNode, group: GroupNode, externalGroup: ExternalGroupNode };
const edgeTypes = { relation: RelationEdge, lineage: LineageEdge, fieldLineage: FieldLineageEdge };
```

Both maps must be module-level constants — defining them inside the component remounts every node on
every render.

- [ ] **Step 2: Rebuild on v12**

Import `"@xyflow/react/dist/style.css"`. Wire the dotted grid through the `.strata-canvas` class
from `globals.css` rather than React Flow's `<Background />`, so the grid colour follows
`--grid-line` in both themes.

Honour the existing scale thresholds from `scaleLimits.ts`: hide the minimap above
`MINIMAP_MAX_TABLES`, skip the first-frame `fitView` above `SKIP_INITIAL_FIT_TABLES`.

- [ ] **Step 3: Feed zoom to the LOD**

Read the viewport zoom and pass it to nodes so `resolveLod` can use it. Read it with a selector, not
by subscribing whole nodes to viewport changes — every node re-rendering on every pan is the
performance bug this canvas exists to avoid.

- [ ] **Step 4: Verify against the sample schema**

Load `fixtures/golden/sample.dbml`. Assert the same table count and edge count LocalDrawDB produces,
and that edge endpoints land within 1px of the ported geometry's output.

- [ ] **Step 5: Run and commit**

Run: `npm run test && npm run build`

```bash
git add src/features/canvas && git commit -m "feat(canvas): React Flow v12 shell"
```

---

### Task 17: Pinning, in-node filter, edge peek

The three genuinely new behaviours from `identity.md` §7. Everything else in the LOD system was a
port; this is new work and gets its own task and its own tests.

**Files:**
- Create: `src/features/canvas/store/lodSlice.ts`,
  `src/features/canvas/__tests__/lodSlice.test.ts`
- Modify: `src/features/canvas/components/{TableNode,TableColumnList}.tsx`

**Interfaces:**
- Consumes: the schema store from Plan 1's Task 10.
- Produces: `pinColumn`, `unpinColumn`, `pinnedColumns(tableId)`, `setNodeLod`, `peekEdge` on the
  store.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useSchemaStore } from "@/features/schema/store";

describe("lod slice", () => {
  beforeEach(() => useSchemaStore.setState(useSchemaStore.getInitialState(), true));

  it("pins and unpins a column", () => {
    const s = () => useSchemaStore.getState();
    s().pinColumn("vendas.pedido", "total_brl");
    expect(s().pinnedColumns("vendas.pedido")).toEqual(["total_brl"]);
    s().unpinColumn("vendas.pedido", "total_brl");
    expect(s().pinnedColumns("vendas.pedido")).toEqual([]);
  });

  it("pins a per-node LOD state that survives zoom", () => {
    useSchemaStore.getState().setNodeLod("vendas.pedido", "full");
    expect(useSchemaStore.getState().nodeLod["vendas.pedido"]).toBe("full");
  });

  it("records which edge is being peeked", () => {
    useSchemaStore.getState().peekEdge("e1");
    expect(useSchemaStore.getState().peekedEdge).toBe("e1");
    useSchemaStore.getState().peekEdge(null);
    expect(useSchemaStore.getState().peekedEdge).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/features/canvas/__tests__/lodSlice.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the slice, following Task 10's pattern**

Same `StateCreator` + immer shape Plan 1's Task 10 established. Compose it into `useSchemaStore`
beside the interaction slice.

- [ ] **Step 4: Wire the three behaviours**

**Pinning** — `⌘click` a column row toggles its pin. Pinned columns appear in Keys.
**In-node filter** — at Full, a filter input in the node header narrows the list; it filters the
array `computeVirtualWindow` runs over, so virtualisation still applies to the filtered set.
**Edge peek** — hovering an edge sets `peekedEdge`; both endpoint nodes surface only the
participating columns and every other node drops to `opacity: .34`.

- [ ] **Step 5: Persist pins to dbt metadata**

Pins round-trip through `meta.strata.pinned` in `schema.yml` (`identity.md` §7). The server already
round-trips `meta` — `dbtMetaRoundtrip.test.ts` in Plan 1's Task 7 covers that path. Add the field;
do not change the round-trip mechanism.

- [ ] **Step 6: Run and commit**

Run: `npm run test && npm run build`

```bash
git add -A && git commit -m "feat(canvas): column pinning, in-node filter, and edge peek"
```

---

## Wave I — shell, then panels in parallel

### Task 18: Application shell skeleton

**Files:**
- Create: `src/features/shell/AppShell.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `<AppShell>` with named slots `navbar`, `rail`, `tree`, `canvas`, `inspector`,
  `drawer`, `statusbar`. Tasks 19–22 fill slots and must not change the grid.

- [ ] **Step 1: Build the grid**

Per `identity.md` §6: `grid-template-rows: auto 1fr auto`, middle row
`grid-template-columns: 46px 176px 1fr auto`. The tree and inspector are collapsible; the canvas is
never less than `1fr`.

- [ ] **Step 2: Add the theme controller**

Reads the stored preference, falls back to `dark`, toggles the `.dark` class on
`document.documentElement`. **Dark is the default** — `identity.md` is dark-first.

- [ ] **Step 3: Reduce `App.tsx` to composition**

```tsx
import { AppShell } from "@/features/shell/AppShell";

export default function App() {
  return <AppShell />;
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run build && npm run test`

```bash
git add -A && git commit -m "feat(shell): application grid and theme controller"
```

---

### Tasks 19–22 — parallel, one agent each

Each fills a slot in Task 18's grid and touches no other slot.

**Every task below owns named areas of `docs/parity-inventory.md` and is gated on them.** The
inventory is the contract; do not copy its rows into your code comments, and do not mark a row
checked until you have exercised the behaviour. Row counts are from the committed inventory (260
rows total).

| Task | Inventory areas | Rows |
| --- | --- | --- |
| 19 | `Shortcut`, `Export` | 8 + 10 = 18 |
| 20 | *(none — see below)* | 0 |
| 21 | `Panel:ColumnPanel`, `Panel:TableInfoPopover` | 12 + 1 = 13 |
| 22 | `Editor`, `Panel:DbmlDiff` | 26 + 2 = 28 |
| 23 | `Panel:LayersPanel`, `Panel:ProblemsPanel`, `Panel:SelectionBar` | 18 + 4 + 3 = 25 |
| 24 | `Panel:RecordsPanel`, `Panel:GitPanel`, `Git`, `Panel:DomainPicker`, `Panel:CredentialsWizard`, `Panel:StatusLog`, `Panel:PageImportWizard`, `Panel:ColumnMappings`, `Panel:ProjectSwitcher` | 5+9+11+11+5+2+4+8+7 = 62 |
| 25 | `Palette` | 30 |
| 13–17 | `Canvas` | 54 |
| 26 | `API` (verify Plan 1's seam covers them) | 30 |

**Task 20 is the only shell piece with no parity contract.** The schema tree does not exist in
LocalDrawDB — the equivalent is the editor's `Outline`, which Task 22 owns. Task 20 is new UI over
existing data, so its gate is behavioural, not inventory-based: it must render 500 tables without
dropping frames, and selecting a row must drive the same selection state the canvas reads.

**Task 19 — Navbar, IconRail, StatusBar.** Navbar: mark, breadcrumb `Domain / project`, `⌘K` chip,
theme toggle, `Export` with the `dbt` chip, primary action, avatar. Rail: tables, layers, lineage,
code, search, settings — `lucide-react`, 17px, 1.5 stroke. StatusBar: Problems count, DBML drawer
handle, zoom control, density toggle. Gate: `npm run build` and every control reachable by keyboard
with a visible focus ring.

**Task 20 — SchemaTree.** Monospace table list grouped by schema, a layer-coloured edge per row, the
column count right-aligned with `tabular-nums`, the selected row filled with `--sidebar-accent` and
a `--primary` left border. Must stay usable at 500 tables — virtualise with `computeVirtualWindow`
rather than a second implementation. Gate: renders 500 rows without dropping frames on scroll.

**Task 21 — Inspector.** Properties of the selected table or column, from `tableMeta(tableId)`:
table, layer chip, column count, primary key badges, foreign keys with their `→ table(column)`
targets, materialization, tags, and the colour picker fed by `TABLE_COLORS` from Task 11. Gate: every
field of the `TableMeta` type is displayed or explicitly listed in the task report as deliberately
omitted.

**Task 22 — SourceDrawer and the editor feature.** `$LDB/src/editor/` is 519 lines across 8 files
plus 2 test files, and an earlier draft of this plan named none of them. The whole directory moves
to `src/features/source/`, split by kind:

*Port verbatim (pure logic, 85 lines + 2 tests):* `dbmlFold.ts` (52 — CodeMirror folding ranges for
DBML blocks), `syncEditorCanvas.ts` (23 — the cursor↔canvas sync predicates, with
`syncEditorCanvas.test.ts`), `cursorLineExtension.ts` (10). `Outline.virtualize.test.tsx` comes
across with `Outline`.

*Rebuild on tokens (434 lines):*
- `Editor.tsx` (106) → the drawer body: CodeMirror, `Format` and `Copy`, slide-up via
  `animate-drawer-up`, active line in `--syn-line-active`. Highlighting maps to the `--syn-*` tokens
  per `identity.md` §3 — keyword mauve, string green, number peach, type yellow, operator sky,
  punctuation and comment via `--syn-punct` / `--syn-comment`.
- `Outline.tsx` (208) → **the largest file in the directory and a feature in its own right**: the
  DBML structure tree, virtualised. Reuse `computeVirtualWindow`; do not write a third
  virtualisation. Its existing test must stay green.
- `RenameConfirmModal.tsx` (34) → the rename-impact confirmation, driven by `model/reconcile.ts`.
  Small, and easy to drop silently — it is the flow that asks whether a column rename should
  propagate to child foreign keys, and losing it means renames corrupt models without asking.

Gate: every `--syn-*` token used at least once; `Outline.virtualize.test.tsx` and
`syncEditorCanvas.test.ts` green; the drawer opens and closes without shifting the canvas viewport;
a column rename with child FKs still raises the confirmation modal.

---

## Wave J — remaining panels, 2 agents in parallel

**Task 23 — ColumnPanel, LayersPanel, ProblemsPanel, SelectionBar, TableInfoPopover.** Port the
behaviour from `$LDB/src/canvas/` (272 + 262 + 115 + 69 + 66 lines) onto shadcn primitives. The
`useDraggablePanel` hook (67 lines) ports verbatim. Gate: every control listed for these panels in
`docs/parity-inventory.md` is present and checked off.

**Task 24 — RecordsPanel, GitPanel, DomainPicker, CredentialsWizard, StatusLog, PageImportWizard,
ColumnMappings, ProjectSwitcher.** 62 inventory rows — the largest task in the plan. Port from
`$LDB/src/records/`, `$LDB/src/domains/`, `$LDB/src/canvas/` and `$LDB/src/ProjectSwitcher.tsx`.

**`ProjectSwitcher` (7 rows) was absent from an earlier draft of this plan.** It lives at the repo
root, not under `canvas/` or `domains/`, which is how it was missed. It is not a trivial menu: it
carries project switch, rename and duplicate (both via prompt), delete (confirm, and **disabled when
only one project exists**), and a pinned-instance mode where only the pin label and rename control
render. Rows 177–183.

`GitPanel` is the sensitive one: branch, commit, push and PR-URL flows against `server/git.ts`, all
covered by tests ported in Plan 1's Task 7 — the panel is new UI over an unchanged API. **Never put
a credential in component state**; keep the existing flow in `CredentialsWizard` and `tokenUrl.ts`.

Gate: all 62 rows checked. Given the size, consider splitting this across two agents along the
`records/canvas` versus `domains/projects` line — the two halves share no state.

---

## Wave K — palette and cutover, sequential

### Task 25: Command palette and shortcuts overlay

`docs/parity-inventory.md` now exists (260 rows), and rows **1–30 (`Palette`)** plus **31–38
(`Shortcut`)** are this task's contract. Read them; the summary below is orientation, not a
substitute.

**Files:**
- Create: `src/features/command-palette/{CommandPalette,ShortcutsOverlay}.tsx`,
  `src/features/command-palette/registry.ts`, `src/features/command-palette/gestures.ts`,
  `src/features/command-palette/actions.ts`,
  `src/features/command-palette/__tests__/{registry,gestures}.test.ts`
- Modify: `src/i18n/locales/{pt-BR,en}.json`

**Interfaces:**
- Consumes: `useCanvasActions`, the schema store, `@/infrastructure/api` exporters.
- Produces: `<CommandPalette />`, `<ShortcutsOverlay />`, and `buildCommands(...)`.

- [ ] **Step 1: Port the registry and gestures verbatim**

`$LDB/src/palette/registry.ts` and `$LDB/src/help/gestures.ts` are pure logic and come across
unchanged, with `registry.test.ts` and `help.test.ts`. `registry.ts` carries accent-insensitive
matching via `normalizeText` (NFD + combining-mark strip) — a Portuguese-language product needs
"organizar" to match a typed "orgánizar", and rewriting that by hand loses it.

Gate: both ported tests green before you write any UI.

- [ ] **Step 2: Declare commands, do not hand-write them**

LocalDrawDB built the palette from an `actions` array written inline in `App.tsx` — ten of whose
entries differ only by an export format id. That is why the list was invisible to this plan until
the inventory extracted it, and why adding a format meant editing four places.

**Identifiers and canonical labels are English** (the repo convention: code and token names in
English). `en.json` is authored first as the source copy; `pt-BR.json` translates it. The inventory
quotes LocalDrawDB's Portuguese labels — those rows are **behaviour contracts, not string
contracts**. Row 17 is satisfied by a command that exports dbt, whether it reads "Exportar dbt" or
"Export dbt".

`src/features/command-palette/actions.ts`:

```ts
export type CommandDef = {
  /** Stable English id. Never translated; used in tests and telemetry. */
  id: string;
  labelKey: string;
  /** Toggles only: the label shown while active. */
  activeLabelKey?: string;
  shortcut?: string;
  kind: "action" | "toggle";
  run: (ctx: CommandContext) => void | Promise<void>;
};
```

**No command label may be a string literal in a component.** Every one resolves through
`t(labelKey)`.

- [ ] **Step 3: Derive the ten export commands from one exporter registry**

Rows 11–20 are ten commands over nine formats (`localdrawdb` appears twice, with dialect `spark` and
dialect `oracle`). Do **not** write ten entries. Write one registry and generate them:

```ts
export const EXPORTERS = [
  { id: "dbt", labelKey: "export.dbt", extension: "dbt" },
  { id: "spark-ddl", labelKey: "export.sparkDdl", extension: "sql" },
  { id: "oracle-ddl", labelKey: "export.oracleDdl", extension: "sql" },
  { id: "postgres-ddl", labelKey: "export.postgresDdl", extension: "sql" },
  { id: "erwin", labelKey: "export.erwin", extension: "xml" },
  { id: "mermaid", labelKey: "export.mermaid", extension: "mmd" },
  { id: "xlsx", labelKey: "export.xlsx", extension: "xlsx" },
  { id: "llm-context", labelKey: "export.llmContext", extension: "md" },
  { id: "localdrawdb", labelKey: "export.localdrawdbSpark", dialect: "spark" },
  { id: "localdrawdb", labelKey: "export.localdrawdbOracle", dialect: "oracle" },
] as const;
```

This registry has three jobs beyond the palette, which is why it earns its place:

1. **The navbar Export menu (Task 19) renders from it** — one list, not two that drift apart.
2. **The golden parity test (Task 27) iterates it** instead of hard-coding nine format ids.
3. **Its shape is deliberately Structura's `ExporterContribution`** (`id`, `label`, `extensions`,
   `export(...)`) — see `convergence-and-platform-vision.md` §4.5. Contributing Strata's exporters to
   the platform later becomes registration rather than a rewrite. This is the cheapest piece of
   convergence groundwork in the whole migration, and it costs nothing to do now.

Adding a tenth format later is one entry plus two locale keys.

- [ ] **Step 4: Build the remaining eleven commands — rows 8–10, 21–28**

| Rows | `id` | Notes |
| --- | --- | --- |
| 8 | `save` | ⌘S. Reconciles editor edits, then saves. **Blocked while the rename modal is open** (Task 22's `RenameConfirmModal`). |
| 9 | `organize-dbml` | Rewrites the document as tables → refs → records |
| 10 | `organize-canvas` | Autolayout (lineage stack when lineage mode is on), then fit view |
| 21 | `import-input` | Merges SQL from the project's `input/`; may open the page wizard |
| 22–23 | `undo`, `redo` | ⌘Z / ⌘⇧Z. Restores document **and** canvas snapshot |
| 24 | `toggle-autosave` | `kind: "toggle"` |
| 25 | `toggle-lineage-mode` | `kind: "toggle"` |
| 26–28 | `toggle-layers-panel`, `toggle-records-panel`, `toggle-problems-panel` | `kind: "toggle"` |

The five toggles are one `CommandDef` each with `labelKey` + `activeLabelKey` — not ten entries and
not ten special cases in the renderer.

- [ ] **Step 5: Build the palette UI — rows 1–7, 29–30**

shadcn `command` primitive. Opens from the navbar "Buscar" chip and from ⌘K. Filters tables, columns
and actions together, **capped at 12 results** (row 2). Arrow Up/Down moves the highlight, Enter
runs and closes, click runs and closes, Escape closes, click-outside closes.

Rows 29–30 are the navigation behaviours and each has three effects, all required: choosing a
**table** focuses it on the canvas, pans to it, *and* scrolls the DBML editor to its line; choosing a
**column** focuses the table, selects the column, *and* scrolls the editor to the column's line.

- [ ] **Step 6: Wire the eight global shortcuts — rows 31–38**

⌘S save · ⌘Z undo · ⌘⇧Z redo · ⌘K palette · Delete removes the selected ref · Escape clears
selection and closes modals · `?` toggles the shortcuts overlay · **⌘Y also redoes**.

Row 38 is the one to watch: ⌘Y is wired in `App.tsx` directly and is **not** produced by
`shortcutsFromCommands`, so porting the gestures registry alone will not carry it. The inventory
caught it precisely because it was extracted by reading `App.tsx`, not the registry.

- [ ] **Step 7: Build the shortcuts overlay**

`$LDB/src/help/ShortcutsOverlay.tsx`, opened by `?` (row 37). It renders `CANVAS_GESTURES` plus
whatever `shortcutsFromCommands` derives — so it stays correct as commands change. Add ⌘Y
explicitly, since it is not in either source.

- [ ] **Step 8: Verify**

Run: `npm run test && npm run build`

Then walk rows 1–38 of `docs/parity-inventory.md` and tick each one you have actually exercised.
Gate: **38 rows checked.** Report any row you could not verify and why.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(palette): command palette, global shortcuts, and gestures overlay"
```

### Task 26: Cutover

Delete `$LDB`-derived orchestration that is now dead, confirm `src/App.tsx` is under 150 lines, and
walk `docs/parity-inventory.md` end to end. Gate: **every row checked, or explicitly marked dropped
with a reason.** A dropped row is a decision someone can review; a missing row is a bug.

---

## Wave L — revalidation, 2 agents in parallel

**Task 27 — Golden export parity.** A test running all nine exporters over
`fixtures/golden/sample.dbml` and diffing against the fixtures Plan 1's Task 2 captured. Formats:
`dbt`, `erwin`, `llm-context`, `localdrawdb` (dialect `spark`), `mermaid`, `oracle-ddl`,
`postgres-ddl`, `spark-ddl`, `xlsx`. Gate: nine byte-identical comparisons. **A difference is a
regression until proven otherwise** — if one is intentional, justify it in the task report and
regenerate the fixture deliberately.

**Task 28 — Windows build and examples.** Run `npm run build:win` and confirm the portable artifact
runs. Load every file in `examples/`. Gate: both succeed.

---

## Plan exit criteria

- [ ] `npm run build`, `npm run test`, `npm run format:check` all green
- [ ] All 12 ported canvas test files green, plus `lod` and `lodSlice`
- [ ] `grep -rn "from ['\"]reactflow" src/` prints nothing
- [ ] `grep -rnE "#[0-9a-fA-F]{6}" src/features/ src/components/` prints nothing outside
      `tableColors.ts`
- [ ] `src/App.tsx` under 150 lines
- [ ] Every row of `docs/parity-inventory.md` checked or explicitly dropped with a reason
- [ ] Nine golden export comparisons byte-identical
- [ ] `npm run build:win` succeeds

---

## Wave summary

| Wave | Tasks | Agents | Blocked by |
| --- | --- | --- | --- |
| E | 11 | 1 | Plan 1 complete |
| F | 12 | 1 | 11 |
| G | 13, 14, 15 | 3 parallel | 12 |
| H | 16, then 17 | 1 sequential | 13, 14, 15 |
| I | 18, then 19–22 | 1, then 4 parallel | 17 |
| J | 23, 24 | 2 parallel | 18 |
| K | 25, then 26 | 1 sequential | 19–24 |
| L | 27, 28 | 2 parallel | 26 |
