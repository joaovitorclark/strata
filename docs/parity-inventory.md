# Strata Parity Inventory

Extracted from LocalDrawDB @ `343ae98` on 2026-09-10. This is the contract for Plan 2's Stage 5:
migration is complete when every row is verified in Strata.

One row = one thing a user can do. Do not merge rows. Do not delete a row because it seems
unimportant — mark it deliberately dropped, with a reason, and it becomes a decision someone can
review.

Sources are paths under the frozen LocalDrawDB checkout (`$LDB`).
| # | Area | Behaviour | Source | Verified |
|---|------|-----------|--------|----------|
| 1 | Palette | Open the command palette from the toolbar "Buscar" button | src/App.tsx:1634 | ☑ shell-command-palette.cy.ts |
| 2 | Palette | Type in the palette search box to filter tables, columns, and actions (limit 12) | src/palette/CommandPalette.tsx:87 | ☑ shell-command-palette.cy.ts |
| 3 | Palette | Arrow Up/Down moves the highlighted result | src/palette/CommandPalette.tsx:56 | ☑ shell-command-palette.cy.ts |
| 4 | Palette | Enter runs the highlighted command and closes the palette | src/palette/CommandPalette.tsx:66 | ☑ shell-command-palette.cy.ts |
| 5 | Palette | Click a result runs that command and closes the palette | src/palette/CommandPalette.tsx:110 | ☑ shell-command-palette.cy.ts |
| 6 | Palette | Escape closes the palette | src/palette/CommandPalette.tsx:51 | ☑ shell-command-palette.cy.ts |
| 7 | Palette | Click outside the palette closes it | src/palette/CommandPalette.tsx:33 | ☑ shell-command-palette.cy.ts |
| 8 | Palette | "Salvar" (Cmd/Ctrl+S) reconciles editor edits then saves; if a rename modal opens, save is blocked | src/App.tsx:1470 | ☑ |
| 9 | Palette | "Organizar DBML" rewrites the document as tables → refs → records | src/App.tsx:1477 | ☑ |
| 10 | Palette | "Organizar canvas" runs autolayout (lineage stack when lineage mode is on) and fits the view | src/App.tsx:1483 | ☑ |
| 11 | Palette | "Exportar LocalDrawDB (Spark)" runs export format `localdrawdb` with dialect `spark` | src/App.tsx:1489 | ☑ |
| 12 | Palette | "Exportar LocalDrawDB (Oracle)" runs export format `localdrawdb` with dialect `oracle` | src/App.tsx:1489 | ☑ |
| 13 | Palette | "Exportar Spark DDL" runs export format `spark-ddl` | src/App.tsx:1489 | ☑ |
| 14 | Palette | "Exportar Oracle DDL" runs export format `oracle-ddl` | src/App.tsx:1489 | ☑ |
| 15 | Palette | "Exportar PostgreSQL DDL" runs export format `postgres-ddl` | src/App.tsx:1489 | ☑ |
| 16 | Palette | "Exportar erwin (ANSI)" runs export format `erwin` | src/App.tsx:1489 | ☑ |
| 17 | Palette | "Exportar dbt" runs export format `dbt` | src/App.tsx:1489 | ☑ |
| 18 | Palette | "Exportar Mermaid" runs export format `mermaid` | src/App.tsx:1489 | ☑ |
| 19 | Palette | "Exportar Dicionário de dados (XLSX)" runs export format `xlsx` | src/App.tsx:1489 | ☑ |
| 20 | Palette | "Exportar Contexto para LLM (Markdown+JSON)" runs export format `llm-context` | src/App.tsx:1489 | ☑ |
| 21 | Palette | "Importar (input/)" merges SQL from the project's `input/` into the DBML and may open the page wizard | src/App.tsx:1495 | ☑ |
| 22 | Palette | "Undo" (Cmd/Ctrl+Z) restores the previous document/canvas snapshot | src/App.tsx:1501 | ☑ |
| 23 | Palette | "Redo" (Cmd/Ctrl+Shift+Z) restores the next document/canvas snapshot | src/App.tsx:1508 | ☑ |
| 24 | Palette | "Ligar Auto-save" / "Desligar Auto-save" toggles autosave (label depends on current state) | src/App.tsx:1515 | ☑ |
| 25 | Palette | "Alternar modo linhagem" toggles lineage-edit mode on the canvas | src/App.tsx:1521 | ☑ |
| 26 | Palette | "Abrir painel Camadas" / "Fechar painel Camadas" collapses or expands the Layers panel | src/App.tsx:1527 | ☑ |
| 27 | Palette | "Abrir painel Dados" / "Fechar painel Dados" opens or closes the Records panel | src/App.tsx:1533 | ☑ |
| 28 | Palette | "Abrir painel Problemas" / "Fechar painel Problemas" opens or closes the Problems popover | src/App.tsx:1539 | ☑ |
| 29 | Palette | Choosing a table command focuses that table on the canvas, pans to it, and scrolls the DBML editor to its line | src/palette/registry.ts:106 | ☑ shell-command-palette.cy.ts |
| 30 | Palette | Choosing a column command focuses that table, selects the column, and scrolls the DBML editor to the column line | src/palette/registry.ts:118 | ☑ shell-command-palette.cy.ts |
| 31 | Shortcut | Cmd/Ctrl+S saves (same as palette "Salvar") | src/help/gestures.ts:51 | ☑ shell-shortcuts.cy.ts |
| 32 | Shortcut | Cmd/Ctrl+Z undoes | src/help/gestures.ts:51 | ☑ shell-shortcuts.cy.ts |
| 33 | Shortcut | Cmd/Ctrl+Shift+Z redoes | src/help/gestures.ts:51 | ☑ shell-shortcuts.cy.ts |
| 34 | Shortcut | Cmd/Ctrl+K opens the command palette ("Buscar comandos e tabelas") | src/help/gestures.ts:21 | ☑ shell-command-palette.cy.ts |
| 35 | Shortcut | Delete removes the selected ref | src/help/gestures.ts:22 | ☑ canvas-edges.cy.ts |
| 36 | Shortcut | Escape clears selection / closes modals | src/help/gestures.ts:23 | ☑ shell-shortcuts.cy.ts |
| 37 | Shortcut | "?" opens or toggles the shortcuts-and-gestures overlay | src/help/gestures.ts:24 | ☑ shell-shortcuts.cy.ts |
| 38 | Shortcut | Cmd/Ctrl+Y also redoes (wired in App, not listed by `shortcutsFromCommands`) | src/App.tsx:669 | ☑ shell-shortcuts.cy.ts |
| 39 | Canvas | Hover a column or ref highlights connected FK relations | src/help/gestures.ts:10 | ☐ no Plan 3 spec |
| 40 | Canvas | Drag a column handle onto another column creates a `Ref:` block in the DBML | src/help/gestures.ts:11 | ☐ no Plan 3 spec |
| 41 | Canvas | Click a column opens the column panel | src/help/gestures.ts:12 | ☐ no Plan 3 spec |
| 42 | Canvas | Hover ⓘ on a table opens table metadata | src/help/gestures.ts:13 | ☐ TableNode has no ⓘ (Task 15); no Plan 3 spec for TableInfoPopover |
| 43 | Canvas | Cmd/Ctrl+click or drag selects multiple tables | src/help/gestures.ts:14 | ☐ no Plan 3 spec |
| 44 | Canvas | Lineage mode: ports on table edges edit lineage entries | src/help/gestures.ts:15 | ☑ canvas-edges.cy.ts |
| 45 | Canvas | Delete removes the selected ref | src/help/gestures.ts:16 | ☑ canvas-edges.cy.ts |
| 46 | Canvas | Escape clears selection and closes modals (first press drops column, second clears table) | src/help/gestures.ts:17 | ☐ canvas-selection.cy.ts / shell-shortcuts.cy.ts only clear table selection |
| 47 | Canvas | `onSelectColumn` selects a table+column (opens ColumnPanel) | src/canvas/actions.ts:23 | ☐ no Plan 3 spec |
| 48 | Canvas | `onRenameColumn` renames a column across all refs; duplicate names are rejected with a status message | src/canvas/actions.ts:24 | ☐ no Plan 3 spec |
| 49 | Canvas | `onGoToColumn` opens the DBML editor and jumps to that column | src/canvas/actions.ts:25 | ☐ no Plan 3 spec |
| 50 | Canvas | `onRenameTable` renames a table and migrates canvas ids; duplicate ids are rejected | src/canvas/actions.ts:26 | ☐ no Plan 3 spec |
| 51 | Canvas | `onRemoveTable` deletes a table and related refs from the DBML | src/canvas/actions.ts:27 | ☐ no Plan 3 spec |
| 52 | Canvas | `onAddColumn` appends a `nova_coluna string` column to the table | src/canvas/actions.ts:28 | ☐ no Plan 3 spec |
| 53 | Canvas | `colorOf` returns the table header colour for a table id | src/canvas/actions.ts:29 | ☐ no Plan 3 spec |
| 54 | Canvas | `onSetColor` writes or clears a table header colour in the DBML | src/canvas/actions.ts:30 | ☐ no Plan 3 spec |
| 55 | Canvas | `onSetGroupColor` writes or clears a TableGroup box colour | src/canvas/actions.ts:32 | ☐ no Plan 3 spec |
| 56 | Canvas | `onResizeTable` stores rounded width/height for a table | src/canvas/actions.ts:34 | ☐ no Plan 3 spec |
| 57 | Canvas | `layerOf` returns the layer id of a table (explicit membership, else schema-name match) | src/canvas/actions.ts:36 | ☑ canvas-layer-edge.cy.ts |
| 58 | Canvas | `layerColorOf` returns the colour of a layer | src/canvas/actions.ts:37 | ☐ no Plan 3 spec |
| 59 | Canvas | `onSetLayer` assigns or clears a table's layer in the DBML | src/canvas/actions.ts:38 | ☐ no Plan 3 spec |
| 60 | Canvas | `layers` exposes the current layer list to table nodes | src/canvas/actions.ts:39 | ☐ no Plan 3 spec |
| 61 | Canvas | `onAddLayer` creates a LayerGroup with name and colour | src/canvas/actions.ts:40 | ☐ no Plan 3 spec |
| 62 | Canvas | `onToggleGroup` collapses or expands a TableGroup | src/canvas/actions.ts:42 | ☐ no Plan 3 spec |
| 63 | Canvas | `tableMeta` resolves sources, sample rows, PKs/FKs, dbt badges, and notes for the info popover | src/canvas/actions.ts:44 | ☐ no Plan 3 spec |
| 64 | Canvas | Drag a table (or multi-selected tables) updates stored positions | src/canvas/Canvas.tsx:479 | ☑ canvas-drag.cy.ts |
| 65 | Canvas | Drag a TableGroup by its handle moves all member tables | src/canvas/Canvas.tsx:458 | ☐ no Plan 3 spec |
| 66 | Canvas | Drop a column source handle on a column target handle creates a Ref (PK side preferred as target) | src/canvas/Canvas.tsx:450 | ☐ no Plan 3 spec |
| 67 | Canvas | In lineage mode, drag between edge ports creates a table-level lineage entry | src/canvas/Canvas.tsx:407 | ☐ no Plan 3 spec |
| 68 | Canvas | In lineage mode, drag between field handles (`fl:`) creates a field-level (L2) mapping | src/canvas/Canvas.tsx:403 | ☐ no Plan 3 spec |
| 69 | Canvas | Drag a relation edge endpoint onto another column retargets the Ref | src/canvas/Canvas.tsx:513 | ☐ no Plan 3 spec |
| 70 | Canvas | Delete or Backspace on selected table node(s) deletes those tables and related refs | src/canvas/Canvas.tsx:492 | ☐ no Plan 3 spec |
| 71 | Canvas | Delete or Backspace on a selected relation/lineage/field-lineage edge removes that edge from the DBML | src/canvas/Canvas.tsx:502 | ☐ no Plan 3 spec |
| 72 | Canvas | Click the canvas pane clears table selection (column selection is kept) | src/canvas/Canvas.tsx:584 | ☑ canvas-selection.cy.ts |
| 73 | Canvas | Click a table (not a column row) focuses it and scrolls the editor to its block | src/canvas/Canvas.tsx:569 | ☐ canvas-selection.cy.ts asserts select+inspector+tree, not editor scroll from a canvas click |
| 74 | Canvas | Click a TableGroup selects that group (Records panel then filters to the group) | src/canvas/Canvas.tsx:570 | ☐ no Plan 3 spec |
| 75 | Canvas | Hover a table sets hover-focus so related tables stay highlighted | src/canvas/Canvas.tsx:567 | ☐ no Plan 3 spec |
| 76 | Canvas | React Flow Controls: zoom in, zoom out, fit view, and lock interactivity | src/canvas/Canvas.tsx:602 | ☐ canvas-lod.cy.ts covers zoom in/out only; fit view and lock untested |
| 77 | Canvas | MiniMap is pannable and zoomable (lite colouring above the table threshold) | src/canvas/Canvas.tsx:604 | ☑ stress-large-diagram.cy.ts |
| 78 | Canvas | Double-click a table title prompts for a new `schema.tabela` name and renames it | src/canvas/TableNode.tsx:70 | ☐ no Plan 3 spec |
| 79 | Canvas | Click × on a table confirms then deletes the table and related refs | src/canvas/TableNode.tsx:104 | ☐ no Plan 3 spec |
| 80 | Canvas | Click the colour/layer control to open the table palette | src/canvas/TableNode.tsx:118 | ☐ no Plan 3 spec |
| 81 | Canvas | Pick a swatch in the table palette to set the header colour | src/canvas/TableNode.tsx:129 | ☐ no Plan 3 spec |
| 82 | Canvas | "Sem cor (usar camada)" clears the table header colour | src/canvas/TableNode.tsx:136 | ☐ no Plan 3 spec |
| 83 | Canvas | Pick a layer in the table palette to assign the table to that layer | src/canvas/TableNode.tsx:144 | ☐ no Plan 3 spec |
| 84 | Canvas | "sem camada" clears the table's layer assignment | src/canvas/TableNode.tsx:148 | ☐ no Plan 3 spec |
| 85 | Canvas | Drag the bottom-right corner to resize the table | src/canvas/TableNode.tsx:57 | ☐ no Plan 3 spec |
| 86 | Canvas | "+ coluna" adds a new column to the table | src/canvas/TableNode.tsx:215 | ☐ no Plan 3 spec |
| 87 | Canvas | Double-click a column name to rename it inline (Enter commits, Escape cancels) | src/canvas/TableColumnList.tsx:114 | ☐ no Plan 3 spec |
| 88 | Canvas | Alt+click a column jumps to that column in the DBML editor | src/canvas/TableNode.tsx:199 | ☐ no Plan 3 spec |
| 89 | Canvas | Collapse/expand a TableGroup via the chevron on its label | src/canvas/GroupNode.tsx:48 | ☐ no Plan 3 spec |
| 90 | Canvas | Open the group colour palette and pick a colour for the TableGroup box | src/canvas/GroupNode.tsx:88 | ☐ no Plan 3 spec |
| 91 | Canvas | "Sem cor" clears the TableGroup colour | src/canvas/GroupNode.tsx:99 | ☐ no Plan 3 spec |
| 92 | Canvas | Stale-model banner tells the user the canvas shows the last valid model while DBML is invalid | src/canvas/Canvas.tsx:533 | ☐ no Plan 3 spec |
| 93 | Panel:ColumnPanel | Collapse/expand the column editor (persisted in localStorage) | src/canvas/ColumnPanel.tsx:133 | ☑ |
| 94 | Panel:ColumnPanel | Close the column editor (clears selected column) | src/canvas/ColumnPanel.tsx:142 | ☑ |
| 95 | Panel:ColumnPanel | Rename the column via the Nome field (Enter or blur) | src/canvas/ColumnPanel.tsx:154 | ☑ |
| 96 | Panel:ColumnPanel | "Editar no DBML" opens the editor and jumps to the column | src/canvas/ColumnPanel.tsx:165 | ☑ |
| 97 | Panel:ColumnPanel | Set the field-name colour to Vermelho, Amarelo, or Verde | src/canvas/ColumnPanel.tsx:177 | ☑ |
| 98 | Panel:ColumnPanel | Pick a custom field-name colour | src/canvas/ColumnPanel.tsx:186 | ☑ |
| 99 | Panel:ColumnPanel | "Sem cor" clears the field-name colour | src/canvas/ColumnPanel.tsx:194 | ☑ |
| 100 | Panel:ColumnPanel | Toggle Primary key | src/canvas/ColumnPanel.tsx:206 | ☑ |
| 101 | Panel:ColumnPanel | Choose a FK target (or "— nenhuma —") from PK columns of other tables | src/canvas/ColumnPanel.tsx:211 | ☑ |
| 102 | Panel:ColumnPanel | Toggle Not null | src/canvas/ColumnPanel.tsx:224 | ☑ |
| 103 | Panel:ColumnPanel | Edit the column Note | src/canvas/ColumnPanel.tsx:232 | ☑ |
| 104 | Panel:ColumnPanel | Edit the column Default | src/canvas/ColumnPanel.tsx:241 | ☑ |
| 105 | Panel:LayersPanel | Collapse/expand the Layers panel | src/canvas/LayersPanel.tsx:104 | ☑ |
| 106 | Panel:LayersPanel | Check "Todas" to show every TableGroup page on the canvas | src/canvas/LayersPanel.tsx:118 | ☑ |
| 107 | Panel:LayersPanel | Check/uncheck a named page (TableGroup) to show it on the canvas | src/canvas/LayersPanel.tsx:125 | ☑ |
| 108 | Panel:LayersPanel | Check/uncheck a layer to show or hide its tables | src/canvas/LayersPanel.tsx:140 | ☑ |
| 109 | Panel:LayersPanel | "+ camada" prompts for name and hex colour and adds a LayerGroup | src/canvas/LayersPanel.tsx:147 | ☑ |
| 110 | Panel:LayersPanel | Insert preset "Medallion (pt-BR): Bronze / Prata / Ouro" | src/canvas/LayersPanel.tsx:160 | ☑ |
| 111 | Panel:LayersPanel | Insert preset "Medallion (en): Bronze / Silver / Gold" | src/canvas/LayersPanel.tsx:160 | ☑ |
| 112 | Panel:LayersPanel | Insert preset "Raw / EDW / Mart" | src/canvas/LayersPanel.tsx:160 | ☑ |
| 113 | Panel:LayersPanel | Insert preset "Inbound / Staging / Solutions" | src/canvas/LayersPanel.tsx:160 | ☑ |
| 114 | Panel:LayersPanel | Insert preset "SOR / SOT / Spec" | src/canvas/LayersPanel.tsx:160 | ☑ |
| 115 | Panel:LayersPanel | "Esmaecer (em vez de esconder)" dims hidden layers instead of hiding them | src/canvas/LayersPanel.tsx:176 | ☑ |
| 116 | Panel:LayersPanel | "Mostrar linhagem" shows or hides L1 lineage edges | src/canvas/LayersPanel.tsx:182 | ☑ |
| 117 | Panel:LayersPanel | "Mostrar relacionamentos" shows or hides FK relation edges | src/canvas/LayersPanel.tsx:186 | ☑ |
| 118 | Panel:LayersPanel | "Mostrar linhagem de campos" shows or hides L2 field-lineage edges | src/canvas/LayersPanel.tsx:190 | ☑ |
| 119 | Panel:LayersPanel | "Modo linhagem" toggles lineage-edit mode | src/canvas/LayersPanel.tsx:197 | ☑ |
| 120 | Panel:LayersPanel | Search box filters the table list by id | src/canvas/LayersPanel.tsx:212 | ☑ |
| 121 | Panel:LayersPanel | Click (or double-click) a table name to pan/focus it on the canvas | src/canvas/LayersPanel.tsx:226 | ☑ |
| 122 | Panel:LayersPanel | "Organizar canvas" runs autolayout | src/canvas/LayersPanel.tsx:242 | ☑ |
| 123 | Panel:ProblemsPanel | Click the problems badge to open or close the issues popover | src/canvas/ProblemsPanel.tsx:62 | ☑ |
| 124 | Panel:ProblemsPanel | "Linha" jumps the editor to the issue line and closes the popover | src/canvas/ProblemsPanel.tsx:88 | ☑ |
| 125 | Panel:ProblemsPanel | "Tabela" pans the canvas to the issue table and closes the popover | src/canvas/ProblemsPanel.tsx:99 | ☑ |
| 126 | Panel:ProblemsPanel | Click outside the badge/popover closes it | src/canvas/ProblemsPanel.tsx:29 | ☑ |
| 127 | Panel:RecordsPanel | Toggle the sample-data panel open/closed | src/records/RecordsPanel.tsx:198 | ☑ |
| 128 | Panel:RecordsPanel | Edit "Nota da tabela" (saved on blur) | src/records/RecordsPanel.tsx:207 | ☑ |
| 129 | Panel:RecordsPanel | Edit the selected column's note (saved on blur) | src/records/RecordsPanel.tsx:214 | ☑ |
| 130 | Panel:RecordsPanel | Click an L1 source table name to focus that table on the canvas | src/records/RecordsPanel.tsx:230 | ☑ |
| 131 | Panel:RecordsPanel | Click an L2 source `table.column` to focus the source table | src/records/RecordsPanel.tsx:253 | ☑ |
| 132 | Panel:GitPanel | Open/close the git dropdown from the branch button | src/domains/GitPanel.tsx:169 | ☑ |
| 133 | Panel:GitPanel | Click a listed branch to switch to it (reloads files via `onRepoChanged`) | src/domains/GitPanel.tsx:188 | ☑ |
| 134 | Panel:GitPanel | Type a name and "Criar branch" (or Enter) creates and switches to that branch | src/domains/GitPanel.tsx:205 | ☑ |
| 135 | Panel:GitPanel | Type a message and "commit" (or Enter) stages all files and commits | src/domains/GitPanel.tsx:220 | ☑ |
| 136 | Panel:GitPanel | "pull" pulls from origin (refused if the working tree is dirty) | src/domains/GitPanel.tsx:224 | ☑ |
| 137 | Panel:GitPanel | "push" pushes the current branch to origin (`-u`) | src/domains/GitPanel.tsx:227 | ☑ |
| 138 | Panel:GitPanel | "Abrir PR" opens the host's compare URL, or shows a message if the host has no template | src/domains/GitPanel.tsx:230 | ☑ |
| 139 | Panel:GitPanel | "Credenciais" opens the credentials wizard | src/domains/GitPanel.tsx:233 | ☑ |
| 140 | Panel:GitPanel | Escape or click outside closes the dropdown | src/domains/GitPanel.tsx:62 | ☑ |
| 141 | Panel:DomainPicker | Click a domain to activate it and show its projects | src/domains/DomainPicker.tsx:156 | ☑ |
| 142 | Panel:DomainPicker | Click the remove (×) control, confirm, and delete the domain from this computer | src/domains/DomainPicker.tsx:164 | ☑ |
| 143 | Panel:DomainPicker | "+ Novo domínio local" reveals the local-domain form | src/domains/DomainPicker.tsx:186 | ☑ |
| 144 | Panel:DomainPicker | "+ Clonar repositório" reveals the clone form (name + URL) | src/domains/DomainPicker.tsx:187 | ☑ |
| 145 | Panel:DomainPicker | "Criar" creates a local domain or clones the given URL | src/domains/DomainPicker.tsx:203 | ☑ |
| 146 | Panel:DomainPicker | "Cancelar" dismisses the new-domain form | src/domains/DomainPicker.tsx:204 | ☑ |
| 147 | Panel:DomainPicker | "← Domínios" clears context and returns to the domain list | src/domains/DomainPicker.tsx:143 | ☑ |
| 148 | Panel:DomainPicker | "Anexar repositório" reveals the optional remote URL field | src/domains/DomainPicker.tsx:233 | ☑ |
| 149 | Panel:DomainPicker | "Confirmar" runs `git init` (and optional remote) on the domain | src/domains/DomainPicker.tsx:228 | ☑ |
| 150 | Panel:DomainPicker | Click a project to activate it and open the editor | src/domains/DomainPicker.tsx:239 | ☑ |
| 151 | Panel:DomainPicker | Type a name and "+ Novo projeto" creates a project in the active domain | src/domains/DomainPicker.tsx:253 | ☑ |
| 152 | Panel:CredentialsWizard | Follow "Abrir página de criar token em {host}" (when a known host URL exists) | src/domains/CredentialsWizard.tsx:46 | ☑ |
| 153 | Panel:CredentialsWizard | Fill Usuário | src/domains/CredentialsWizard.tsx:54 | ☑ |
| 154 | Panel:CredentialsWizard | Fill Token (password field) | src/domains/CredentialsWizard.tsx:59 | ☑ |
| 155 | Panel:CredentialsWizard | "Salvar" stores the credential via git credential approve | src/domains/CredentialsWizard.tsx:67 | ☑ |
| 156 | Panel:CredentialsWizard | "Cancelar" dismisses the wizard | src/domains/CredentialsWizard.tsx:70 | ☑ |
| 157 | Panel:StatusLog | Click the status/save-state button to open the last-100 session log | src/canvas/StatusLog.tsx:75 | ☑ |
| 158 | Panel:StatusLog | Click outside the popover to close the log | src/canvas/StatusLog.tsx:53 | ☑ |
| 159 | Panel:TableInfoPopover | View sources, sample rows (up to 5), PKs/FKs, dbt badges, and comments while hovering ⓘ | src/canvas/TableInfoPopover.tsx:6 | ☑ |
| 160 | Panel:SelectionBar | Remove one table from the multi-selection via the chip × | src/canvas/SelectionBar.tsx:41 | ☑ |
| 161 | Panel:SelectionBar | "Apagar selecionadas" confirms then deletes all selected tables | src/canvas/SelectionBar.tsx:52 | ☑ |
| 162 | Panel:SelectionBar | "Limpar" clears a multi-table selection | src/canvas/SelectionBar.tsx:63 | ☑ |
| 163 | Panel:PageImportWizard | Check "Todas as tabelas (pode ficar lento)" to open the full canvas | src/canvas/PageImportWizard.tsx:56 | ☑ |
| 164 | Panel:PageImportWizard | Check one or more assuntos (TableGroups) to include them on the canvas | src/canvas/PageImportWizard.tsx:61 | ☑ |
| 165 | Panel:PageImportWizard | "Abrir canvas" applies the chosen page ids | src/canvas/PageImportWizard.tsx:76 | ☑ |
| 166 | Panel:PageImportWizard | "Depois" dismisses the wizard and leaves the canvas empty | src/canvas/PageImportWizard.tsx:80 | ☑ |
| 167 | Panel:ColumnMappings | Click an existing L2 mapping to load it into the edit form | src/canvas/ColumnMappings.tsx:95 | ☑ |
| 168 | Panel:ColumnMappings | Remove a mapping with the delete control | src/canvas/ColumnMappings.tsx:116 | ☑ |
| 169 | Panel:ColumnMappings | "+" resets the form to create a new mapping | src/canvas/ColumnMappings.tsx:132 | ☑ |
| 170 | Panel:ColumnMappings | Choose the source table | src/canvas/ColumnMappings.tsx:139 | ☑ |
| 171 | Panel:ColumnMappings | Choose the source column | src/canvas/ColumnMappings.tsx:154 | ☑ |
| 172 | Panel:ColumnMappings | Edit "Nota ETL" | src/canvas/ColumnMappings.tsx:163 | ☑ |
| 173 | Panel:ColumnMappings | Edit "Ref (sql/py)" | src/canvas/ColumnMappings.tsx:167 | ☑ |
| 174 | Panel:ColumnMappings | "+ mapeamento" / "Salvar" adds or updates the L2 mapping for the current column | src/canvas/ColumnMappings.tsx:170 | ☑ |
| 175 | Panel:DbmlDiff | Close the DBML diff dialog | src/components/DbmlDiff.tsx:78 | ☑ |
| 176 | Panel:DbmlDiff | View line-by-line add/del/same between saved DBML and the in-memory working copy | src/components/DbmlDiff.tsx:83 | ☑ |
| 177 | Panel:ProjectSwitcher | Open the project menu from the current project name | src/ProjectSwitcher.tsx:118 | ☑ |
| 178 | Panel:ProjectSwitcher | Click another project to switch to it | src/ProjectSwitcher.tsx:139 | ☑ |
| 179 | Panel:ProjectSwitcher | Rename a project via the row edit control (prompt) | src/ProjectSwitcher.tsx:152 | ☑ |
| 180 | Panel:ProjectSwitcher | Duplicate a project via the row control (prompt for the copy name) | src/ProjectSwitcher.tsx:162 | ☑ |
| 181 | Panel:ProjectSwitcher | Delete a project via the row × (confirm; hidden when only one project exists) | src/ProjectSwitcher.tsx:174 | ☑ |
| 182 | Panel:ProjectSwitcher | "Renomear projeto" in the footer renames the current project | src/ProjectSwitcher.tsx:189 | ☑ |
| 183 | Panel:ProjectSwitcher | When the instance is pinned, only the pin label and rename control are shown | src/ProjectSwitcher.tsx:96 | ☑ |
| 184 | Export | Format `localdrawdb`: writes `output/localdrawdb/model_spark.sql` or `model_oracle.sql` depending on dialect (`spark` default, `oracle`). Warnings from `exportInputL2Warning`: (1) no LineageFields but L1 Lineage exists; (2) no Lineage and no LineageFields; (3) N silver columns without L2 mapping | server/exportDispatch.ts:35 | ☑ |
| 185 | Export | Format `spark-ddl`: writes one file per schema under `output/spark/`. No L2 warning. | server/exportDispatch.ts:42 | ☑ |
| 186 | Export | Format `oracle-ddl`: writes one file per schema under `output/oracle/`. No L2 warning. | server/exportDispatch.ts:48 | ☑ |
| 187 | Export | Format `postgres-ddl`: writes one file per schema under `output/postgres/`. No L2 warning. | server/exportDispatch.ts:54 | ☑ |
| 188 | Export | Format `erwin`: writes `output/erwin/modelo.sql`. No L2 warning. | server/exportDispatch.ts:60 | ☑ |
| 189 | Export | Format `dbt`: writes a dbt project under `output/dbt/`. No L2 warning. | server/exportDispatch.ts:64 | ☑ |
| 190 | Export | Format `mermaid`: writes `output/mermaid/modelo.mmd`. No L2 warning. | server/exportDispatch.ts:70 | ☑ |
| 191 | Export | Format `xlsx`: writes `output/xlsx/dicionario.xlsx`. No L2 warning. | server/exportDispatch.ts:74 | ☑ |
| 192 | Export | Format `llm-context`: writes `output/llm/contexto.md`. No L2 warning. | server/exportDispatch.ts:79 | ☑ |
| 193 | Export | Toolbar "Exportar" menu lists the same ten options and runs the matching format | src/ExportMenu.tsx:50 | ☑ shell-export-menu.cy.ts |
| 194 | Git | View current branch, dirty/ahead/behind summary on the GitPanel trigger | server/git.ts:165 | ☑ |
| 195 | Git | Switch to an existing branch (`git switch`) | server/git.ts:183 | ☑ |
| 196 | Git | Create a branch (`git switch -c`); if HEAD is unborn, a first commit is created first | server/git.ts:188 | ☑ |
| 197 | Git | Pull (`git pull`); refused when the working tree is dirty | server/git.ts:192 | ☑ |
| 198 | Git | Commit: `git add -A` then `git commit -m`; refused when there is nothing to commit | server/git.ts:200 | ☑ |
| 199 | Git | Push: `git push -u origin <branch>`; refused if dirty or nothing to send | server/git.ts:220 | ☑ |
| 200 | Git | Clone a remote into a new domain directory | server/git.ts:240 | ☑ |
| 201 | Git | Init a domain repo (`git init -b main`, optional `remote add origin`) | server/git.ts:247 | ☑ |
| 202 | Git | Bootstrap an empty repo (README, first commit on `main`, best-effort `push -u origin main`) | server/git.ts:311 | ☑ |
| 203 | Git | Store HTTPS credentials via `git credential approve` | server/git.ts:347 | ☑ |
| 204 | Git | Read `origin` remote URL (used for PR link / host detection) | server/git.ts:232 | ☑ |
| 205 | API | GET `/api/project` loads the active project's DBML and canvas | src/api.ts:199 | ☑ |
| 206 | API | PUT `/api/project` saves the active project's DBML and canvas | src/api.ts:206 | ☑ |
| 207 | API | GET `/api/meta` returns root/data/input/port and pinned project | src/api.ts:216 | ☑ |
| 208 | API | GET `/api/projects` lists projects and the active id | src/api.ts:218 | ☑ |
| 209 | API | POST `/api/projects` creates a project | src/api.ts:221 | ☑ |
| 210 | API | PATCH `/api/projects/:id` renames a project | src/api.ts:224 | ☑ |
| 211 | API | DELETE `/api/projects/:id` deletes a project | src/api.ts:227 | ☑ |
| 212 | API | POST `/api/projects/:id/duplicate` duplicates a project | src/api.ts:230 | ☑ |
| 213 | API | POST `/api/projects/:id/activate` activates a project | src/api.ts:233 | ☑ |
| 214 | API | GET `/api/projects/:id` loads a project's DBML and canvas | src/api.ts:237 | ☑ |
| 215 | API | PUT `/api/projects/:id` saves a project by id | src/api.ts:242 | ☑ |
| 216 | API | POST `/api/projects/:id/import` imports `input/` into that project | src/api.ts:245 | ☑ |
| 217 | API | POST `/api/import` imports `input/` into the active project | src/api.ts:251 | ☑ |
| 218 | API | POST `/api/export` runs a named export format (optional dialect) | src/api.ts:262 | ☑ |
| 219 | API | POST `/api/export/png` writes a PNG from a base64 payload | src/api.ts:269 | dropped — no UI in LDB App or Strata calls exportPng; would require a Canvas screenshot rewrite (forbidden in this task) |
| 220 | API | GET `/api/domains` lists domains and the active slug | src/api.ts:300 | ☑ |
| 221 | API | POST `/api/domains` creates a local domain | src/api.ts:303 | ☑ |
| 222 | API | POST `/api/domains/clone` clones a remote into a new domain | src/api.ts:305 | ☑ |
| 223 | API | POST `/api/domains/:id/attach-git` inits git (optional remote) on a domain | src/api.ts:308 | ☑ |
| 224 | API | DELETE `/api/domains/:id` deletes a domain from this computer | src/api.ts:311 | ☑ |
| 225 | API | POST `/api/domains/:id/activate` activates a domain | src/api.ts:314 | ☑ |
| 226 | API | GET `/api/domains/:id/git-status` returns git status for a domain | src/api.ts:317 | ☑ |
| 227 | API | POST `/api/domains/:id/git/switch-branch` switches or creates a branch | src/api.ts:319 | ☑ |
| 228 | API | POST `/api/domains/:id/git/pull` pulls | src/api.ts:325 | ☑ |
| 229 | API | POST `/api/domains/:id/git/commit` commits with a message | src/api.ts:327 | ☑ |
| 230 | API | POST `/api/domains/:id/git/push` pushes | src/api.ts:331 | ☑ |
| 231 | API | GET `/api/domains/:id/git/pr-url` returns a compare/PR URL | src/api.ts:333 | ☑ |
| 232 | API | POST `/api/domains/:id/git/credential` stores host/username/token | src/api.ts:338 | ☑ |
| 233 | API | GET `/api/context` returns the active domain | src/api.ts:345 | ☑ |
| 234 | API | POST `/api/context/clear` clears the active domain context | src/api.ts:347 | ☑ |
| 235 | Editor | "← Domínios" leaves the editor (saving first if dirty) and returns to DomainPicker | src/App.tsx:1586 | ☑ |
| 236 | Editor | Toolbar "Organizar DBML" reorders the document | src/App.tsx:1618 | ☑ |
| 237 | Editor | "+ Tabela" prompts for `schema.tabela`, appends a table template, and places it on the canvas | src/App.tsx:1620 | ☑ |
| 238 | Editor | "+ Metadados" appends the default metadata snippet comment block | src/App.tsx:1622 | ☑ |
| 239 | Editor | Toolbar "Importar (input/)" runs the same import as the palette | src/App.tsx:1625 | ☑ |
| 240 | Editor | Toolbar "Diff" opens or closes the DBML diff overlay | src/App.tsx:1644 | ☑ |
| 241 | Editor | Toolbar "Salvar" saves (disabled while saving or already saved) | src/App.tsx:1652 | ☑ |
| 242 | Editor | Toolbar Auto-salvar switch toggles autosave | src/App.tsx:1669 | ☑ |
| 243 | Editor | Collapse/expand the DBML editor pane | src/App.tsx:1696 | ☑ SourceDrawer open/close replaces the LDB split-pane collapse |
| 244 | Editor | Drag the vertical resizer to change editor width | src/App.tsx:1740 | dropped — Strata is canvas-first; SourceDrawer is a bottom overlay, not a split pane (identity §6) |
| 245 | Editor | Type DBML in CodeMirror (line numbers, fold gutter, SQL highlighting) | src/editor/Editor.tsx:81 | ☑ |
| 246 | Editor | Fold consecutive `//` comment lines or `{ ... }` blocks via the fold gutter | src/editor/dbmlFold.ts:9 | ☑ |
| 247 | Editor | Moving the cursor to a table block pans/selects that table on the canvas | src/editor/Editor.tsx:42 | ☐ no Plan 3 spec |
| 248 | Editor | Blur (leaving the editor) commits edits and may open the rename-confirm modal | src/editor/Editor.tsx:44 | ☑ |
| 249 | Editor | Click the error banner to jump to the error line and uncollapse the editor | src/editor/Editor.tsx:95 | ☑ |
| 250 | Editor | Outline chevron collapses or expands the outline panel | src/editor/Outline.tsx:106 | ☑ |
| 251 | Editor | Outline search filters blocks by label | src/editor/Outline.tsx:112 | ☑ |
| 252 | Editor | Click an outline row to jump the editor to that block; table rows also focus the canvas | src/editor/Outline.tsx:185 | ☑ |
| 253 | Editor | Drag the outline resize handle to change outline height (persisted) | src/editor/Outline.tsx:165 | ☑ |
| 254 | Editor | Rename modal "Aplicar" rewrites refs to follow the renamed table/column | src/editor/RenameConfirmModal.tsx:28 | ☑ |
| 255 | Editor | Rename modal "Manter separado" registers rolenames so child FKs keep their own names | src/editor/RenameConfirmModal.tsx:29 | ☑ |
| 256 | Editor | Click the rename-modal backdrop to close without applying | src/editor/RenameConfirmModal.tsx:20 | ☑ |
| 257 | Editor | Canvas "?" button opens the shortcuts-and-gestures overlay | src/App.tsx:1752 | ☑ |
| 258 | Editor | Overlay close button (×) closes shortcuts help | src/help/ShortcutsOverlay.tsx:59 | ☑ |
| 259 | Editor | Autosave, when on, saves 1.5s after the document becomes dirty | src/App.tsx:425 | ☑ autosave 1.5s wired in useWorkspace; save API exercised in Workspace.test |
| 260 | Editor | Undo/Redo toolbar buttons (same as palette Undo/Redo) | src/App.tsx:1608 | ☑ |

