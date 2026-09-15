# S09 — Arestas mais quietas e notação configurável

**Onda:** 4 · **Depende de:** S01, S07 · **Pesquisa:** P2.2 · **Referências:** Oracle (Barker/IE), Liam (hairline)

## 1. Linguagem de arestas

| Tipo | Repouso | Hover / conectada à seleção | Foco/rastreio (S08) |
| --- | --- | --- | --- |
| FK | 1px `--rel-muted`, `smoothstep` raio 8 | 1.5px `--rel-fk` | 2px `--rel-active` |
| Linhagem de campo | 1px **mauve** (`--rel-lineage` passa a resolver para `--primary`) tracejado `4 3`, **sem animação** | 1.5px, tracejado | 2px, tracejado `6 4` + `lineage-flow` |
| Linhagem agregada (S01) | 1.5px mauve tracejado + rótulo pill `3 campos` 10px | 2px + tooltip com mapeamentos | igual |

- **Decisão de produto (2026-09-13): linhagem é mauve.** Em `globals.css`/`tailwind.config.ts`,
  `--rel-lineage` passa a apontar para o mauve (`--ctp-mauve`) nos dois temas. Como seleção também é
  mauve, o que distingue estado ativo de repouso é **espessura, tracejado e animação**, não cor.
  FK fica azul (`--rel-fk`) em IE e cinza (`--rel-muted`) em mínima. Atualizar `identity.md` §3 e §7.
- **Animação só em foco/rastreio.** Remova animação padrão de `LineageEdge`/`FieldLineageEdge`.
- Rótulos de aresta aparecem só em hover/seleção (exceto contagem da agregada).
- Arestas renderizam **abaixo** dos nós (`zIndex` 0) e a aresta em hover sobe para 1000.
- `prefers-reduced-motion`: nenhuma animação (já em `globals.css`; confirmar).

## 1.1 Precisão das relações (decisão de produto, 2026-09-13)

No protótipo aprovado a linha de FK saía com folga do nó e o terminal "flutuava". No produto a linha
de relação precisa ser **exata**:

- **Ancoragem na coluna:** sai do centro vertical da linha da coluna FK e chega no centro vertical
  da linha da coluna referenciada, ±1px. Nunca no meio do nó nem no cabeçalho quando as duas colunas
  estão visíveis.
- **Terminal encostado:** o marcador (pé de galinha / barra) toca a borda do nó, sem vão e sem
  sobrepor texto. O traço acaba onde o marcador começa.
- **Lado mais próximo:** cada ponta sai pela borda voltada para a outra tabela. Tabelas empilhadas
  na mesma coluna do layout usam o mesmo lado, com desvio horizontal fixo de 24px.
- **Traçado ortogonal** (`smoothstep`, raio 8) para FK, saindo horizontal por ≥ 12px antes de
  dobrar. Linhagem continua curva.
- **Coluna fora da área visível** (lista rolada ou nível que a esconde): a ponta vai para a borda
  superior/inferior da lista, na direção da coluna, com seta pequena de "continua". Não cair no
  cabeçalho.
- **Várias relações na mesma coluna:** pontas espalhadas 4px na vertical, dentro da altura da linha.
- **Arrasto e rolagem:** ancoragem recalculada no mesmo quadro, reusando `useColumnEdgeCoords` /
  `columnHandleGeometry` (não reescrever).

Gates adicionais (somam aos da §3):
9. Cypress `edges-precision.cy.ts`: 5 FKs da fixture, |y da ponta − centro da `.col-row`| ≤ 1px nas
   duas pontas.
10. Cypress: x da ponta == borda do nó ±1px, nas duas pontas.
11. Cypress: rolar a lista de uma tabela de 187 colunas até esconder a coluna FK → ponta na borda da
    lista, não no cabeçalho.
12. Cypress: arrastar o nó 200px → após `pointerup`, gates 9 e 10 continuam válidos.

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

## 3. Gates (12 — 1–8 abaixo, 9–12 em §1.1)
1. Vitest `edgeMarkers.test.ts`: mapa (notação, cardinalidade, nullable) → id de marker, 12 casos.
2. Cypress `edges-style.cy.ts`: aresta FK em repouso tem `stroke-width` 1.
3. Cypress: nenhuma aresta com `animation-name` ≠ `none` sem foco.
4. Cypress: hover numa FK → `stroke-width` 1.5 e rótulo visível.
5. Cypress: trocar notação para Barker → `marker-end` muda de id.
6. Cypress: aresta agregada mostra "3 campos".
7. `canvas-edges.cy.ts` e `handle-connect-smoke.cy.ts` verdes sem alterar asserções.
8. `cy:run:stress` verde; FPS do pan no diagrama de 200 tabelas não piora (>= valor da baseline
   medida antes da mudança, registrar ambos).
