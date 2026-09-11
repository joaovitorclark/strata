# Plan 3 run log

Orchestrator log for canvas verification (Tasks 35–42). One entry per task.
Baseline inventory (honest, after Wave M Task 30): **201 ☑ · 57 ☐ · 2 dropped**.

Pré-requisito Task 34b: `90b8d29` (SHA recorded in `ed52f66`).

---

## Task 35 — VERDE
Commit: `0d13647`
Portões que EU rodei: `npm run test` → 125 files / 875 tests; `npm run format:check` → 0; `npm run build` (typecheck + vite) → 0; `npm run e2e:serve` :5174 + `npm run cy:run` → boot-smoke 1 passing (912ms)
Linhas do inventário: n/a (scaffold; nenhuma linha marcada)
Decisões que tomei sozinho: matei LocalDrawDB residual na :5174 antes do Cypress (senão o spec batería no produto errado); `files.ts` `getDataDir()` ganhou o mesmo fallback `STRATA_*` (senão o rename era no-op sem slug); negação no `.gitignore` para `data/` não engolir `cypress/fixtures/data/`; `cy.dragNode` é stub que lança (Task 36 implementa); POST import + PUT porque import não persiste.
Preocupações: aviso Cypress 15 `allowCypressEnv` (config do plano verbatim); `git check-ignore -v` sai 0 na negação mas os 8 arquivos entram no índice; plano dizia 34 files em `server/`, hoje 37; `/?project=` o app ainda não honra — `activeId` commitado = smoke.
Bloqueio: —

## Task 36 — VERDE
Commit: `baf5f6c`
Portões que EU rodei: `npx cypress run --spec cypress/e2e/node-drag-smoke.cy.ts` → PASS (881ms); quebra deliberada `mousedown`→`pointerdown` (orquestrador, não o relatório) → FAIL `expected 700 to be close to 820 +/- 4` (nó não moveu); restore → PASS (882ms); `npm run cy:run` → boot-smoke + node-drag-smoke 2 passing
Linhas do inventário: n/a (guarda do helper; nenhuma linha marcada)
Decisões que tomei sozinho: o helper literal do plano era insuficiente no Cypress 15 (sem `event.view`, `window.trigger` não é EventTarget, zoom do InitialFit, `nodeDragThreshold=4`). Extras só de mouse, autorizados pelo brief. Não reescrevi o Canvas.
Preocupações: `cy.dragNode(dx,dy)` está em unidades de flow/translate, não pixels de tela. Tasks 37/39 têm de usar este helper como está. Aviso `allowCypressEnv` continua.
Bloqueio: — (Onda P não começa até o humano liberar)

## Task 37 — VERDE (com omissão honesta)
Commit: `47156e6`
Portões que EU rodei: `npm run cy:run` → 22 passing (canvas-selection, canvas-drag, canvas-edges FK, canvas-layer-edge, canvas-lod, canvas-peek). Linhagem L1 **omitida**.
Linhas do inventário: n/a (Task 40 ticks). Candidatas: 72, 64, 57. Não 73 (sem scroll do editor), não 46 (Escape só tabela), não 76 (só zoom, sem fit/lock).
Decisões que tomei sozinho: LayersPanel cobria Zoom Out — `collapseLayersPanel` + `click({force:true})`. "Mostrar linhagem" liga o checkbox; `rf__edge-lin:` não aparece porque `TableNode` não monta `LineagePorts` (LocalDrawDB monta). Spec encolheu; Canvas não foi reescrito.
Preocupações: gap de port vs `$LDB` em `LineagePorts`.
Bloqueio: —

## Task 38 — VERDE
Commit: `bf0e8d0`
Portões que EU rodei: `npm run cy:run` → shell-command-palette 8, shell-export-menu 1, shell-focus-visibility 1, shell-shortcuts 4 (todos pass).
Linhas do inventário: n/a (Task 40). Candidata 193. 29–30 live (palette → canvas + drawer). 35 omitida (Workspace não passa `removeSelectedRef`).
Decisões que tomei sozinho: `data-testid` só no chrome; RecordsPanel só existe com tabela selecionada; focus-visibility = botões do navbar/rail/status, não o navbar inteiro.
Preocupações: —
Bloqueio: —