## Task 26 drop notes

- **219** `POST /api/export/png` — the client helper exists; neither LocalDrawDB `App.tsx` nor Strata Workspace calls it. Capturing a PNG would require rewriting Canvas. Dropped rather than inventing a screenshot path.
- **244** Drag the vertical editor resizer — Strata is canvas-first; the DBML editor is a bottom SourceDrawer, not a split pane (identity §6).
- **77** MiniMap lite colouring: LocalDrawDB never hides the minimap; above `MINIMAP_MAX_TABLES` it paints with a uniform token fill. Ported in Onda S (`stress-large-diagram.cy.ts`).
- **42** TableNode (Task 15 restyle) has no ⓘ control. Metadata-on-hover is composed as `TableInfoPopover` driven by `hoveredTableId` — still ☐ until live ReactFlow.

## Task 29 honest recount (Wave M)

Code wired is not behaviour verified. Rows whose ☑ came from inspecting Canvas.tsx / wiring Workspace, not from driving the gesture, went back to ☐ with `(needs live ReactFlow — Plan 3)`.

**Count after Task 29: 202 ☑ · 56 ☐ · 2 dropped.**

Wave M follow-ups (not Task 29):

- **181** — inventory text was wrong. LocalDrawDB and Strata both **hide** the row × when `projects.length === 1`; they do not disable it. The ☑ stays (jsdom: `ProjectSwitcher.test.tsx`).
- **193** → ☐ after Task 30 restored Radix. Opening the menu is Plan 3.

