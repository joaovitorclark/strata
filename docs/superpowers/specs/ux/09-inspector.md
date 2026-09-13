# S10 — Inspector de leitura e edição

**Onda:** 4 · **Depende de:** S01, S07 · **Pesquisa:** P2.3 · **Referência:** painel direito do Liam

## 1. Estrutura

`src/features/shell/Inspector.tsx` vira um container fino; seções em `src/features/shell/inspector/`:

```
Inspector.tsx            cabeçalho (ícone, schema·nome, camada chip, ✕) + <Accordion type="multiple">
inspector/TableSection.tsx        nome, schema, camada, cor, nota (markdown editável), contagens
inspector/ColumnsSection.tsx      lista de colunas (filtro no topo), cada item expande
inspector/ColumnDetail.tsx        tipo, PK, not null, unique, default, nota, linhagem in/out
inspector/RelationsSection.tsx    FKs de saída e de entrada, clique → pan + seleciona
inspector/RelatedTablesSection.tsx mini-diagrama estático (SVG) da tabela + vizinhas a 1 salto
inspector/LineageSection.tsx      mapeamentos de campo (antigo ColumnPanel, movido em S02)
```

Estados:
- **Nada selecionado:** resumo do projeto (tabelas, colunas, relações, mapeamentos, problemas) e
  dica "Selecione uma tabela".
- **Tabela:** Tabela (aberta), Colunas (aberta), Relações, Tabelas relacionadas, Linhagem.
- **Coluna:** mesmo que tabela, com a coluna expandida e rolada em Colunas, Linhagem filtrada nela.
- **Várias tabelas:** "N tabelas selecionadas" + ações em lote (camada, cor, ocultar, remover).

## 2. Edição
Todo campo editável grava no DBML via as funções existentes de `schema/model/edit.ts` e o fluxo
`ws.actions` (renomear, tipo, nota, cor, camada, not null, PK). Commit em **blur** ou Enter; Esc
cancela. Nenhuma edição direta no store sem passar pelo DBML.

Se uma operação não tiver função em `edit.ts` (ex.: alternar `not null`), **crie-a em `edit.ts` com
teste Vitest** — é a única edição permitida fora dos donos, e deve ser reportada.

`ColumnDetail` > Linhagem: "Vem de" e "Alimenta", cada item com `tabela.coluna` clicável e botão
"Rastrear" (chama S08 se `focusSlice` existir; senão oculto).

`RelatedTablesSection`: SVG de 240×160, layout radial simples, sem React Flow. Clique numa tabela →
`focusTableWithPan`.

## 3. Visual
Largura 320px padrão, redimensionável (já no `AppShell`?) — se não houver, mantenha fixa. Labels
11px muted em cima, valores mono 12px. Seções com `Accordion` shadcn (instalar via CLI se ausente).

## 4. Gates (9)
1. Cypress `inspector.cy.ts`: selecionar tabela → seções Tabela e Colunas abertas.
2. Cypress: editar nota da tabela e blur → **DBML** contém `Note:` com o texto.
3. Cypress: alternar not null de uma coluna → **DBML** da coluna ganha/perde `not null`.
4. Cypress: Esc durante edição → DBML inalterado.
5. Cypress: clicar FK de entrada em Relações → canvas foca a outra tabela.
6. Cypress: coluna com linhagem mostra "Vem de" com o `tabela.coluna` correto.
7. Cypress: 3 tabelas selecionadas → "3 tabelas selecionadas"; mudar camada → DBML das 3 atualizado.
8. Vitest: funções novas em `edit.ts` (se houver), um teste por função.
9. Nenhuma sobra: `grep -rn "ColumnPanel" src/features/shell` só em `inspector/LineageSection.tsx`.
