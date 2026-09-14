# 0001 — O projeto dbt é a fonte da verdade

**Data:** 2026-09-14
**Status:** proposta — aceita em princípio pelo dono do produto, com as decisões complementares de §7; **vinculante só depois do spike
S14 passar** (`docs/superpowers/specs/2026-09-14-s14-dbt-source-spike.md`).
**Substitui:** a fonte da verdade em DBML (`AGENTS.md` north star 4 e 6, `ux-ui-research.md` §5).

---

## 1. Contexto

Hoje o DBML é a fonte da verdade. Em 2026-09-14 ele já tinha deixado de ser DBML padrão: o arquivo
carrega **8 blocos proprietários** (`Records`, `LayerGroup`, `LineageFields`, `Dbt`, `Rolenames`,
`Colors`, `Pins`, `Views`) que o `@dbml/core` não lê e que `cleanDbml` remove antes de exportar.
Metadata visual (posições de view) e semântica (tabelas) moram no mesmo texto, manipulado por regex
— os dois defeitos de perda de dados achados na revisão da S11 vieram exatamente disso.

Ao mesmo tempo, o produto vai além de modelar estrutura:

- **O Strata vai produzir a lógica de transformação.** No canvas o usuário vê o *antes* (sources) e
  o *depois* (modelo alvo), mapeia campos, e o Strata **gera o SQL dbt** dessa transformação.
- **O ETL sai em outros alvos**, por exemplo Spark SQL.
- **Integração com outras ferramentas** é um objetivo: dbt é lido por DataHub, OpenMetadata, Atlan,
  OpenLineage; DBML proprietário não é lido por ninguém.

## 2. Decisão

1. **A fonte da verdade é um projeto dbt** no disco, versionado em git.
2. **DBML e SQL (DDL) são projeções editáveis** — interfaces amigáveis de código sobre o projeto
   dbt, não arquivos persistidos.
3. **Metadata visual vive em `.strata/`**, fora dos arquivos dbt.
4. **Spark SQL e as DDLs são saídas**, geradas a partir do modelo interno.

## 3. Layout do projeto

> Mostrado para **um** projeto Strata. Com vários projetos no domínio, ver §7.5: o `dbt_project.yml`
> é único e cada projeto vira `models/<projeto>/…`, `seeds/<projeto>/…`, `.strata/<projeto>/…`.
> Todo `meta` e config ficam sob `config:` (§7.2).

```
<projeto>/
  dbt_project.yml
  models/
    <camada>/_sources.yml          sources (tabelas cruas): colunas, data_type, description, meta.strata
    <camada>/<modelo>.sql          SQL do modelo (gerado ou manual — ver §5)
    <camada>/_<modelo>.yml         model: contract, columns, data_type, constraints, description,
                                   meta.strata (layer, lineage, transform)
  seeds/<tabela>.csv               Records
  .strata/
    project.yml                    versão do formato, notação, preferências do projeto
    canvas.yml                     posições, tamanhos, cores, pins, grupos colapsados
    views.yml                      views (S11)
```

### Regra de fronteira — onde cada coisa mora

> **Descreve os dados?** → YAML do dbt, sob `meta.strata`. Viaja com o projeto e é visível para
> outras ferramentas.
> **Descreve o diagrama?** → `.strata/`. Nunca aparece no diff do modelo.

| Conceito (hoje) | Destino |
| --- | --- |
| Tabela, coluna, tipo | source ou model · `columns[].data_type` |
| PK · FK · not null · unique | `constraints` (model com `contract.enforced`) · em sources: testes `unique`/`not_null`/`relationships` |
| Nota | `description` |
| Camada medallion | pasta `models/<camada>` + `meta.strata.layer` |
| Linhagem de campo | `columns[].meta.strata.lineage: [{ from: <ref>.<col>, expr?: <sql> }]` |
| Transformação (joins, filtro, grão) | `meta.strata.transform` do model (§5) |
| TableGroup | `tags` |
| Records | `seeds/*.csv` |
| Enum | teste `accepted_values` + `meta.strata.enum: <nome>` (preserva o nome) |
| Índices | `config` do adapter + `meta.strata.indexes` |
| Rolenames | `meta.strata.rolename` na coluna FK |
| Cores, pins, posições, views, colapsados | `.strata/` |

## 4. Projeções editáveis (DBML / SQL)

O drawer de código mostra o projeto como DBML ou como DDL e permite editar. As regras:

1. **Projeção → patch, nunca regeneração.** Salvar a projeção calcula o *diff* entre a projeção
   original e a editada e aplica **só essas mudanças** nos arquivos dbt. Nada que a projeção não
   representa (SQL, macros, configs, testes customizados, comentários YAML) pode ser alterado ou
   removido.
2. **O que não cabe na projeção fica visível como somente leitura** (ex.: um bloco comentado
   `// managed by dbt: 3 custom tests`) ou não aparece — mas nunca é perdido.
3. **Edição de YAML preserva comentários e ordem** — usar um parser com CST (`yaml`, não
   `js-yaml`, que o `dbtExport` usa hoje e descarta comentários).
4. A projeção DDL escolhe o dialeto na UI; o dialeto é só de exibição.

## 5. Modelos gerenciados e manuais

| | **Gerenciado** (`meta.strata.managed: true`) | **Manual** |
| --- | --- | --- |
| Quem escreve o `.sql` | o Strata, a partir de `meta.strata.transform` + lineage | o usuário |
| Canvas edita a transformação | sim — regenera o `.sql` | não — só estrutura e documentação |
| Linhagem | de `meta.strata.lineage` | lida de `ref()`/`source()` + nomes de coluna (S13), marcada como inferida |
| Editar o `.sql` à mão | converte o modelo para manual, com confirmação | livre |
| Saída Spark SQL | gerada pelo Strata do mesmo IR | `dbt compile` se o dbt CLI estiver instalado; senão indisponível com mensagem clara |

