# Strata — Visual Identity & Design System

> **Status: reference example.** The `design-system/` folder is a worked reference — tokens, config
> and mark that the real app should adopt, not a package it imports yet. Treat the values as
> decided and the file layout as provisional until the app is scaffolded.
>
> **Theme names are `dark` and `light`,** never the Catppuccin flavour names. Macchiato and Latte
> are where the values come from; they are not user-facing vocabulary and must not appear in the UI.

> Implementation spec. Tokens live in [`design-system/globals.css`](../design-system/globals.css),
> Tailwind wiring in [`design-system/tailwind.config.ts`](../design-system/tailwind.config.ts).
> Context comes from [`strata-transition.md`](strata-transition.md) and
> [`convergence-and-platform-vision.md`](convergence-and-platform-vision.md).

---

## 1. Principles

1. **The canvas is the product.** DBML stays the source of truth, but it lives in a drawer you
   summon. No permanent split pane. Nothing about the layout should let anyone compare Strata to
   dbdiagram.io.
2. **Design for the 200-column table.** A lakehouse bronze table is not a five-row card. Every node
   decision is made against a real worst case, not a demo schema. This is the system's centre of
   gravity — see §7.
3. **Colour is never the only carrier.** Every badge has a text label, every layer has a name, every
   edge type has a distinct line *behaviour*. This is what makes the light flavour accessible and
   what makes a dense diagram readable.
4. **Cozy, not black.** Catppuccin's whole point: soft contrast, tinted neutrals, nothing at
   `#000`. Dense but comfortable.
5. **Additive, never forked.** Token names match Structura exactly. Strata-only concepts are new
   names alongside, never redefinitions.

---

## 2. Logo & wordmark

Three offset strata, read top-down: the layer you are working in is solid, the ones beneath recede
(`opacity 1 / .72 / .45`). It reads as sediment, as a stack of medallion layers, and as the letter
group in *Strata* — and it survives at 16px, which the icon rail requires.

- [`strata-mark.svg`](../design-system/assets/strata-mark.svg) — 32×32 square mark.
- [`strata-wordmark.svg`](../design-system/assets/strata-wordmark.svg) — horizontal lockup.

The mark inherits `currentColor`; set `color: hsl(var(--primary))` so it resolves to Latte mauve
`#8839ef` or Macchiato mauve `#c6a0f6` automatically. Wordmark is Inter 600 at `-0.02em`. Minimum
clear space on all sides equals the height of one stratum.

---

## 3. Colour

**Catppuccin — Latte for light, Macchiato for dark (default). Mauve is the primary accent.**

Values are taken verbatim from `catppuccin/palette@main`. `globals.css` declares the raw ramp as
`--ctp-*` and every semantic token resolves through it, so `.dark` only has to redefine 26 raw
values and the whole system re-tunes.

### Role map

| Role | Token | Latte | Macchiato |
| --- | --- | --- | --- |
| Canvas / editor ground | `--background` | base `#eff1f5` | base `#24273a` |
| Panels, table nodes | `--card`, `--sidebar-background` | mantle `#e6e9ef` | mantle `#1e2030` |
| Node header, raised strips, hover | `--surface` / `--surface-hover` | surface0 / surface1 | surface0 `#363a4f` / surface1 |
| Deepest wells, code gutter | `--ctp-crust` | `#dce0e8` | `#181926` |
| Primary text | `--foreground` | text `#4c4f69` | text `#cad3f5` |
| Muted text | `--muted-foreground` | subtext1 `#5c5f77` | subtext0 `#a5adcb` |
| **Primary accent** | `--primary`, `--ring` | **mauve `#8839ef`** | **mauve `#c6a0f6`** |
| Borders / separators | `--border`, `--input` | surface1 | surface0 |
| Success, PK | `--success`, `--key-pk` | green `#40a02b` | green `#a6da95` |
| Warning | `--warning` | yellow `#df8e1d` | yellow `#eed49f` |
| Destructive | `--destructive` | red `#d20f39` | red `#ed8796` |

Note the inversion that matters: **the canvas is lighter than the panels around it** in both
flavours (base sits above mantle). Table nodes are `--card` — *darker* than the canvas — so they
read as inlaid into the surface rather than as floating SaaS cards. That single decision does most
of the work of not looking like an ERD tool.

### Strata domain tokens (additive)

