# S09 — Arestas mais quietas e notação configurável

**Onda:** 4 · **Depende de:** S01, S07 · **Pesquisa:** P2.2 · **Referências:** Oracle (Barker/IE), Liam (hairline)

## 1. Linguagem de arestas

| Tipo | Repouso | Hover / conectada à seleção | Foco/rastreio (S08) |
| --- | --- | --- | --- |
| FK | 1px `--rel-muted`, `smoothstep` raio 8 | 1.5px `--rel-fk` | 2px `--rel-active` |
| Linhagem de campo | 1px `--rel-lineage` tracejado `4 3`, **sem animação** | 1.5px, tracejado | 2px `--rel-active` + `lineage-flow` |
| Linhagem agregada (S01) | 1.5px `--rel-lineage` tracejado + rótulo pill `3 campos` 10px | 2px + tooltip com mapeamentos | igual |

- **Animação só em foco/rastreio.** Remova animação padrão de `LineageEdge`/`FieldLineageEdge`.
- Rótulos de aresta aparecem só em hover/seleção (exceto contagem da agregada).
- Arestas renderizam **abaixo** dos nós (`zIndex` 0) e a aresta em hover sobe para 1000.
- `prefers-reduced-motion`: nenhuma animação (já em `globals.css`; confirmar).

## 2. Notação
Configuração por projeto em `localStorage` (`strata.notation.<projectId>`, try/catch). **Não**
criar bloco novo no DBML nesta spec — persistir no modelo é decisão de produto em aberto
(`ux-ui-research.md` §5).

| Valor | Terminais | Padrão |
| --- | --- | --- |
| `ie` (Information Engineering / crow's foot) | um: `‖`, zero-ou-um: `o‖`, muitos: `>` com barra, zero-ou-muitos: `o<` | ✓ |
| `barker` | tracejado no lado opcional, pé de galinha no "muitos" | |
| `minimal` | só seta no lado referenciado (estilo Liam) | |

Cardinalidade vem do `ParsedRef` (`>`, `<`, `-`, `<>`) e da nulidade da coluna FK (nullable →
opcional). Implementar marcadores em `EdgeMarkers.tsx` como `<marker>` SVG com `id` por notação ×
cardinalidade × estado (repouso/ativo), cor via `currentColor`.

UI: item "Notação ▸ IE / Barker / Mínima" no menu Exibição (dropdown `EdgeVisibility` da pill — S02).
Esta é a única edição permitida em `EdgeVisibility.tsx`.

## 3. Gates (8)
1. Vitest `edgeMarkers.test.ts`: mapa (notação, cardinalidade, nullable) → id de marker, 12 casos.
2. Cypress `edges-style.cy.ts`: aresta FK em repouso tem `stroke-width` 1.
3. Cypress: nenhuma aresta com `animation-name` ≠ `none` sem foco.
4. Cypress: hover numa FK → `stroke-width` 1.5 e rótulo visível.
5. Cypress: trocar notação para Barker → `marker-end` muda de id.
6. Cypress: aresta agregada mostra "3 campos".
7. `canvas-edges.cy.ts` e `handle-connect-smoke.cy.ts` verdes sem alterar asserções.
8. `cy:run:stress` verde; FPS do pan no diagrama de 200 tabelas não piora (>= valor da baseline
   medida antes da mudança, registrar ambos).
