# Plan 2 run log

Orchestrator log for Stages 4–6. One entry per task. Updated at the end of each task and committed with that task (or in the same wave of commits).

Tasks 11–12 completed before this file existed; recorded here for the table.

---

## Task 11 — VERDE
Commit: `3a0fefd`
Portões que EU rodei: `npm run test && npm run build && npm run format:check` → 60/483, build 0, format 0; grep hex legado `src/` vazio
Linhas do inventário: 0 checadas de 0 atribuídas
Decisões que tomei sozinho: comentário de `tableColors.ts` sem as palavras Macchiato/Latte (grep do Plano 1)
Preocupações: comentários de proveniência em `src/index.css` ainda citam Latte/Macchiato
Bloqueio: —

## Task 12 — VERDE
Commit: `4e544ed`
Portões que EU rodei: `npm run test -- src/features/canvas` → 12/62; typecheck 0; format:check 0; `from 'reactflow'` vazio; `nodeInternals` vazio
Linhas do inventário: 0 checadas de 54 Canvas (geometria só; apresentação nas 13–17)
Decisões que tomei sozinho: `tableFocusBounds` ficou `measured ?? width` (aprovado pelo humano depois)
Preocupações: `diagramOverviewBounds` filtrava `n.width && n.height` — viraria Task 12b
Bloqueio: —

## Task 12b — VERDE
Commit: `21ec034`
Portões que EU rodei: `npm run test -- src/features/canvas` → 13 files / 64 tests; `npm run typecheck` → 0; `npm run format:check` → 0
Linhas do inventário: 0
Decisões que tomei sozinho: o loop de `diagramOverviewBounds` também passou a `measured?.width ?? width` (e height), não só o filtro. Sem isso um nó só-measured passaria o filtro e contribuiria largura 0. Mesma forma de `tableFocusBounds`.
Preocupações: —
Bloqueio: —

## Task 13 — DONE_WITH_CONCERNS
Commit: `6384fe0`
Portões que EU rodei: `npm run test -- src/features/canvas` → 14/72; typecheck 0; format:check 0; build 0
Linhas do inventário: 0 checadas de 54 Canvas (sem canvas ao vivo; LOD só em teste)
Decisões que tomei sozinho: `keyColumns` une `compositePks.flat()` — `tableMeta` só lê `ColumnView.pk`, o teste Step 7 falhou até o union (era o segundo caminho).
Preocupações: prompts de rename em PT literal no TableNode (i18n fica para shell); chips externos omitidos; overscan 5 vs `COLUMN_VIRTUAL_OVERSCAN` 3
Bloqueio: —

## Task 14 — DONE_WITH_CONCERNS
Commit: `91a8034`
Portões que EU rodei: canvas 14/72; typecheck 0; format:check 0; build 0; grep hex em `components/` vazio
Linhas do inventário: 0 checadas de 54 Canvas
Decisões que tomei sozinho: CSS das classes `edge--*` em `edgeClasses.css` (Canvas ainda não existe). Animação xyflow `.animated` desligada em FK via CSS, sem reescrever `useCanvasEdges`.
Preocupações: `useCanvasEdges` ainda seta `animated` em FK; o CSS é que corta.
Bloqueio: —

## Task 15 — DONE_WITH_CONCERNS
Commit: `709aaa3`
Portões que EU rodei: canvas 14/72; typecheck 0; format:check 0; build 0; hex vazio
Linhas do inventário: 0 checadas de 54 Canvas
Decisões que tomei sozinho: `TABLE_COLORS` de `@/features/canvas/tableColors`; fallback de grupo `--layer-raw`.
Preocupações: `layerColorOf` não chamado (cor vem de `data.color`); pointer-events do wrapper de grupo fica para Task 16
Bloqueio: —

## Task 16 — DONE_WITH_CONCERNS
Commit: `61a1074`
Portões que EU rodei: canvas 15/74; typecheck 0; format:check 0
Linhas do inventário: 0 checadas de 54 Canvas (mount ReactFlow travou no jsdom)
Decisões que tomei sozinho: omiti SelectionBar; `--brand-green` → `--primary`; teste sample.dbml é parse+registry, não mount 1px.
Preocupações: MiniMap some >200 tabelas (spec) em vez do modo lite do LDB; Canvas ainda não está no App.tsx
Bloqueio: —

## Task 17 — DONE_WITH_CONCERNS
Commit: `4dd8c7d`
Portões que EU rodei: lodSlice 3/3 + interaction store; typecheck 0; format:check 0; useCanvasEdges intacto
Linhas do inventário: 0 checadas de 54 Canvas
Decisões que tomei sozinho: `enableMapSet` já ligado — não dupliquei. `meta.strata.pinned` só no tipo; export dbt não alterado (evitei round-trip novo).
Preocupações: pins não sobrevivem reload; Ctrl-click também pina
Bloqueio: —

## Task 18 — DONE_WITH_CONCERNS
Commit: `89b1485`
Portões que EU rodei: shell 9 testes; typecheck 0; format:check 0; App.tsx 5 linhas
Linhas do inventário: 0
Decisões que tomei sozinho: slot canvas vazio (Canvas exige props de documento). Tema dark/light sem next-themes (matchMedia quebra jsdom).
Preocupações: navbar/statusbar auto=0px até 19–22
Bloqueio: —

