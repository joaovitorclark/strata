# UX/UI rework — índice das specs

**Origem:** [`docs/ux-ui-research.md`](../../../ux-ui-research.md) · **Branch base:** `research/ux-ui-proposal`
**Executor:** um agente orquestrador que despacha subagentes. Estas specs foram escritas para isso:
cada uma é **auto-suficiente**, tem **arquivos donos** declarados e **gates contáveis**.

---

## 1. Regras globais (valem para TODAS as specs)

Leia `AGENTS.md` inteiro antes de começar. Resumo do que mais quebra:

1. **Uma mutação é verificada pela mudança no DBML**, não por classe CSS ou valor de store.
2. **Nunca adapte uma asserção de teste existente** para passar. Teste vermelho = código errado.
   Exceção: a spec diz explicitamente que aquele comportamento mudou (ex.: S01 remove linhagem de
   tabela) — então o teste é **removido ou reescrito e isso é listado no relatório**.
3. **Não reconstrua o que existe**: virtualização de colunas, `focusTableInView`, `resolveLod`,
   edge peek, `Pins {}`. Reutilize.
4. **`src/components/ui/` é gerado pelo shadcn CLI.** Nunca editar à mão. Precisa de um componente
   novo? `npx shadcn@latest add <nome>`.
5. **Toda string visível passa por i18n** (`src/i18n/locales/pt-BR.json` e `en.json`, ambas).
6. **Quem cria um componente declara quem o monta**, e a tarefa que monta carrega o gate.
7. **Nada de "Macchiato"/"Latte" em `src/`.** Temas são `dark` e `light`.
8. **Cores só por token** (`hsl(var(--token))` / classes Tailwind do config). Nenhum hex em `src/`.
9. jsdom não dirige React Flow nem Radix: gesto de canvas → **Cypress**; lógica pura → **Vitest**.
   Todo helper Cypress que simula gesto precisa de um spec-guarda que o quebra de propósito.

## 2. Comandos de verificação

