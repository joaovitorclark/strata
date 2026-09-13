# S08 — Modo foco e rastreio de campo

**Onda:** 4 · **Depende de:** S01, S04, S07 · **Pesquisa:** P1.3
**Diferencial:** nem erwin nem Liam rastreiam um campo bronze → silver → gold.

## 1. Comportamento

### 1.1 Foco de tabela
- Ativar: tecla `F` com uma ou mais tabelas selecionadas, ou botão `◎ Foco` na pill.
- Mostra as tabelas selecionadas + vizinhas até **N saltos** (padrão 1). Resto: `opacity: 0.15`,
  `pointer-events: none`, arestas do resto ocultas.
- Pill em foco: `◎ Foco · 1 salto ▾ · Ambos ▾ · ✕`.
  - Saltos: 1, 2, 3, ∞. Atalhos `[` e `]`.
  - Direção: **Upstream** (de onde vêm), **Downstream** (quem depende), **Ambos**.
  - Tipo de ligação considerado: FK, Linhagem, Ambos (segue a visibilidade de arestas da pill).
- Sair: `Esc` (depois dos dois estágios de S03, ou seja, só quando não há seleção de coluna), `F`,
  ou `✕`. Sair não mexe no viewport.
- Ao ativar: `fitView` só nos nós em foco, `duration: 250`, padding igual ao fit de S02.

Direção para FK: upstream = tabelas **referenciadas** pela tabela (ela tem a FK); downstream = quem a
referencia. Para linhagem: upstream = sources dos mapeamentos cujo target é a tabela.

### 1.2 Rastreio de campo
- Ativar: clicar numa coluna que tem linhagem (glifo ⇢ de S07) e pressionar `T`, ou item "Rastrear
  linhagem do campo" no menu de contexto da linha.
- Calcula o **fecho transitivo** dos mapeamentos de campo nos dois sentidos a partir de
  `(tabela, coluna)`.
- Canvas: foco nas tabelas do caminho; nessas tabelas, colunas **fora** do caminho ficam com
  `opacity .35`; colunas do caminho recebem fundo `--rel-lineage/15`. Nós no caminho são forçados
  para `full` **só enquanto o rastreio dura** (pin temporário, não grava `nodeLod`).
- Arestas do caminho: `--rel-active` 2px com a animação `lineage-flow` (única animação ligada).
- Pill: `⇢ cliente_id · 5 campos em 3 tabelas · ✕`.
- Painel lateral (Inspector, seção de S10 se já existir; senão só pill): lista ordenada
  topologicamente `bronze.raw.cust_id → silver.cliente.id → gold.dim_cliente.cliente_id`, cada item
  clicável (pan).
- Ciclos: detectar e parar; exibir `⚠ ciclo` na pill.

## 2. Módulo puro

`src/features/canvas/utils/focusGraph.ts` (sem React):

```ts
type Direction = "up" | "down" | "both";
type LinkKind = "fk" | "lineage" | "both";
export function focusTables(input: {
  seeds: string[]; hops: number | "all"; direction: Direction; kind: LinkKind;
  refs: ParsedRef[]; lineageFields: ParsedFieldLineage[]; hidden?: ReadonlySet<string>;
}): Set<string>;
export function traceField(input: {
  table: string; column: string; lineageFields: ParsedFieldLineage[];
}): { columns: Array<{ table: string; column: string; depth: number }>; edges: string[]; cycle: boolean };
```

BFS, O(V+E). `depth` negativo = upstream, positivo = downstream.

## 3. Estado
`interactionSlice` ou novo `focusSlice.ts` (preferir novo, dono S08):
`focus: null | { kind: "tables"; seeds; hops; direction } | { kind: "field"; table; column }`.
Consumido em `useCanvasNodes` (opacidade/pin temporário) e `useCanvasEdges` (ocultar/destacar).

## 4. Gates (11)
1. Vitest `focusGraph.test.ts`: cadeia A→B→C→D com hops 1/2/all e direções up/down/both = 9 casos.
2. Vitest: kind `fk` ignora linhagem e vice-versa.
3. Vitest: `traceField` em bronze→silver→gold com um ramo lateral → 5 colunas, depths corretos.
4. Vitest: ciclo A.x→B.y→A.x → `cycle: true`, termina.
5. Vitest: 200 tabelas / 2000 mapeamentos em < 20ms.
6. Cypress `focus-mode.cy.ts`: selecionar tabela, `F` → vizinhas com opacity 1, outras 0.15.
7. Cypress: `]` → 2 saltos, mais tabelas em opacity 1.
8. Cypress: Esc sai; todas opacity 1.
9. Cypress: rastrear campo → arestas do caminho têm classe ativa e só elas animam.
10. Cypress: rastreio não altera **DBML** nem `nodeLod` persistido (Pins/estado inalterados ao sair).
11. `cy:run:stress`: ativar foco no diagrama de 200 tabelas em < 300ms (medir com `performance.now`).
