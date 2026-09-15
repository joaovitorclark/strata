# S11 — Views (subject areas)

**Onda:** 5 · **Depende de:** S04, S05, S06 · **Pesquisa:** P1.4 · **Referências:** erwin Subject Areas + Stored Displays, Oracle Subviews + Displays

## 1. Conceito
Uma **view** é um recorte salvo do mesmo modelo: quais tabelas aparecem, onde estão e com que nível
de detalhe. Editar uma tabela numa view edita o modelo (é o mesmo DBML). A view **Tudo** sempre
existe, não é removível e é o comportamento atual.

## 2. Persistência (DBML, passa pelo git)

```dbml
Views {
  bronze_ingestao [detail: keys] {
    tables: bronze.raw_events, bronze.raw_customers
    positions: bronze.raw_events 120 80, bronze.raw_customers 480 80
  }
  gold_negocio [detail: docs] {
    tables: gold.*
  }
}
```

- Mesmo tratamento de bloco customizado que `Pins {}`/`Colors {}` (`blocks.ts`, `dbmlClean.ts`,
  `organize.ts`). **Exportadores ignoram o bloco** — verificar os 9 com os golden fixtures.
- `tables` aceita glob `schema.*`. Tabela renomeada → atualizada na view (usar o mesmo caminho de
  rename que atualiza `Pins`).
- Tabela removida do modelo → removida da view no próximo save, sem aviso.
- `positions` opcional; ausente → autolayout na primeira abertura e grava.
- Posições da view **Tudo** continuam onde estão hoje.

Módulo puro `src/features/schema/model/views.ts`: `parseViewsBlock`, `serializeViewsBlock`,
`resolveViewTables(view, allTableIds)`, `renameTableInViews`, `removeTableFromViews`.

## 3. UI
- `ViewTabs.tsx`: primeiro item **dentro da pill**, à esquerda: `▦ Tudo ▾`. Dropdown
  lista views, "Nova view a partir da seleção", "Nova view por camada" (gera uma view por camada
  medallion existente), "Renomear", "Duplicar", "Excluir".
- `SchemaTree.tsx` na view ≠ Tudo: árvore (S04) mostra só tabelas da view, com seção colapsada "Fora desta view (N)"
  cujo olho **adiciona** à view. `hiddenTableIds` passa a ser por view.
- Nível de detalhe (S05) passa a ser por view.
- URL (S06): ativar `view=<id>`.

## 4. Gates (10)
1. Vitest `views.test.ts`: parse/serialize round-trip de 4 views (glob, positions, sem positions,
   detail ausente).
2. Vitest: `renameTableInViews` e `removeTableFromViews`.
3. Vitest: `resolveViewTables` com `gold.*`.
4. Golden fixtures dos 9 exportadores inalterados com um DBML contendo `Views {}`.
5. Cypress `views.cy.ts`: selecionar 3 tabelas → "Nova view a partir da seleção" → **DBML** ganha
   bloco `Views` com as 3.
6. Cypress: trocar para a view → só 3 nós no canvas.
7. Cypress: mover nó na view → `positions` da view no DBML mudou; posição na view Tudo **não** mudou.
8. Cypress: renomear tabela → nome novo dentro do bloco `Views`.
9. Cypress: `?view=<id>` abre na view.
10. Cypress: "Nova view por camada" com 3 camadas → 3 views.
