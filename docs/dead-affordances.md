# Dead affordances

Survey of `src/features/` and `src/infrastructure/` (Wave W, Task 58). Report only — nothing here was fixed.

A dead affordance is something defined or handled on one side of a seam and never produced on the other. Tests do not count as consumers.

Checked and **not** dead (migration cases that later got wired):

- `LineagePorts` — mounted from `TableNode.tsx:133` when lineage mode or “Mostrar linhagem” is on.
- `removeSelectedRef` — passed into the palette as `useWorkspace.ts:1184` → `CommandPalette.tsx`.

Form **(c)** also found unused model helpers (`cleanDbml`, `allLayers`, `addLineage` / `removeLineage` / `lineageFromJson`, `filterParseResultByPage`, `isMiniMapLite`, `removeRolename`, `applyRenames`, `isBlockType`, `materializationForLayer` / `resourceTypeForLayer`, and the `exportDdl` / `exportPng` / … wrappers around `exportFormat`). Those are dead **code**, not buttons the UI shows. They are omitted below so this list stays something the UX rework can plan against.

---

## (a) Identifier consumed with no producer

- **`fl:` field handles.** Exists: `Canvas.tsx:533` and `Canvas.tsx:546` accept `fl:s:` / `fl:t:` in lineage mode; `useCanvasEdges.ts:191` writes those ids onto field-lineage *edges*. Missing: no `Handle` emits them — `ColumnRow.tsx:86` and `ColumnRow.tsx:144` only render `t:<col>` / `s:<col>`. User cannot drag column→column in lineage mode to create an L2 mapping (the handles that exist are rejected while lineage mode is on).

- **ⓘ on a table.** Exists: overlay copy `gestures.ts:13` (“Clicar em ⓘ na tabela”); popover content is real via hover (`Workspace.tsx:199`). Missing: no ⓘ (or `table-node__info`) in `TableNode.tsx` — header is title + `⋯` + `LineagePorts`. User cannot click ⓘ on a table; metadata only appears on node hover, docked at the canvas corner.

- **Rubber-band multi-select (documented as “arrasto”).** Exists: overlay `gestures.ts:14` (“Cmd/Ctrl + clique ou arrasto”); Cmd/Ctrl+click does select. Missing: box-select does not stick — `Canvas.tsx` sets `selectionOnDrag` while leaving `panOnDrag` at xyflow’s default `true`, so `_selectionOnDrag` is false; the pane pans instead. User cannot drag a selection rectangle to multi-select tables.

---

## (b) Callback declared, never passed (visible control)

- **Status bar zoom.** Exists: `StatusBar` renders − / % / + (`StatusBar.tsx:32–33`, `StatusBar.tsx:137`, `StatusBar.tsx:162`). Missing: `Workspace.tsx:331` passes `onFitView` and `density` but not `onZoomIn` / `onZoomOut`, and hard-codes `zoomPercent={100}`. User can press −/+ and see “100%”; neither zooms nor reflects the viewport.

- **Navbar Share.** Exists: primary Share button `Navbar.tsx:73` / `Navbar.tsx:240` (`onPrimaryAction`). Missing: `Workspace.tsx:84` does not pass `onPrimaryAction`. User can click Share; nothing happens.

- **Navbar avatar.** Exists: avatar button `Navbar.tsx:74` / `Navbar.tsx:254` (`onAvatarClick`). Missing: `Workspace.tsx:84` does not pass `onAvatarClick`. User can click the avatar; nothing happens.

---

## (c) Export never called outside tests

Only entries that are a domain operation with zero production callers (not barrel wrappers):

- **`updateFieldLineageMeta`.** Exists: `schema/model/edit.ts:478`. Missing: no caller in `src/` outside its module. User cannot edit note/ref on an existing field-lineage mapping through this API (and no other production path was found).

- **`pruneOrphanPositions`.** Exists: `shell/workspaceModel.ts:136`. Missing: no caller in `src/` at all. Deleted tables can leave stale `canvas.positions` keys; nothing prunes them.
