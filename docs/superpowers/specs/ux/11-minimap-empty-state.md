# S12 — Mini-mapa e estado vazio

**Onda:** 5 · **Depende de:** S02 · **Pesquisa:** P2.4 · **Referências:** Oracle Navigator, Liam "paste a schema"

## 1. Mini-mapa
- `MiniMapToggle.tsx` na pill: ícone `Map`. Liga/desliga `<MiniMap>` do React Flow (removido do
  canvas em S02).
- Posição: `bottom-right`, 200×140, `bg-card/95`, borda, `rounded-md`, acima da altura da pill.
- Nós desenhados com a cor da camada (`--layer-*`), sem texto; `pannable` e `zoomable`.
- Padrão: **ligado** quando o modelo tem > 40 tabelas, desligado caso contrário; escolha do usuário
  em `localStorage` `strata.minimap` (try/catch) vence o padrão.
- Atalho `M`.

## 2. Estado vazio
`src/features/shell/EmptyState.tsx`, montado pelo `Workspace` no lugar do canvas quando o modelo
não tem tabelas (**dono do mount: S12**).

```
            ◆  Comece seu modelo

   [ Colar SQL / DBML / schema.rb ]   [ Importar projeto dbt ]   [ + Tabela ]

   ou arraste um arquivo .sql, .dbml, .rb, .yml aqui
```

- **Colar**: textarea em `Dialog`; detecta formato (DBML se contém `Table x {`; SQL se `CREATE
  TABLE`; Rails se `create_table`) e usa os importadores **existentes** (`features/source` /
  `infrastructure/api`). Formato não suportado (ex.: Rails sem importador) → mensagem clara, sem
  crash. **Não escrever importador novo nesta spec**; listar formatos suportados no relatório.
- **Importar projeto dbt**: abre o fluxo de importação existente (`ws.handleImport`).
- **+ Tabela**: `ws.handleAddTable`.
- Drop de arquivo: mesmo caminho do Colar.
- Depois de importar: autolayout + fit.

## 3. Gates (7)
1. Cypress `minimap.cy.ts`: `M` alterna `.react-flow__minimap`.
2. Cypress: fixture com > 40 tabelas → minimap visível por padrão.
3. Cypress: minimap não sobrepõe a pill (bounding boxes disjuntas).
4. Cypress `empty-state.cy.ts`: projeto vazio mostra o estado vazio.
5. Cypress: colar DBML com 2 tabelas → **DBML** do projeto contém as 2 e 2 nós no canvas.
6. Cypress: colar SQL `CREATE TABLE` → tabela criada no DBML.
7. Cypress: colar texto inválido → mensagem de erro visível, DBML inalterado.
