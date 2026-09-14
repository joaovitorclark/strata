# D2 — Escrever no dbt a partir do canvas e do inspector

**Onda:** B · **Depende de:** D1 · **Decisão:** 0001 §3, §4.3, regras globais 3–6

## 0. Aprovado em protótipo (2026-09-14)

Protótipo: <https://claude.ai/artifact/D9Ye9JFcXkxUv25wYqafaP> — aprovado. Onde esta spec e o
protótipo divergirem, **o protótipo vence** e a divergência vai no relatório. Decisões:

- **Excluir coluna:** sem dependências → exclui na hora com toast **"Desfazer"**; com dependências
  (relações, linhagem) → diálogo de confirmação listando cada dependência que sai junto.
- **"+ coluna" no fim da tabela**, visível no hover/seleção; Enter adiciona e abre a próxima; Tab vai
  do nome para o tipo.
- **Tipo:** lista de tipos do dialeto como sugestão, **mas aceita tipo livre** (ex.: `struct<...>`);
  lista filtra ao digitar, setas navegam, Tab completa.
- Nome editado inline (clique no nome da coluna selecionada, F2 ou menu), validado na hora: vazio,
  identificador inválido, duplicado.
- Menu da coluna (⋯ / botão direito) e da tabela como no protótipo; criar relação/linhagem arrastando
  a porta da borda da coluna; modo linhagem troca o gesto; duplo clique no fundo cria tabela com o
  nome em edição.
- Painel de mudanças: cada ação mostra o **diff real** dos arquivos dbt com números de linha — a
  mesma informação que a aba Diff (D3) mostra acumulada. Nesta fase o painel é um log das últimas 8
  ações; a aba Diff é a fonte completa.

## 1. Resultado

Projetos dbt ficam **editáveis** pelo canvas e pelo inspector, com o mesmo conjunto de ações que um
projeto DBML tem hoje. Cada ação vira uma **alteração mínima** nos arquivos dbt — nunca regeneração.
Undo/redo, autosave, dirty state e commit git funcionam igual.

## 2. Inventário de mutações

Antes de codar, gerar `docs/superpowers/dbt-mutations.md`: **toda** chamada que hoje altera o DBML a
partir da UI (funções de `schema/model/edit.ts` alcançadas por `useWorkspace`, `Canvas`, `Inspector`,
`LayersPanel`, `RecordsPanel`, palette), uma linha cada, com: ação do usuário → função DBML →
operação dbt equivalente → arquivos tocados. **A lista é o contrato de cobertura desta fase**; uma
mutação sem linha é um defeito.

## 3. Módulos

- `src/features/dbt-source/yamlEdit.ts` — operações sobre `ProjectFiles` com `yaml` Document:
  `addTable`, `removeTable`, `renameTable`, `addColumn`, `removeColumn`, `renameColumn`,
  `setColumnType`, `setNotNull`, `setUnique`, `setPrimaryKey`, `setDefault`, `setDescription`,
  `addRef`, `removeRef`, `addLineage`, `removeLineage`, `updateLineage`, `setLayer` (move o arquivo
  de pasta), `setGroup` (tags), `setEnum`, `setIndexes`, `setRecords` (seed CSV).
  Visual (em `.strata/<projeto>/`): `setPositions`, `setSize`, `setColor`, `setPins`, `setViews`.
- `src/features/dbt-source/mutations.ts` — mapa **ação → operação** usado por `useWorkspace`: se o
  projeto é dbt, a ação chama a operação dbt; se é DBML, o caminho atual. Um único ponto de
  roteamento, para a D6 remover o ramo DBML de uma vez.
- Store: `documentSlice` guarda `files: ProjectFiles` e o `ParseResult` derivado para projetos dbt;
  histórico de undo guarda snapshots de `files` (só arquivos alterados, não o domínio inteiro).
- Servidor: `PUT /api/projects/:id` aceita `{ format: "dbt", changes: Record<path, string | null> }`
  (null = remover arquivo); grava atomicamente (regra global 6) e devolve os caminhos gravados.
- `renameTable` e `setLayer` atualizam `ref()`/`source()` **em `.sql` gerenciados** e em
  `config.meta.strata.lineage` que apontam para a tabela; em `.sql` manuais **não reescrevem** — só
  retornam a lista de referências quebradas, exibida como problema no painel Problemas.

## 4. Fixture escrita à mão

`fixtures/dbt-source/handwritten/` — domínio dbt com comentários YAML, ordem de chaves não
alfabética, âncoras (`&` / `*`), testes customizados, um `config` de adapter desconhecido e um `.sql`
manual com Jinja.

## 5. Gates (15)

1. `docs/superpowers/dbt-mutations.md` presente; Vitest que varre `edit.ts` exportados alcançados
   pela UI e falha se algum não tiver linha no inventário.
2. Vitest: cada operação de `yamlEdit` sobre `handwritten/` altera **só as linhas esperadas** (diff
   de linhas); comentários, ordem, âncoras, testes customizados e `config` desconhecido intactos —
   **um caso por operação** da §3.
3. Vitest: após qualquer sequência de 20 operações aleatórias (seed fixa) sobre `kitchen-sink/`,
   `dbt parse` continua aceitando (`validate.sh` recebe o resultado) e `fromDbtProject` não perde nada
   que não foi removido.
4. Vitest: `renameTable` atualiza `ref()` em `.sql` gerenciado e lineage; `.sql` manual intacto e a
   referência quebrada reportada.
5. Vitest: `setLayer` move `_<model>.yml` e `.sql` para `models/<projeto>/<nova camada>/` e nada fica
   duplicado.
6. Vitest (servidor): gravação com 3 arquivos em que o 2º falha → nenhum dos 3 alterado em disco.
7. Cypress `dbt-write.cy.ts`: "+ Tabela" → novo `_<model>.yml` (ou entrada em `_sources.yml`) com a
   tabela; diff verificado lendo o arquivo via API.
8. Cypress: renomear coluna pelo nó → só a linha `name:` daquela coluna muda no YAML.
9. Cypress: arrastar relação → `constraints`/`relationships` gravado na coluna certa.
10. Cypress: arrastar linhagem (modo linhagem) → `config.meta.strata.lineage` gravado na coluna alvo.
11. Cypress: mover tabela → só `.strata/<projeto>/canvas.yml` muda; nenhum arquivo em `models/`.
13. Cypress: excluir coluna sem dependências → nenhum diálogo, toast com "Desfazer"; clicar Desfazer →
    arquivo volta byte a byte. Com dependências → diálogo lista cada uma; cancelar → nada muda em disco.
14. Cypress: "+ coluna" no fim da tabela → digitar nome, Tab, tipo livre `struct<a:int>` → Enter → YAML
    com `data_type: struct<a:int>`.
15. Cypress: renomear para um nome já existente → erro inline e nenhuma escrita.
12. Cypress: desfazer cada uma das ações 7–11 → arquivos voltam byte a byte; e os Cypress D1 gate 11
    passam a ser invertidos (ações habilitadas) — **único ajuste de asserção permitido, listado**.

## 6. Fora de escopo
Drawer (D3), SQL de transformação (D4), cabeçalho/lock (D5), remoção do DBML (D6).
