# 0001 — O projeto dbt é a fonte da verdade

> **Emendada pela [0002](0002-atrium-shell-and-no-dbml.md):** DBML sai inteiro (inclusive como importador); o drawer segue o protótipo `docs/prototypes/strata-shell.html`.

**Data:** 2026-09-14
**Status:** **aceita** (2026-09-14), com as decisões complementares de §7. O spike isolado foi
dispensado; a validação acontece nas fases D1–D6 (`docs/superpowers/specs/dbt/`), começando pelos
testes de ida e volta da D1 — se eles falharem, a decisão volta para revisão.
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
2. **DDL é a projeção editável** — interface amigável de código sobre o projeto dbt, não arquivo
   persistido. **DBML sai do produto** (§7.4); continua só como formato de importação para migrar
   projetos antigos.
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

## 4. Projeção editável (DDL)

O drawer de código mostra os arquivos dbt reais e, numa segunda aba, o projeto como DDL editável.
As regras da projeção:

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
3. **Modelo gerenciado: marcado com os mecanismos que outras ferramentas já leem.**
   O critério foi: *quem precisa saber que um model é gerado, e onde essa informação já é lida?*

   | Quem precisa saber | Mecanismo | Por que esse |
   | --- | --- | --- |
   | dbt CLI, CI, orquestradores (Airflow, Dagster, dbt Cloud) | **tag `strata:managed`** | tags são o seletor universal do dbt: `dbt build --select tag:strata:managed`, `--exclude`; chegam ao `manifest.json` |
   | Catálogos (DataHub, OpenMetadata, Atlan) e qualquer leitor do `manifest.json` | **`config.meta.strata: { managed: true, generator: "strata", generator_version: "x.y.z" }`** | `meta` é o canal padrão de propriedades customizadas; catálogos importam como propriedades do ativo. Proveniência (quem gerou e com que versão) sem ferramenta própria |
   | Pessoas, revisão de PR, linters e editores | **cabeçalho do `.sql`** com o marcador `@generated`: `-- @generated by Strata — edite pelo canvas; edições manuais tornam este model manual.` | `@generated` é a convenção de mercado para código gerado, reconhecida por várias ferramentas de revisão e lint; também é legível por humanos |
   | GitHub / GitLab na revisão | **`.gitattributes`** com `<caminho> linguist-generated=true` para cada `.sql` gerenciado (mantido pelo Strata) | o diff do PR recolhe arquivos gerados por padrão e não conta para estatísticas de linguagem |
   | Detecção de edição fora do Strata | **`.strata/generated.lock.yml`**: `caminho → sha256 + generator_version` | hash muda a cada regeneração; guardá-lo no YAML do model poluiria o diff e o `manifest.json` de todo mundo. Um lockfile é o padrão conhecido (`package-lock`, `uv.lock`) e dá a CI uma verificação simples: recalcular e comparar |

   Comportamento de *drift* (hash do lock ≠ hash do arquivo): no load o Strata marca o model e
   **pergunta** se converte para manual ou regenera — nunca sobrescreve em silêncio. Em CI, um
   comando de verificação falha se houver drift não resolvido.

   A autoridade é a combinação `tag strata:managed` + `meta.strata.managed: true`; se as duas
   divergirem (alguém removeu a tag à mão), o model é tratado como **manual**.

4. **Sem DBML.** O drawer de código tem duas abas: **dbt** (o YAML/SQL da tabela ou do model
   selecionado — a verdade, aberta por padrão) e **DDL** (projeção editável, dialeto Spark por
   padrão, trocável). DBML permanece apenas como **importador** para migrar projetos existentes e
   receber modelos de fora (dbdiagram etc.).
   Motivo: manter uma segunda projeção custa um tradutor bidirecional inteiro, e DBML não é lido por
   nenhuma das ferramentas com as quais queremos integrar; DDL é familiar a todos.
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

Fases em `docs/superpowers/specs/dbt/`: **D1** ler dbt → **D2** escrever no dbt → **D3** drawer
dbt/DDL ║ **D4** transformação e SQL ║ **D5** gerenciados e drift → **D6** migração e aposentadoria do
DBML. Ponto de parada: se os gates de ida e volta da D1 falharem, esta decisão volta para revisão
com a lista do que não coube.