| Group | Tokens | Purpose |
| --- | --- | --- |
| Medallion layers | `--layer-bronze` (peach), `--layer-silver` (lavender/subtext0), `--layer-gold` (yellow), `--layer-raw` (overlay1) | Left edge of each node; layer chips; band tints |
| Edge semantics | `--rel-fk` (blue), `--rel-lineage` (teal), `--rel-active` (mauve), `--rel-muted` | Lineage must never read as a foreign key |
| Key badges | `--key-pk`, `--key-fk`, `--key-unique`, `--key-index`, `--key-pin` | Column markers |
| DBML syntax | `--syn-keyword` (mauve), `--syn-string` (green), `--syn-number` (peach), `--syn-type` (yellow), `--syn-operator` (sky), `--syn-punct`, `--syn-comment`, `--syn-line-active`, `--syn-gutter` | Per the Catppuccin style guide |

### Accessibility — measured, not assumed

Contrast ratios computed against each flavour's `--background`:

**Macchiato passes throughout.** text 9.92:1 · subtext0 6.62 · mauve 6.84 · blue 6.57 · green 9.17 ·
teal 8.74 · red 5.96 · overlay2 5.29. Crust on mauve (primary button) 8.09.

**Latte needed two corrections and one hard rule:**

1. `--muted-foreground` is **subtext1** (5.53:1), not subtext0 — subtext0 measures 4.37:1 and misses
   AA for normal text. Same swap for `--syn-comment` / `--syn-punct` (overlay2 is only 3.49:1).
2. `--primary-foreground` is base on mauve: 4.79:1 ✓.
3. **Latte's accent hues are marks, not text.** green 2.96:1, yellow 2.31, peach 2.64, teal 3.31,
   sapphire 2.78 — none are usable as small text on a light ground, and no darker Catppuccin member
   exists to swap in. So in light mode these colours only ever appear as **fills, dots, borders and
   edges**, and every one of them is paired with a text label or glyph (Principle 3). A PK badge is
   a green-tinted chip with the letters `PK` in `--foreground`, not green text. This satisfies
   WCAG 1.4.1 (use of colour) and keeps the palette exactly Catppuccin.

Where a light-mode mark still falls under 3:1 for non-text contrast (gold layer at 2.31), the layer
name is always rendered beside it, so the colour is redundant information.

---

## 4. Typography

| Role | Face | Size | Weight |
| --- | --- | --- | --- |
| Wordmark, empty-state titles | Inter | 24px | 600, `-0.02em` |
| Page / panel titles | Inter | 20 / 16px | 600 |
| Body, controls, tree | Inter | 14 / 13px | 400–500 |
| Column names, table names, DBML | **JetBrains Mono** | 12px | 400–500 |
| Column types, badges, counts | JetBrains Mono | 11px | 400 |

Ligatures are **off** in mono (`font-variant-ligatures: none`) — column names are identifiers to be
read exactly, not code to be prettified. Counts and numeric columns use `font-variant-numeric:
tabular-nums` so they align down a list.

Every table and column name is monospace, everywhere — canvas, tree, inspector, palette, drawer.
That consistency is how you scan a 200-table model.

---

## 5. Space, radius, elevation

- **Spacing scale** 4px base: `2 4 6 8 12 16 24 32 48`.
- **Radius** `--radius: 0.5rem`. Nodes and panels `lg`; buttons and inputs `md`; badges and chips
  `sm`. Nothing is a pill except the layer chip.
- **Elevation** six steps, all tinted with the flavour's own `crust` — never neutral black, which
  would break the cozy feel. `--shadow-glow` is the focus/selection halo and is the only shadow
  carrying the accent.
- **Node row heights** are tokens (`--row-compact: 22px`, `--row-cozy: 28px`) because the density
  toggle is a first-class control, not a preference buried in settings.

---

## 6. Layout paradigm

