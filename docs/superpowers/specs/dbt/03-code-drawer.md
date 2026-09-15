# D3 — Drawer de código: abas dbt e DDL

**Onda:** C · **Depende de:** D2 · **Decisão:** 0001 §4, §7.4

## 1. Resultado

Em projetos dbt, o drawer inferior tem as abas **dbt**, **DDL**, **Registros** e **Diff**:

- **dbt** (padrão): mostra os arquivos reais da seleção — tabela selecionada → seu `_<model>.yml`
  (ou o trecho da entrada em `_sources.yml`) e o `.sql` se houver; nada selecionado → árvore de
  arquivos do projeto com busca. **Editável.** Salvar valida o YAML (sintaxe + esquema mínimo:
  `version`, `models|sources`, `columns[].name`) e grava; YAML inválido não grava e aponta a linha.
- **DDL**: projeção do projeto inteiro (ou da seleção) como `CREATE TABLE`, dialeto **Spark** por
  padrão, seletor Spark/Postgres/Oracle. **Editável**: salvar calcula as mudanças e aplica como
  operações da D2 (§3).
- **Diff**: diff git dos arquivos do projeto contra o último commit, agrupado por arquivo, com o
  resumo por modelo (reusa o componente de diff existente; troca a fonte de DBML para arquivos).
- A última aba usada é lembrada por usuário (localStorage, try/catch).
- Projetos DBML: drawer inalterado.

## 2. `ddlProjection.ts`

- `toDdl(model, { dialect, tables? }): { text: string; map: SourceMap }` — `map` liga cada
  tabela/coluna/constraint da DDL a (arquivo, caminho YAML) de origem.
- `ddlToOperations(before: string, after: string, model, dialect): Operation[] | DdlError` —
  interpreta **só**: criar/remover tabela, adicionar/remover/renomear coluna, mudar tipo, `NOT NULL`,
  `PRIMARY KEY`, `REFERENCES`/`FOREIGN KEY`, `COMMENT`. Qualquer outra mudança (índices de adapter,
  particionamento, `TBLPROPERTIES`, `CHECK`…) → `DdlError` com a linha e "edite pela aba dbt".
- Renomear coluna é detectado por posição + tipo iguais e nome diferente; ambiguidade → pergunta ao
  usuário (renomear vs remover+adicionar), nunca adivinha.
- Parser: reutilizar o de `server/sqlImport.ts` se cobrir os 3 dialetos; senão reportar e usar só
  Spark/Postgres nesta fase.

## 3. Regra de ouro

Salvar a DDL **nunca** reescreve arquivo inteiro: produz operações da D2, que produzem diffs
mínimos. O que a DDL não representa (SQL do model, testes customizados, `config` de adapter,
comentários YAML) não pode mudar.

## 4. Gates (10)

1. Vitest: `toDdl` do `kitchen-sink/` nos 3 dialetos é aceito pelo `sqlglot` (`validate.sh`).
2. Vitest: `ddlToOperations` — 8 casos (um por tipo de mudança suportada) geram exatamente a operação
   esperada.
3. Vitest: mudança não suportada (ex.: `PARTITIONED BY`) → `DdlError` com a linha; nenhuma operação.
4. Vitest: renomear ambíguo → resultado `needsConfirmation`, nenhuma operação até resolver.
5. Vitest: editar a DDL de `handwritten/` e salvar → só as linhas esperadas mudam nos YAML;
   comentários, testes customizados e `config` desconhecido intactos.
6. Cypress `drawer-dbt.cy.ts`: selecionar tabela → aba dbt mostra o YAML dela; editar `description`
   e salvar → arquivo em disco mudou só nessa linha.
7. Cypress: YAML inválido na aba dbt → erro com linha; arquivo em disco inalterado.
8. Cypress: aba DDL → adicionar coluna → YAML ganha a coluna; canvas mostra a coluna.
9. Cypress: aba Diff após uma edição → mostra o arquivo alterado e o resumo por modelo.
10. Cypress: projeto DBML → drawer igual ao atual (specs existentes verdes sem alteração).

## 5. Fora de escopo
Remoção da aba DBML (D6), edição de `.sql` com assistência (fica texto simples).