## Task 39 — VERMELHO no node-height (premissa cumprida)
Commit: `d1a2302`
Portões que EU rodei: `npm run cy:run:stress` → large 3/3, wide 3/3, node-height 0/1.
Linhas do inventário: n/a (Task 40).
Decisões que tomei sozinho: fixture `large` tem 200 tabelas; Canvas usa `<= MINIMAP_MAX_TABLES` / `<= SKIP_INITIAL_FIT_TABLES`, então minimap **aparece** e fitView **roda** (zoom 0.25). Spec observou o `<=`, não reescreveu Canvas. Filtro `_at` trocado por `c18`. Scroll 80px (overscan) — 500px desmontava o handle e a aresta. Altura: spec permanece vermelho.
Tabela node-height (suite completa):

| id | state | offsetHeight | predicted | delta |
| --- | --- | --- | --- | --- |
| wide.hub | sigil | 34 | 34 | 0 |
| wide.hub | keys | 113 | 110 | **3** |
| wide.hub | full | 312 | 410 | **-98** |
| wide.left | sigil | 34 | 34 | 0 |
| wide.left | keys | 111 | 110 | 1 |
| wide.left | full | 111 | 110 | 1 |
| wide.right | sigil | 34 | 34 | 0 |
| wide.right | keys | 111 | 110 | 1 |
| wide.right | full | 111 | 110 | 1 |

Corrida isolada anterior: hub/full **181** (−229). Altura full não é estável. TableNode/nodeMetrics **não** alterados.
Preocupações: `cy:run:stress` não fica verde enquanto o spec de altura existir — isso é o ponto da premissa.
Bloqueio: —

## Task 40 — VERDE (contagem honesta, abaixo do Plan 2)
Commit: `d763061`
Portões que EU rodei: inventário relido contra specs que **rodaram**.
Linhas: ☑ **57, 64, 72, 193** (nome do spec no campo Verified). Dropped **35, 44, 45**. Remaining ☐ each with a reason.
```
Baseline (after Wave M task 30):  ☑ 201   ☐ 57   dropped 2
After Plan 3 Task 40:             ☑ 205   ☐ 50   dropped 5
```
Plan 2 claimed 258 ☑. **205 is lower.** That is the plan working.
Decisões: não tiquei 73 (click sem scroll do editor), 46 (Escape só tabela), 76 (só zoom). 1–7/29–34/36–38 já eram ☑ jsdom; ganharam o nome do spec live sem mudar a contagem.
Bloqueio: —

## Task 41 — BLOCKED (ambiente)
Commit: *(este commit)*
Portões que EU rodei: host `Darwin` (uname -s); `node -v` = **v24.5.0** (o pin do pacote Windows é **22.11.0** em `scripts/build-win/fetchNode.mjs`); nvm local só tem v23.5.0 — **22.11.0 não está instalado**. `dist-win/LocalDrawDB-win.zip` existe (104.5 MB, Plan 2 Task 28) mas **não foi lançado**. Não há `.github/workflows`. Não há wine. Não há máquina/VM/runner Windows neste ambiente.
Não reconstruí o zip neste host: gerar o blob SEA com Node 24.5.0 contra `node.exe` 22.11.0 é o crash `STATUS_ACCESS_VIOLATION` que o README descreve.
O gate da Task 28 (**o artefato portátil corre**) **não está satisfeito**. Verificação bloqueada em ambiente, não em silêncio.
Bloqueio: Darwin + Node 24.5.0 ≠ 22.11.0 + ausência de Windows.

## Task 42 — VERDE (só mediu; sem code splitting)
Commit: *(este commit)*
Portões que EU rodei: `npm run build` (typecheck + vite) → 0. Um único JS chunk.

Chunks > 200 KB gzip:

| ficheiro | raw | gzip |
| --- | --- | --- |
| `dist/assets/index-DxBFXPVz.js` | 12 165.28 kB | **2 134.06 kB** |

`dist/assets/index-DTfDYkf3.css` = 62.19 kB / gzip 11.97 kB (abaixo do limiar). `vite.config.ts` não define `manualChunks`.

As quatro bibliotecas pedidas estão **no mesmo chunk** `index-DxBFXPVz.js` (probes no bundle minificado: `react-flow__node`/`xyflow`, `sp_addextendedproperty`/`@dbml`, `XLSX`/`xlsx`, `CodeMirror`/`EditorView`).

Nota: um único payload de ~2.1 MB gzip no first load é o custo de canvas + parser + editor + export Excel no mesmo grafo. Separar `@xyflow/react` (canvas), `@uiw/react-codemirror` (gaveta, on-demand), `xlsx` (só no export) e `@dbml/core` (parse) reduziria o parse inicial; **não foi feito neste plano** — seria uma decisão de performance, não de verificação.
Bloqueio: —





