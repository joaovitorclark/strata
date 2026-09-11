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
