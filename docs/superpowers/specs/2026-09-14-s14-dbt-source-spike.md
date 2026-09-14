# S14 — Spike: projeto dbt como fonte da verdade

**Data:** 2026-09-14
**Decisão que valida:** [`docs/decisions/0001-dbt-as-source-of-truth.md`](../../decisions/0001-dbt-as-source-of-truth.md) — leia inteira antes de começar.
**Tipo:** spike. **Nenhuma mudança no app.** O resultado é código isolado + um relatório que decide se
a 0001 vira vinculante.

---

## 1. Pergunta que o spike responde

> Todo conceito que o Strata modela hoje cabe no layout dbt + `.strata/` da 0001, **ida e volta sem
> perda**, o `dbt` aceita o projeto gerado, a edição de YAML preserva o arquivo, e o IR de
> transformação gera SQL dbt e Spark SQL válidos?

Resposta esperada: um relatório com ✅/⚠️/❌ por conceito e evidência executável para cada linha.

## 2. Regras

- Leia `AGENTS.md` e `docs/superpowers/specs/ux/00-README.md` §1. As regras de verificação valem.
- **Não tocar** em `src/features/**` existente, `server/**`, `cypress/**` nem no comportamento do app.
  Tudo novo mora em:
  - `src/features/dbt-source/` (código TypeScript puro, sem React)
  - `src/features/dbt-source/__tests__/`
  - `fixtures/dbt-source/`
  - `scripts/spike-s14/` (scripts de validação com dbt e sqlglot)
  - `docs/superpowers/spike-s14-report.md`
- Pode **importar** (somente leitura) `parseDbml` e tipos de `src/features/schema/model/` para ler as
  fixtures DBML.
- Dependência nova permitida: `yaml` (eemeli/yaml, com CST/Document que preserva comentários).
  Não usar `js-yaml` no código novo.
- Python só em `scripts/spike-s14/`, num venv local (`.venv-s14/`, no `.gitignore`).
- Branch `ux/s14-dbt-spike`, worktree próprio, portas 5170–5199 se precisar, sem push.

## 3. Entregas

### 3.1 Fixture "kitchen sink"
`fixtures/dbt-source/kitchen-sink.dbml` — um DBML que exercita **todos** os conceitos da tabela §3
da 0001, com pelo menos:
- 3 camadas (bronze/silver/gold) com 8+ tabelas;
- PK simples e **composta**; FK; `not null`; `unique`; `default`; `note` em tabela e coluna;
- 1 `Enum` usado por uma coluna; 1 índice composto;
- `TableGroup`; `LayerGroup`; `LineageFields` com cadeia bronze→silver→gold;
- `Records` em uma tabela; `Rolenames`; `Colors`; `Pins`; `Views` com 2 views;
- nomes com schema, uma coluna com caractere não ASCII (`descrição`), uma tabela chamada `*_views`.

### 3.2 Modelo interno neutro
`src/features/dbt-source/model.ts` — tipo `StrataModel` que representa tudo acima (pode reusar/
estender `ParseResult`). É o pivô das conversões.

### 3.3 Conversores
- `fromDbml(dbml: string): StrataModel`
- `toDbtProject(model: StrataModel): ProjectFiles` — `ProjectFiles = Record<path, string>`, layout
  exatamente o da 0001 §3, `meta.strata` conforme a tabela de fronteira, `.strata/*.yml` para o visual.
- `fromDbtProject(files: ProjectFiles): StrataModel`
- `toDbml(model: StrataModel): string` — a projeção (0001 §4), só para o teste de ida-e-volta.

### 3.4 Edição de YAML que preserva o arquivo
`src/features/dbt-source/yamlEdit.ts` com operações sobre um `ProjectFiles`:
`renameColumn`, `setColumnType`, `addColumn`, `removeColumn`, `setDescription`, `addLineage`,
`removeLineage`, `renameModel`.
Aplicadas sobre `fixtures/dbt-source/handwritten/` — um projeto dbt **escrito à mão** com comentários
YAML, ordem de chaves não alfabética, âncoras, testes customizados e um `config` que o Strata não
conhece.