Toda spec termina rodando, nesta ordem, e o relatório cola o resumo de cada um:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test            # Vitest
npm run build
npm run e2e:serve &     # em outro processo
npm run cy:run          # smoke
```

`cy:run:stress` só nas specs que mexem no nó ou nas arestas (S01, S05, S07, S08, S09).

## 3. Mapa de specs, dependências e donos de arquivos

| Spec | Título | Depende de | Arquivos donos (só esta spec edita durante sua onda) |
| --- | --- | --- | --- |
| [S01](../2026-09-13-field-lineage-only-design.md) | Linhagem só de campo | — | `schema/model/**` (lineage), `server/model.ts`, `server/dbmlIo.ts`, `canvas/components/{ColumnRow,LineagePorts,LineageEdge,FieldLineageEdge}.tsx`, `canvas/hooks/useCanvasEdges.ts`, `canvas/utils/{autolayout,pageFilter,lineageHandles}.ts`, `schema/store/interactionSlice.ts` |
| [S02](01-frame-chrome.md) | Chrome no frame + pill do canvas | — | `shell/Workspace.tsx`, `shell/Navbar.tsx`, `shell/StatusBar.tsx`, `shell/AppShell.tsx`, `canvas/toolbar/**` (novo), `panels/{StatusLog,ProblemsPanel,LayersPanel,ColumnPanel}.tsx` (só wrappers/props) |
| [S03](02-dead-controls.md) | Controles mortos e seleção | S01, S02 | `canvas/components/Canvas.tsx`, `canvas/toolbar/ZoomControls.tsx`, `shell/StatusBar.tsx` |
| [S04](03-tree-navigation.md) | Árvore navega + visibilidade | S02 | `shell/SchemaTree.tsx`, `shell/LeftPanel.tsx`, `schema/store/viewSlice.ts` (novo), `canvas/hooks/useCanvasNodes.ts` |
| [S05](04-detail-level.md) | Nível de detalhe explícito | S01, S02 | `canvas/utils/lod.ts`, `canvas/toolbar/DetailLevelSelect.tsx`, `schema/store/interactionSlice.ts`, `canvas/components/{TableNode,TableColumnList}.tsx`, `canvas/hooks/useCanvasEdges.ts` (só a chamada de `resolveLod`) |
| [S06](05-shareable-url.md) | Estado na URL + Copiar link | S03, S04, S05 | `shell/urlState.ts` (novo), `shell/useUrlSync.ts` (novo), `shell/Navbar.tsx`, `shell/Workspace.tsx` (só o mount do hook) |
| [S07](06-table-node.md) | Nó da tabela redesenhado | S05 | `canvas/components/{TableNode,ColumnRow,TableColumnList}.tsx`, `canvas/components/columnGlyphs.tsx` (novo) |
| [S08](07-focus-mode.md) | Modo foco + rastreio de campo | S01, S04, S07 | `canvas/utils/focusGraph.ts` (novo), `schema/store/focusSlice.ts` (novo), `canvas/toolbar/FocusControls.tsx`, `canvas/hooks/{useCanvasNodes,useCanvasEdges}.ts` |
| [S09](08-edges-notation.md) | Arestas e notação | S01, S07 | `canvas/components/{RelationEdge,EdgeMarkers,FieldLineageEdge}.tsx`, `canvas/components/edgeClasses.css` |
| [S10](09-inspector.md) | Inspector | S01, S07 | `shell/Inspector.tsx`, `shell/inspector/**` (novo), `schema/model/edit.ts` (só funções novas) |
| [S11](10-views.md) | Views (subject areas) | S04, S05, S06 | `schema/model/views.ts` (novo), `schema/model/{blocks,dbmlClean,organize}.ts` (registro do bloco), `canvas/toolbar/ViewTabs.tsx`, `schema/store/viewSlice.ts`, `shell/SchemaTree.tsx` |
| [S12](11-minimap-empty-state.md) | Mini-mapa + estado vazio | S02 | `canvas/toolbar/MiniMapToggle.tsx`, `shell/EmptyState.tsx` (novo), `shell/Workspace.tsx` (só o mount) |

Caminhos relativos a `src/features/` salvo quando começam com `server/`.

**Edições compartilhadas permitidas** (triviais, qualquer spec): registrar slice em
`schema/store/index.ts`, adicionar chaves em `src/i18n/locales/*.json`, adicionar entradas no
`ShortcutsOverlay`/`gestures.ts`, atualizar `docs/parity-inventory.md`. Em conflito de merge nesses
arquivos, o orquestrador resolve mantendo as duas adições.

## 4. Ondas (o que pode rodar em paralelo)

```
Onda 1  ─ S01 ║ S02                      (sem arquivos em comum)
Onda 2  ─ S03 ║ S04 ║ S05                (S02 deixou slots separados na pill)
Onda 3  ─ S06 ║ S07                      (S06 só Navbar/urlState; S07 só nó)
Onda 4  ─ S08 ║ S09 ║ S10
Onda 5  ─ S11 ║ S12
```

Se dois subagentes da mesma onda precisarem tocar o mesmo arquivo fora da coluna "donos", **parem e
reportem** ao orquestrador — não resolvam sozinhos.

## 5. Formato do relatório de cada subagente

```
SPEC: Sxx
STATUS: done | blocked
COMMITS: <hashes>
GATES: <n>/<total> — lista, cada um com o teste que prova
TESTES REMOVIDOS/REESCRITOS: <lista com motivo> | nenhum
COMANDOS: typecheck ✓ lint ✓ format ✓ test ✓ (N passed) build ✓ cy:run ✓ (N passed)
DESVIOS DA SPEC: <lista> | nenhum
ARQUIVOS FORA DOS DONOS: <lista> | nenhum
```

## 6. Inventário de paridade

Toda linha de `docs/parity-inventory.md` invalidada por uma spec vira
`dropped — superseded by <Sxx>` **na mesma mudança**. Nenhuma linha some.