```
┌──────────────────────────────────────────────────────────────────┐
│ ◆ Strata   Local / vendas          [⌘K Search]  ☾  Export dbt  ● │  slim navbar
├────┬────────────────┬───────────────────────────┬────────────────┤
│ ▤  │  SCHEMA        │                           │  Properties    │
│ ▥  │   ▸ loja       │      full-bleed canvas    │   Table        │
│ ⑂  │     pedido     │      dotted grid          │   Columns  187 │  inspector
│ </>│     cliente    │      nodes + edges        │   Primary key  │
│ ⌕  │     produto    │                           │   Layer        │
│ ⚙  │                │                           │                │
├────┴────────────────┴───────────────────────────┴────────────────┤
│ ✓ Problems  0 issues    </> DBML ▲    Show source     ⊟ 100% ⊞ ⛶ │  status bar
└──────────────────────────────────────────────────────────────────┘
```

- **Navbar** — mark + wordmark, breadcrumb `Domain / project`, `⌘K` chip, theme toggle, Export with
  the `dbt` format called out, primary action, avatar.
- **Sidebar** — icon rail (tables, layers, lineage, code, search, settings) plus the Schema tree in
  monospace. Collapsible to the rail alone.
- **Canvas** — full bleed, dotted grid (`.strata-canvas`), subtle accent glow on selection.
- **Inspector** — right, properties of the selected table or column. Closable.
- **DBML drawer** — bottom, on demand (`</> DBML`), Format / Copy, full syntax highlighting, active
  line in lavender. A full-screen Source mode is also available.
- **Status bar** — Problems count, drawer handle, zoom. Always visible; this is where "saving /
  saved / error" lands.

---

## 7. The table node — Level of Detail

**The defining component.** A schema modeler is only as good as its behaviour when a table has 187
columns, and this is where Strata separates from every ERD tool.

### Three states

| State | Trigger | Height | Content |
| --- | --- | --- | --- |
| **Sigil** | zoom < 55%, or manual collapse | 34px | layer edge · table name · column count · relation count |
| **Keys** | zoom 55–110% *(default)* | ~150px | PK, every FK, pinned columns, then `+N more columns` |
| **Full** | zoom > 110%, or on select | ≤ 420px | virtualised list, sticky header, in-node filter, section groups |

The state is driven by zoom by default and can be pinned per node. Edges attach to the **node body**
in Sigil and to the **column handle** in Keys/Full, so relationships never dangle.

### Supporting mechanics

- **Pinned columns.** PK and FK auto-pin. `⌘click` any column to pin it; pins survive in Keys view
  and round-trip into dbt `schema.yml` under `meta.strata.pinned`.
- **In-node filter.** At Full, a filter field appears in the node header. Typing `_at` narrows 187
  columns to the 12 timestamps without leaving the canvas.
- **Edge peek.** Hovering a relationship surfaces *only* the participating columns on both endpoints
  and dims the rest — you never scroll a 187-row node hunting for the FK.
- **Sections.** Columns group by `meta.strata.group` (or by name prefix), collapsible, so a wide
  table reads as five sections instead of one wall.
- **Honest overflow.** Nothing is ever silently clipped. Hidden columns are always a real, counted,
  clickable `+187 more columns` control.
- **Density.** Compact (22px rows) / Cozy (28px rows), toggled from the status bar.

### Anatomy

```
┌─┬────────────────────────────────┐
│ │ ▤ bronze.raw_events    ⋯       │   header: --surface, mono name
│ ├────────────────────────────────┤
│ │ ◉ event_id      bigint    PK   │   PK: green dot + "PK" chip
│ │ ○ customer_id   bigint    FK   │   FK: blue ring + "FK" chip
│ │ ⚲ ingested_at   timestamp      │   pinned: mauve pin glyph
│ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│ │ + 184 more columns             │   real control, never a fade
└─┴────────────────────────────────┘
 ↑ 3px left edge in --layer-bronze
```

The **left edge** carries the medallion layer — bronze / silver / gold / raw. It is 3px, full
height, and always accompanied by the layer name in the header tooltip and the inspector.

### Edge language

| Kind | Colour | Line | Terminal |
| --- | --- | --- | --- |
| Foreign key | `--rel-fk` (blue) | solid, 1.5px, orthogonal | crow's foot |
| Lineage | `--rel-lineage` (teal) | dashed, animated flow | tapered arrow |
| Active trace | `--rel-active` (mauve) | solid, 2.5px | arrow + glow |

Lineage animates; foreign keys never do. That behavioural difference is legible even at a zoom where
colour has stopped being distinguishable.

---

## 8. States

