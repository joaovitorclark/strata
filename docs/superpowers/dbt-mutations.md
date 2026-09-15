# Inventário de mutações dbt (D2)

Contrato desta fase: uma mutação UI sem linha é defeito. Se o grafo de imports revelar
export de `edit.ts` alcançado pela UI que não está aqui, **adicione** a linha — não apague
linhas.

Colunas: ação do usuário → função DBML → operação dbt (`yamlEdit` / visual) → arquivos tocados.

| # | Ação do usuário | Função DBML | Operação dbt | Arquivos |
| --- | --- | --- | --- | --- |
| 1 | Navbar / EmptyState / paleta “+ Tabela”; §0 duplo clique no fundo | `newTableTemplate` (`parse.ts`) via `handleAddTable` | `addTable` | `models/<proj>/<camada>/_<model>.yml` + `.sql` gerenciado (ou `_sources.yml` se source); `.strata/<proj>/canvas.yml` (posição) |
| 2 | Menu da tabela / Delete / batch excluir | `removeTable` | `removeTable` | remove `_<model>.yml`+`.sql` ou entrada source; limpa refs/lineage que apontam; `canvas.yml` |
| 3 | Renomear tabela (nó, inspector nome/schema, drawer) | `renameTable` | `renameTable` | rename arquivos; atualiza `ref()`/`source()` em `.sql` **gerenciados** e `config.meta.strata.lineage`; `.sql` manuais intactos + problemas |
| 4 | “+ coluna” (hoje menu; §0: fim da tabela, hover/seleção, Enter/Tab) | `addColumn` | `addColumn` | `_<model>.yml` ou `_sources.yml` (`name` + `data_type`) |
| 5 | §0 excluir coluna sem deps | *não existe em edit.ts* | `removeColumn` | YAML da tabela; toast **Desfazer** |
| 6 | §0 excluir coluna com deps (FK/linhagem) | *não existe* | `removeColumn` + `removeRef`/`removeLineage` após diálogo | YAML; cancelar = zero bytes |
| 7 | Renomear coluna (nó / inspector / §0 F2/inline) | `renameColumnAllRefs` | `renameColumn` | só a linha `name:` (+ refs/lineage/seed header se a coluna aparecer) |
| 8 | Tipo no inspector / §0 typeahead (tipo livre ok) | `setColumnType` | `setColumnType` | linha `data_type:` |
| 9 | Inspector PK | `setColumnSetting({pk})` | `setPrimaryKey` | `constraints` (model) ou testes unique+not_null (source) |
| 10 | Inspector / records not null | `setColumnSetting({notNull})` | `setNotNull` | `constraints` / `data_tests: not_null` |
| 11 | Inspector unique | `setColumnUnique` | `setUnique` | `constraints` / `data_tests: unique` |
| 12 | Inspector default | `setColumnSetting({default})` | `setDefault` | `config.meta.strata.default` (não é constraint) |
| 13 | Inspector / records nota de coluna | `setColumnSetting({note})` | `setDescription` | `description:` da coluna |
| 14 | Inspector / records nota de tabela | `setTableOrRecordsNote` | `setDescription` (tabela) | `description:` da tabela/source |
| 15 | Arrastar relação / reconnect | `appendRef` | `addRef` | `constraints` FK (model) ou `data_tests.relationships` (source) |
| 16 | Delete da aresta FK / `removeRef` | `removeRef` | `removeRef` | idem |
| 17 | `setColumnSetting({refTarget})` (FK inline no painel) | `setColumnSetting` | `addRef` / `removeRef` | idem |
| 18 | Arrastar linhagem / ColumnPanel add | `addFieldLineageEntry` | `addLineage` | `config.meta.strata.lineage` na coluna **alvo** |
| 19 | Remover linhagem | `removeFieldLineageEntry` | `removeLineage` | idem |
| 20 | Editar linhagem (note/ref) | `updateFieldLineageEntry` | `updateLineage` | idem |
| 21 | Menu/inspector/batch camada | `setTableLayer` | `setLayer` | move `_<model>.yml`+`.sql` para `models/<proj>/<nova>/`; nada duplicado |
| 22 | LayersPanel adicionar camada | `addLayerGroup` | pasta da camada (cria-se ao `setLayer`/`addTable`); visual não | sem YAML semântico em `.strata/` |
| 23 | TableGroup (sem UI direta hoje; yamlEdit §3) | — | `setGroup` | tags `strata:` / meta.group **só se não duplicar**; preferir tags |
| 24 | Cor da tabela | `setTableColor` | `setColor` | **somente** `.strata/<proj>/canvas.yml` |
| 25 | Cor do TableGroup | `setGroupColor` | `setColor` (grupo) | `canvas.yml` |
| 26 | Cor da coluna (ColumnPanel) | `setColumnColor` | `setColor` (coluna) | `canvas.yml` (visual) |
| 27 | Pin/unpin coluna | `pinColumn` / `unpinColumn` (`lodSlice` → `setDbml`) | `setPins` | `.strata/<proj>/canvas.yml` `pins:` (D1 já guarda pins no canvas, não no DBML de exibição) |
| 28 | Mover / autolayout / view layout | `setPositions` (store, não edit.ts) | `setPositions` | **somente** `canvas.yml` (`models/` intocado) |
| 29 | Resize | `setSizes` | `setSize` | `canvas.yml` |
| 30 | Colapsar grupo | `setCollapsedGroups` | visual `canvas.yml` | `canvas.yml` |
| 31 | ViewTabs criar/renomear/apagar/reordenar; SchemaTree “add to view” | `replaceViewsBlock` | `setViews` | `.strata/<proj>/views.yml` |
| 32 | Organizar DBML (paleta / drawer) | `organize` | **no-op** em projeto dbt (não reordenar YAML) | nenhum |
| 33 | Drawer SourceDrawer rename detect | `renameTable` / `renameColumnAllRefs` via `handleDbmlChange` | **proibido em dbt (R1)**; drawer não grava. Escrita do drawer é D3 | nenhum |
| 34 | Enum (sem UI direta; §3) | — | `setEnum` | `config.meta.strata.enum` + `accepted_values` **uma vez** |
| 35 | Índices (sem UI direta; §3) | — | `setIndexes` | `config.meta.strata.indexes` |
| 36 | Records / seed (RecordsPanel hoje só nota) | `setRecordsNote`; linhas CSV ainda não têm UI | `setRecords` | `seeds/<proj>/*.csv` + yml do seed |
| 37 | Rolenames (via `propagateKeyRename` no drawer) | `addRolename` / `removeRolename` | `config.meta.strata.rolename` na coluna | YAML da coluna; em dbt só se a ação passar por `mutations.ts` |

**Não são mutações de documento (não entram no Gate 1):** `getColumnSettings*`, `isCompleteTableId`, `refExists`, `migrateCanvasPins` (hydrate), `updateFieldLineageMeta` (interno de `updateFieldLineageEntry`), `renameColumn` cru (só via `renameColumnAllRefs`), `setTableNote`/`setRecordsNote` crus (só via `setTableOrRecordsNote`).
