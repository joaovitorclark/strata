# S05 — Nível de detalhe explícito (display level)

**Onda:** 2 · **Depende de:** S01, S02 · **Pesquisa:** P1.1 · **Referências:** Liam `show:`, erwin Display Levels

## 1. Decisão
O **usuário escolhe** o nível de detalhe. O zoom **não troca mais o conteúdo**; ele só troca a
*renderização* abaixo de um limiar (performance).

## 2. Níveis

| `DetailLevel` | Rótulo pt-BR | Conteúdo do nó | Mapeia para `LodState` atual |
| --- | --- | --- | --- |
| `name` | Nome | cabeçalho + contagem | `sigil` |
| `keys` *(padrão)* | Chaves | PK, FKs, fixadas, **colunas com linhagem de campo** | `keys` |
| `columns` | Colunas | todas (virtualizadas) | `full` |
| `docs` | Documentação | cabeçalho + nota da tabela + colunas **que têm `note`**, cada uma com a nota em 11px abaixo do nome, truncada em 2 linhas | novo `docs` |

## 3. Regras de resolução

Substituir `resolveLod(zoom, opts)` por:

```ts
export type LodState = "sigil" | "keys" | "full" | "docs";
export function resolveLod(
  zoom: number,
  opts: { level: DetailLevel; pinned?: LodState; selected?: boolean },
): { state: LodState; simplified: boolean }
```

1. `pinned` (override por nó, já existe em `nodeLod`) vence.
2. `selected` e `level ∈ {name, keys}` → `full`.
3. senão → mapa da tabela acima.
4. `simplified = zoom < LOD_SIMPLIFY_BELOW` (`0.35`). Simplificado: nomes de coluna viram barras
   cinza de 6px (sem texto), cabeçalho mantém nome. **Altura idêntica** ao estado não simplificado —
   o layout não pula.

`LOD_SIGIL_BELOW` e `LOD_FULL_ABOVE` deixam de ser usados para decidir estado; remova-os se nenhum
consumidor sobrar (grep), senão mantenha marcados `@deprecated`.

`keyColumns` passa a incluir colunas presentes em `lineageFields` como source ou target daquela
tabela (recebe `lineageColumns: readonly string[]` como parâmetro — mantém a função pura).
`lodHeight` ganha o caso `docs`; o cálculo deve bater com o que `TableColumnList` pinta (gate).

S01 decide aresta agregada vs de campo pelo LOD: `sigil` → agregada; `keys`/`full`/`docs` → por
campo **se as duas colunas estão visíveis no nó**, senão a aresta ancora no cabeçalho do nó.

## 4. Estado e controle
- `interactionSlice`: `detailLevel: DetailLevel` (padrão `keys`), `setDetailLevel`.
- Persistência: `localStorage` chave `strata.detailLevel` com try/catch (S06 sobrescreve pela URL;
  S11 por view).
- `DetailLevelSelect.tsx` na pill: `Detalhe: Chaves ▾` com `DropdownMenuRadioGroup`. Atalhos `1`
  `2` `3` `4` (sem modificador, ignorados em inputs), registrados no `ShortcutsOverlay`.
- Menu `⋯` do nó: "Fixar nível ▸ Nome/Chaves/Colunas/Documentação/Seguir global".
- Trocar nível dispara `node-settle` (180ms, já existe) e `updateNodeInternals` dos nós visíveis.
- Autolayout usa o nível atual.
- Antes de registrar `1`–`4`, verifique conflito em `command-palette/` e `ShortcutsOverlay`; se houver, reporte e use `⌥1`–`⌥4` (`⇧1` é o fit de S03).
- Atualize a chamada de `resolveLod` em `useCanvasEdges.ts` (decisão agregada vs campo, de S01) para a nova assinatura — única edição permitida nesse arquivo.

## 5. Gates (10)
1. Vitest `lod.test.ts`: tabela de verdade 4 níveis × {selected, pinned, nenhum} = 12 casos.
2. Vitest: `simplified` true só abaixo de 0.35, independente do nível.
3. Vitest: `keyColumns` inclui coluna com linhagem.
4. Vitest: `lodHeight("docs")` para tabela com 3 notas.
5. Cypress `canvas-detail-level.cy.ts`: selecionar "Colunas" → nó com 12 colunas mostra 12 linhas.
6. Cypress: "Nome" → nenhuma `.col-row` no DOM.
7. Cypress: zoom 0.3 → mesmo número de `.col-row` que em zoom 1 (conteúdo não mudou).
8. Cypress: altura renderizada do nó == `lodHeight` ±1px nos 4 níveis (reusar `heightSample.ts`).
9. Cypress: tecla `3` → nível Colunas; tecla `3` com foco num input → nada.
10. `cy:run:stress` verde (187 colunas em "Colunas" continua virtualizado: ≤ 30 `.col-row` no DOM).
