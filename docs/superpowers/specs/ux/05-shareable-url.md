# S06 — Estado do diagrama na URL + Copiar link

**Onda:** 3 · **Depende de:** S03, S04, S05 · **Pesquisa:** P1.2 · **Referência:** Liam `?showMode=…&active=…`

## 1. Parâmetros

| Param | Valor | Fonte no store |
| --- | --- | --- |
| `project` | id do projeto | `currentProjectId` |
| `detail` | `name`\|`keys`\|`columns`\|`docs` | `detailLevel` (S05) |
| `focus` | id da tabela (`schema.tabela`) | `selectedTable` |
| `col` | nome da coluna | `selectedColumn.column` (só se `focus`) |
| `hidden` | ids separados por `,` | `hiddenTableIds` (S04) — omitido se vazio; se > 50 ids, omitido e o link mostra aviso |
| `view` | id da view | reservado para S11, **não implementar** |
| `z`, `x`, `y` | zoom e centro, 2 casas | viewport — **só** quando não há `focus` |

Chaves desconhecidas são preservadas. Valores inválidos são ignorados silenciosamente (sem toast).

## 2. Módulos

- `src/features/shell/urlState.ts` — **puro, sem React**:
  `parseUrlState(search: string): Partial<UrlState>` e
  `serializeUrlState(state: UrlState, base: string): string`. Ordem estável das chaves.
- `src/features/shell/useUrlSync.ts` — hook montado **uma vez** em `Workspace` (dono do mount: S06):
  1. Na carga, depois que o modelo parseia: aplica `project` → `detail` → `hidden` → `focus/col`
     (via `focusTableWithPan`) ou `z/x/y` (via `setViewport`).
  2. Depois, observa o store e escreve com `history.replaceState` (nunca `pushState`), debounce 300ms.
  3. Tabela em `focus` inexistente no modelo → ignora.

O app não usa router; não adicione um.

## 3. Copiar link
Botão na navbar, à esquerda do Exportar: ícone `Link` + "Copiar link". Copia `location.href`
atualizado (força flush do debounce), toast "Link copiado". Menu ▾ ao lado: "Copiar link desta
tabela" (só `project`+`detail`+`focus`) e "Copiar link da visão atual" (inclui viewport e ocultas).

## 4. Gates (8)
1. Vitest `urlState.test.ts`: round-trip de 6 estados, incluindo coluna com caracteres especiais
   (`"nome com espaço"`, `ç`), ids com schema, e chave desconhecida preservada.
2. Vitest: valor inválido de `detail` → ausente no parse.
3. Vitest: `hidden` com 51 ids → não serializado.
4. Cypress `url-state.cy.ts`: visitar `?focus=<tabela>&detail=columns` → tabela selecionada, no
   viewport, nível Colunas.
5. Cypress: selecionar outra tabela → `location.search` contém o novo `focus` em ≤ 500ms, e
   `history.length` **não** aumentou.
6. Cypress: `?focus=nao_existe` → app carrega sem erro e sem seleção.
7. Cypress: "Copiar link" → clipboard (stub de `navigator.clipboard.writeText`) recebeu URL com
   `focus`.
8. Cypress: recarregar a página mantém seleção e nível.