## Task 19 — DONE_WITH_CONCERNS
Commit: `a9db23e`
Portões que EU rodei: suíte 85/608; typecheck 0; format:check 0; pickTooltipSide ausente de src/
Linhas do inventário: 0 checadas de 18 (Shortcut+Export) — UI existe, atalhos globais são Task 25
Decisões que tomei sozinho: **DROP pickTooltipSide** — Radix Tooltip já faz collision detection; não portei Tooltip.tsx nem tooltip.test.ts.
Preocupações: chrome não composto no AppShell (agentes proibidos de editar App.tsx)
Bloqueio: —

## Task 20 — DONE_WITH_CONCERNS
Commit: `532a8ce`
Portões que EU rodei: SchemaTree testa 500 linhas + selectTable; computeVirtualWindow reusado
Linhas do inventário: 0 de 0
Decisões que tomei sozinho: prova de 500 é teste jsdom (não 60fps). Camada desconhecida → `--layer-raw`.
Preocupações: não montado no slot tree
Bloqueio: —

## Task 21 — DONE_WITH_CONCERNS
Commit: `852c9fb`
Portões que EU rodei: Inspector.test verde
Linhas do inventário: 0 checadas de 13 (Panel:ColumnPanel+TableInfoPopover) — inspector mostra TableMeta, não é o ColumnPanel mutável
Decisões que tomei sozinho: omiti `TableMeta.has` (flag do ⓘ). tableMeta via prop.
Preocupações: ColumnPanel (mutação) é Task 23
Bloqueio: —

## Task 22 — DONE_WITH_CONCERNS
Commit: `4d4ccc1`
Portões que EU rodei: Outline.virtualize + syncEditorCanvas verdes; --syn-* no highlight
Linhas do inventário: 0 checadas de 28 (Editor+DbmlDiff) — drawer não montado
Decisões que tomei sozinho: CodeMirror via @uiw/react-codemirror 4.x + @codemirror/* 6.x
Preocupações: applyRenames reescrito no drawer; App.tsx não monta SourceDrawer
Bloqueio: —


## Task 23 — DONE_WITH_CONCERNS
Commit: `9621084`
Portões que EU rodei: panels+records+domains+projects 18/120; typecheck 0; format:check 0
Linhas do inventário: exercitadas em jsdom 93–126, 159–162; **não** marcadas no markdown (sem App ao vivo)
Decisões que tomei sozinho: "+ camada" usa TABLE_COLORS em vez de prompt hex; parsePagesCollapsed só reexportado.
Preocupações: TableInfoPopover não ligado ao ⓘ do TableNode
Bloqueio: —

## Task 24a — DONE_WITH_CONCERNS
Commit: `045f822`
Portões que EU rodei: mesmos
Linhas do inventário: 127–131, 157–158, 163–174 exercitadas em teste; não marcadas
Decisões que tomei sozinho: parseRecordsOpen relocado; loadRecordsOpen ficou no componente
Preocupações: useCollapsePersist não portado; painéis não montados
Bloqueio: —

## Task 24b — DONE_WITH_CONCERNS
Commit: `955bab2`
Portões que EU rodei: mesmos; token em useRef não state
Linhas do inventário: 132–156, 177–183 exercitadas em teste; não marcadas
Decisões que tomei sozinho: credencial nunca em useState
Preocupações: delete some em vez de disabled com 1 projeto (comportamento LDB); tokenUrl ainda diz LocalDrawDB
Bloqueio: —

## Task 25 — DONE_WITH_CONCERNS
Commit: `e3815d8`
Portões que EU rodei: `npx vitest run src/features/command-palette` → 45/45; `npm run test` → 107/771; `npm run typecheck` → 0; `npm run format:check` → 0; `npm run build` → 0 (46 módulos — App ainda não importa a paleta)
Linhas do inventário: 38 checadas de 38 atribuídas (1–38)
Decisões que tomei sozinho: navbar Export continua chip dbt stub — Task 25 Files não lista Navbar.tsx; ligar EXPORTERS no menu fica para o cutover 26. Save/import/autolayout são callbacks. Delete é opt-in (`removeSelectedRef`) para não duplicar o canvas. ⌘Y no listener e no overlay, não em `shortcutsFromCommands`.
Preocupações: paleta e overlay não compostos no App. `EXPORTERS` é `{ id, labelKey, extension?, dialect? }`, não Structura `ExporterContribution`. `CANVAS_GESTURES` ficou em PT (porte verbatim).
Bloqueio: —

## Task 26 — DONE_WITH_CONCERNS
Commit: `42c90d4`
Portões que EU rodei: `npm run test` → 113/793; `npm run typecheck` → 0; `npm run format:check` → 0; `npm run build` → 2573 módulos, JS 12 163 kB (antes ~46 / ~198 kB — `@xyflow/react` no grafo)
Linhas do inventário: 258 ☑ + 2 dropped / 260; 0 ☐
Decisões que tomei sozinho: AppGate como no LDB (`main` → DomainPicker | App). Estado do documento em `documentSlice`. Menu Export = `EXPORTERS` (lista `<ul>`, não Radix — jsdom). Fallback de cor `hsl(var(--card))`. Canvas mockado só em AppShell/Workspace tests. Não passei `removeSelectedRef` à paleta.
Preocupações: zoom da StatusBar só display; density não ligada ao LOD; Share/avatar no-op; bundle ~12 MB sem code-split; linhas Canvas de drag/hover ticked como “wired; no live RF in jsdom”
Bloqueio: —