**Count after Task 30: 201 ☑ · 57 ☐ · 2 dropped.**

| Set | Decision |
| --- | --- |
| **39–92** (54 Canvas) | all ☐ — Task 26 ticked these as "wired; no live RF in jsdom" |
| **35** | ☐ — jsdom fired a `removeSelectedRef` mock; production Workspace does not pass that callback (Canvas `deleteKeyCode`, also unverified) |
| **247** | ☐ — only `shouldPanToTable` unit tests; the cursor→camera gesture needs live ReactFlow |
| **1–34, 36–38** | stay ☑ — CommandPalette / actions / Workspace jsdom actually clicked, typed, and dispatched; not structural-only |

Panel / Git / API / Export / Editor rows that have their own jsdom or golden tests stay ☑. The canvas *effect* of a panel callback (pan, highlight) is owned by the Canvas rows above.

## Plan 3 honest recount (Task 40)

Baseline (after Wave M Task 30): **201 ☑ · 57 ☐ · 2 dropped**.

Live Cypress ticks (spec name in the row): **57, 64, 72, 193**. Already-☑ palette/shortcut rows **1–7, 29–34, 36–38** now name the live spec; the ☑ count does not change for those.

Dropped this plan (component not rewritten to make a spec pass):

- **35, 45** — Workspace does not pass `removeSelectedRef`
- **44** — `TableNode` does not mount `LineagePorts`; `canvas-edges.cy.ts` shrunk to FK only

**Count after Plan 3 Task 40: 205 ☑ · 50 ☐ · 5 dropped.**

Plan 2 claimed 258 ☑. This number is lower, and that is the plan working.

Rows still ☐, each with a reason in the Verified column. The remaining canvas gestures (39–43, 46–56, 58–63, 65–71, 73–76, 78–92) and **247** have no Plan 3 spec. **76** is zoom-only (`canvas-lod.cy.ts`); **73** is select-without-editor-scroll.

## Onda S recount (Tasks 43–46)

Live Cypress restored the three Task 40 drops and ticked MiniMap lite:

- **35, 45** — `canvas-edges.cy.ts` (Delete on a selected Ref)
- **44** — `canvas-edges.cy.ts` (`rf__edge-lin:` with "Mostrar linhagem")
- **77** — `stress-large-diagram.cy.ts` (MiniMap exists in lite mode above 200)

**Count after Onda S: 209 ☑ · 49 ☐ · 2 dropped.**

Dropped remaining are Task 26's **219** and **244**.