| State | Treatment |
| --- | --- |
| Hover | `--surface-hover` fill; 120ms; no lift on rows, 1px lift on nodes |
| Active / selected | 1px `--primary` border + `--shadow-glow`; the schema-tree row also fills `--sidebar-accent` |
| Focus | `2px solid hsl(var(--ring))` at `2px` offset — never removed, visible on every control |
| Disabled | `opacity: .45`, `cursor: default`, no hover response |
| Invalid | `--destructive` border + the Problems count increments; never a bare red glow with no explanation |
| Saving / saved | status bar text, `--muted-foreground` → `--success`; never a blocking spinner |

---

## 9. Motion

Motion answers an action; it does not decorate. Timing function `cubic-bezier(0.2, 0.8, 0.2, 1)`.

- Node LOD transitions: 180ms height + opacity.
- DBML drawer: 180ms slide up.
- `node-settle`: 220ms, when a node changes because the DBML was edited — shows *what* changed.
- `lineage-flow`: the only looping animation in the product, and it encodes direction of data flow.
- Everything collapses under `prefers-reduced-motion: reduce`, already handled in `globals.css`.

---

## 10. Iconography

Lucide, 16px in the rail and inline, 1.5px stroke, `--muted-foreground` at rest and `--foreground`
or `--primary` when active. Table / layer / lineage / code / search / settings in the rail. No
emoji anywhere in the UI.

---

## 11. Convergence checklist

- [x] Token **names** identical to Structura's `src/index.css` (shadcn set, sidebar set, `--surface`,
      `--surface-hover`, `--success`, `--warning`, `--grid-line`, shadow scale).
- [x] HSL channel-triplet format, `darkMode: ["class"]`, `prefix: ""`.
- [x] Colours resolved as `hsl(var(--token))` in `tailwind.config.ts`.
- [x] Strata-only tokens are new names, never redefinitions.
- [ ] Vendor Structura's `components.json` + `components/ui` when the app is scaffolded.
- [ ] Pin shared dependency versions (React, Vite, Zustand, Immer, `@xyflow/react` v12, Tailwind).

**One deliberate deviation:** shadcn's `--accent` is the neutral hover wash for menu and list items,
not the brand accent. Structura sets `--accent: --primary` in dark, which tints every menu hover.
Strata keeps them separate (`--accent: surface0`) so hover states stay readable. Brand accent is
always `--primary`. Flag this when merging.

---

## 12. Backlog — known gaps, not designed yet

Raised in review, deliberately deferred. None of these are blocked; they are simply not drawn yet.

### 12.1 Indexes as a first-class column marker

The node today marks only PK, FK and pinned. **Tables also carry indexes**, which are neither. The
`--key-index` and `--key-unique` tokens already exist in `globals.css` and are unused. Indexes need:
a marker in the column row, a badge (`IX` / `UQ`), a place in the inspector, and a decision about
whether a multi-column index renders as a group or as a mark repeated per column.

> **Open question to confirm before designing:** the review note read *"índices … basicamente quer
> dizer que uma tabela X lê da tabela Y."* Two readings are possible — (a) indexes are purely a
> physical column property and the read-relationship is a separate lineage concern, or (b) an index
> is being used to express a read dependency between tables that Strata should draw as an edge.
> These produce very different designs. Confirm which before drawing anything.

### 12.2 TableGroups

Only medallion **LayerGroups** (bronze / silver / gold) are designed. DBML's `TableGroup` — an
orthogonal grouping that maps onto dbt folder structure — has no visual treatment yet. It needs a
container on the canvas that does **not** compete with the layer edge already on every node, and it
must survive the Level-of-Detail states in §7. Likely a soft bounded region with a pinned label,
collapsible to a single group node.

### 12.3 Git diff in the bottom drawer

The drawer is currently DBML only. It should be **tabbed: `</> DBML` | `⑂ Diff`**, where Diff shows
the working-tree change against the current branch. This is not a nice-to-have — git-native project
management is Strata's one genuine advantage over Structura (see
[`strata-transition.md`](strata-transition.md) §7), and putting the diff beside the source is what
makes that advantage visible during editing rather than buried in a panel.

Design notes: the diff should be **model-aware**, not just textual — "3 columns added to
`vendas.pedido`, 1 table renamed" above the raw hunks — because a textual DBML diff of a rename is
unreadable. Reuse `--success` / `--destructive` at low alpha for added/removed lines, and the
existing syntax tokens inside unchanged text.