### 3.5 IR de transformação → SQL
`src/features/dbt-source/transform.ts`:
`toDbtSql(model, modelName): string` e `toSparkSql(model, modelName): string` a partir de
`meta.strata.transform` + `meta.strata.lineage` (0001 §5.1). Cobrir: select com rename, `expr` com
cast, 1 left join, `where`, e 1 modelo com `group_by` + agregação.

### 3.6 Validação externa
`scripts/spike-s14/validate.sh`:
1. cria `.venv-s14`, instala `dbt-core>=1.8` e `dbt-duckdb` e `sqlglot`;
2. escreve o projeto gerado por `toDbtProject(kitchen-sink)` em um diretório temporário com um
   `profiles.yml` duckdb em memória;
3. roda `dbt parse` e `dbt compile`;
4. roda `sqlglot` com `read="spark"` sobre cada Spark SQL gerado.
Saída salva em `docs/superpowers/spike-s14-output/`.

### 3.7 Relatório
`docs/superpowers/spike-s14-report.md`:
- tabela **conceito → destino → ✅/⚠️/❌ → teste que prova → observação**, cobrindo toda linha da
  tabela de fronteira da 0001;
- o que se perdeu, se algo se perdeu, e proposta de solução;
- tempo de `fromDbtProject` e `toDbtProject` num projeto sintético de 200 tabelas / 3000 colunas;
- resposta, com evidência, às questões abertas 0001 §7.2 (versão mínima de dbt) e §7.3 (cabeçalho
  `-- managed by Strata`); as demais ficam listadas como não respondidas;
- **veredito**: `aprovar 0001`, `aprovar com ajustes (listar)` ou `revisar 0001 (motivos)`.

## 4. Gates (12)

1. Vitest: `fromDbml(kitchen-sink)` → `toDbtProject` → `fromDbtProject` → **igual** ao primeiro
   `StrataModel` (comparação estrutural normalizada; diferenças esperadas listadas e justificadas no
   próprio teste, uma por uma).
2. Vitest: `toDbml(fromDbtProject(toDbtProject(m)))` reparseia com `parseDbml` sem erro e com as mesmas
   tabelas, colunas, refs e mapeamentos de linhagem.
3. Vitest: nenhum conteúdo visual (`Colors`, `Pins`, `Views`, posições) aparece fora de `.strata/`;
   nenhum conteúdo semântico aparece dentro de `.strata/` (varre os arquivos gerados).
4. Vitest: enum preserva o nome via `meta.strata.enum`; índice composto preserva colunas e ordem.
5. Vitest: `Records` viram `seeds/*.csv` e voltam idênticos (incluindo não ASCII e vírgulas em valores).
6. Vitest: cada operação de `yamlEdit` sobre `handwritten/` altera **só** as linhas esperadas —
   verificado por diff de linhas; comentários, ordem, âncoras, testes customizados e `config`
   desconhecido intactos (8 operações = 8 casos).
7. Vitest: `renameModel` atualiza `ref()` nos `.sql` gerenciados e `meta.strata.lineage` que o
   referenciam, e **não** reescreve `.sql` manual (só reporta os `ref()` quebrados).
8. Vitest: `toDbtSql` e `toSparkSql` para os 5 casos de §3.5 batem com snapshots revisados à mão.
9. `scripts/spike-s14/validate.sh`: `dbt parse` exit 0 sobre o projeto gerado — saída salva.
10. `scripts/spike-s14/validate.sh`: `dbt compile` exit 0 e o SQL compilado dos modelos gerenciados é
    equivalente ao de `toDbtSql` (sem Jinja) — saída salva.
11. `scripts/spike-s14/validate.sh`: `sqlglot` parseia todo Spark SQL gerado sem erro — saída salva.
12. Relatório presente com as seções de §3.7 e veredito.

## 5. Fora de escopo

UI, drawer, canvas, servidor, migração de projetos reais, `dbt compile` para modelos manuais,
inferência de linhagem de `ref()` (S13). Nada disso entra, mesmo que pareça pequeno.

## 6. Comandos de verificação

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` e
`bash scripts/spike-s14/validate.sh`. Não é necessário Cypress (nada visual muda), mas
`npm run build` precisa continuar verde.
