# S04 — Árvore navega, busca e visibilidade por tabela

**Onda:** 2 · **Depende de:** S02 · **Pesquisa:** P0.2 · **Referência:** sidebar do Liam ERD

## 1. Comportamento

| Gesto na linha da tabela | Efeito |
| --- | --- |
| clique | `selectTable(id)` **e** `focusTableWithPan(id)` (já existe em `useWorkspace.ts`) |
| duplo clique | igual ao clique + abre Inspector (se fechado) |
| `⌥/Alt` + clique | adiciona à seleção múltipla sem pan |
| hover | ícone de **olho** aparece à direita; linha com `--surface-hover` |
| clique no olho | alterna tabela oculta no canvas |
| teclado | ↑/↓ move, Enter = clique, Espaço = olho |

Topo do painel: campo **Filtrar tabelas** (filtra por substring no nome, case-insensitive, destaca o
trecho) e menu `⋯` com **Mostrar todas** / **Ocultar todas** / **Ocultar não selecionadas**.
Rodapé: `N tabelas · M ocultas`.

Tabela oculta: linha com nome em `--muted-foreground` e olho riscado. Arestas ligadas a ela somem.

## 2. Estado

Novo `src/features/schema/store/viewSlice.ts` (registrar em `store/index.ts`):

```ts
hiddenTableIds: string[];
toggleTableHidden(id: string): void;
setHiddenTables(ids: string[]): void;
showAllTables(): void;
```

Não persiste no DBML nesta spec (S11 persiste por view). Não persiste em localStorage.

`useCanvasNodes.ts` filtra nós em `hiddenTableIds`; `useCanvasEdges.ts` descarta arestas cujo
source/target está oculto — **faça o filtro de arestas em `useCanvasNodes` exportando o conjunto de
ids visíveis e consumindo-o no Canvas**, para não tocar `useCanvasEdges.ts` (dono S01 na onda 1;
S08 na onda 4). Se isso for impossível, reporte.

Selecionar pela árvore uma tabela oculta a torna visível antes do pan.

## 3. Props
`SchemaTreeProps` ganha `onFocusTable(id)`, `onOpenInspector()`. Montado em `LeftPanel` (S02) com
`ws.focusTableWithPan`. **Dono do mount: S04**, gate 1.

## 4. Gates (8)
1. Cypress `tree-navigation.cy.ts`: com viewport longe, clicar tabela na árvore → nó dentro do
   viewport e `.selected`.
2. Cypress: filtrar "ped" → só linhas contendo "ped".
3. Cypress: olho → nó some do canvas; **DBML inalterado** (visibilidade é visual).
4. Cypress: "Mostrar todas" → todos os nós de volta.
5. Cypress: clicar numa tabela oculta → reaparece e recebe foco.
6. Vitest `viewSlice`: toggle, setHidden, showAll.
7. Vitest `SchemaTree`: Enter chama `onFocusTable`; Espaço chama toggle.
8. Linha do inventário "tree click" (se existir) atualizada; `dead-affordances.md` item removido.