**Por quê:** ler de volta SQL dbt arbitrário (Jinja, macros) não é viável em Node. Sem essa
distinção, o canvas ou apaga trabalho manual ou mostra linhagem falsa.

### 5.1 IR de transformação (gerenciado)

Guardado em `config.meta.strata.transform` do model:

```yaml
config:
  meta:
    strata:
      managed: true
      sql_hash: "sha256:…"
      transform:
        from: { ref: stg_pedido, alias: p }
        joins:
          - { ref: stg_cliente, alias: c, type: left, on: "p.cliente_id = c.id" }
        where: "p.status <> 'cancelado'"
        group_by: []          # vazio = sem agregação
```

Cada coluna do model carrega `meta.strata.lineage: [{ from: p.valor_total, expr: "cast(p.valor_total as decimal(12,2))" }]`.
Sem `expr`, a coluna é `from` renomeada. Deste IR saem **o SQL dbt e o Spark SQL**.

## 6. Consequências

**Ganha:** integração com o ecossistema dbt; fim do dialeto DBML proprietário; diff de modelo
separado do diff visual; transformação e documentação no mesmo artefato; Spark SQL sem compilar dbt
para modelos gerenciados.

**Custa:**
- **Reescrita da camada de persistência.** O modelo interno (`ParseResult`) consumido pelo canvas
  permanece; muda de onde vem e para onde vai. `schema/model/edit.ts` (mutações de texto DBML)
  é substituído por mutações de YAML.
- **Edição por código mais verbosa** no formato real — mitigada pelas projeções (§4).
- **Usuários só de banco transacional** passam a ter um projeto dbt mesmo sem transformação. Um
  projeto só de `sources` cobre estrutura, mas **constraints não existem em sources** no dbt —
  PK/FK ficam como testes — aceito em §7.1.
- **Enums e índices** dependem de `meta.strata` para não perder informação.
- **Migração** dos projetos DBML existentes (conversão única, com relatório).

## 7. Decisões complementares (2026-09-14)

1. **Usuários sem dbt são atendidos por projetos só de sources.** PK/FK viram testes
   (`unique`, `not_null`, `relationships`) e **a linhagem de campo também vale entre sources**
   (`meta.strata.lineage` nas colunas de `_sources.yml`). Nenhuma feature do canvas depende de haver
   models.
2. **Versão do dbt: sempre a última estável.** Consequência prática: escrever `meta` e configs
   **sob `config:`** (forma exigida nas versões recentes; `meta` solto em coluna/model está
   depreciado) e `data_tests:` em vez de `tests:`. O spike S14 falha se `dbt parse` emitir qualquer
   *deprecation warning*.
3. **Modelo gerenciado: `meta` + cabeçalho + hash.**
   - `config.meta.strata.managed: true` é a autoridade.
   - O `.sql` começa com um cabeçalho de 2 linhas para humanos:
     `-- Gerado pelo Strata a partir do canvas. Edições manuais convertem este modelo para manual.`
   - `config.meta.strata.sql_hash` guarda o hash do SQL gerado. Se o arquivo mudar fora do Strata
     (IDE, outro editor, merge), o Strata detecta no load e **pergunta** se converte para manual ou
     regenera — nunca sobrescreve em silêncio. Sem o hash, uma edição feita no VS Code seria apagada
     na próxima regeneração.
4. **Drawer de código abre nos arquivos dbt reais.** Abas, nesta ordem: **dbt** (o YAML/SQL da
   tabela ou do model selecionado — é a verdade, sem tradução), **DDL** (projeção, dialeto Spark por
   padrão, trocável) e **DBML** (projeção). A última aba usada é lembrada por usuário.
   Motivo: quem usa dbt lê YAML e SQL; DBML é desconhecido para boa parte desse público e a DDL é
   familiar a todos. Mostrar a verdade por padrão evita a surpresa de "editei aqui e o arquivo ficou
   diferente".
5. **Um projeto dbt por domínio.** O domínio já é o repositório git; um projeto Strata vira uma
   **pasta** dentro dele:
   ```
   <domínio>/                      ← repo git
     dbt_project.yml                ← único
     models/<projeto>/<camada>/...  ← cada projeto Strata é um diretório
     seeds/<projeto>/...
     .strata/<projeto>/{canvas,views,project}.yml
   ```
   Cada model recebe `tags: ["strata:<projeto>"]`, então `dbt build --select tag:strata:<projeto>`
   roda um projeto isolado.
   Motivos: (a) é assim que times usam dbt — um projeto, muitas pastas; (b) projetos do mesmo
   domínio podem se referenciar com `ref()` normal — com um projeto dbt por projeto Strata, um
   `silver` que lê o `bronze` de outro projeto exigiria dbt Mesh/pacotes; (c) casa com o git no nível
   do domínio. Custo: renomear um projeto move uma pasta e atualiza as tags; nomes de model precisam
   ser únicos no domínio (o Strata valida e sugere prefixo).

Continua aberto só o que depende de evidência: nada — o spike S14 confirma 2 e 3.

## 8. Plano

1. **S14 — spike** (agente): prova ida-e-volta sem perda, `dbt parse` aceita, edição preserva YAML.
2. Se S14 passar: specs de implementação em fatias — leitura do dbt → escrita no dbt → projeções
   DBML/DDL → IR de transformação e geração de SQL → saída Spark → migração e aposentadoria do DBML.
3. Se S14 falhar: esta decisão volta para revisão com a lista concreta do que não coube.
