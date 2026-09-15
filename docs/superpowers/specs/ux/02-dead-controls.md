# S03 — Controles mortos e seleção por arrasto

**Onda:** 2 · **Depende de:** S01, S02 · **Pesquisa:** P0.3 · **Fonte:** `docs/dead-affordances.md`

## 1. Escopo

| # | Controle | Hoje | Depois |
| --- | --- | --- | --- |
| 1 | Zoom na pill (`ZoomControls.tsx`) | placeholder de S02 | `−`/`+` chamam `zoomOut/zoomIn({duration:150})`; `%` mostra `Math.round(zoom*100)` lido de `useStore(s => s.transform[2])`; clicar no `%` abre menu 50/75/100/150/200 e "Ajustar"; `⛶` = fit |
| 2 | Zoom da status bar | `zoomPercent={100}` fixo, `−/+` sem handler | **remover** zoom da status bar (a pill é o lugar único). Remova props `zoomPercent/onZoomIn/onZoomOut/onFitView` do `StatusBar` |
| 3 | Seleção por arrasto | `selectionOnDrag` inerte porque `panOnDrag` é `true` | `panOnDrag={[1, 2]}` (botão do meio/direito), `selectionOnDrag`, `panOnScroll` **false**, `zoomOnScroll` true; **Espaço segurado** ativa pan com botão esquerdo (cursor `grab`) |
| 4 | Esc em dois estágios (linha 46 do inventário) | listener de captura na command palette limpa tabela no 1º Esc | 1º Esc limpa coluna selecionada; 2º limpa tabela. O listener da palette só age com a palette **aberta** |
| 5 | Atalhos de zoom | — | `⌘/Ctrl +`, `⌘/Ctrl −`, `⇧1` fit, `⌘/Ctrl 0` = 100%. Registrar no `ShortcutsOverlay` |

## 2. Detalhes

- Espaço: `keydown` em `window` com guarda — ignorar se `event.target` é input/textarea/
  contentEditable ou se o drawer de código tem foco. Estado local no `Canvas` → `panOnDrag={space ?
  true : [1,2]}` e `selectionOnDrag={!space}`.
- Trackpad macOS: pinça continua zoom (`zoomOnPinch`), dois dedos continuam pan → isso exige
  `panOnScroll` **true** em mac. Use `isMacOs()` (já existe em `Canvas.tsx`): mac → `panOnScroll`
  true e `zoomOnScroll` false; outros → inverso.
- Atualize `gestures.ts` (overlay de atalhos) para descrever o comportamento real.
- Linha 43 e 46 do `parity-inventory.md` → `☑` com o spec Cypress.

## 3. Gates (8)
1. Cypress `canvas-zoom.cy.ts`: clicar `+` → texto `%` aumenta e `transform` do viewport muda.
2. Cypress: menu `%` → "100%" → `transform[2] === 1`.
3. Cypress: `⌘/Ctrl 0` → 100%.
4. Cypress `canvas-rubber-band.cy.ts`: arrastar retângulo sobre 3 tabelas com botão esquerdo → 3
   nós com `.selected`; + spec-guarda com `panOnDrag` forçado `true` que falha.
5. Cypress: Espaço + arrasto → viewport transladou, nenhum nó selecionado.
6. Cypress: selecionar coluna, Esc → coluna limpa e tabela ainda selecionada; Esc → tabela limpa.
7. `grep -n "zoomPercent" src/features/shell` → 0.
8. Vitest: guarda do Espaço ignora eventos vindos de `input` e `textarea`.
