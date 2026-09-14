# Migração para dbt como fonte da verdade — índice das specs

**Decisão:** [`docs/decisions/0001-dbt-as-source-of-truth.md`](../../../decisions/0001-dbt-as-source-of-truth.md)
— **leitura obrigatória, inteira**, antes de qualquer spec. Ela é o contrato; estas specs dizem em
que ordem e com que prova.
**Base:** `research/ux-ui-proposal`. **Substitui:** o spike S14 (os gates dele foram distribuídos
nas fases abaixo).

---

## 1. Regras globais

Valem todas as regras de `AGENTS.md` e de `docs/superpowers/specs/ux/00-README.md` §1, **com uma
troca**:

> ~~Uma mutação é verificada pela mudança no DBML.~~
> **Uma mutação é verificada pela mudança nos arquivos do projeto dbt** (`models/**`, `seeds/**`,
> `.strata/**`) — por diff de linhas, não por estado do store nem por classe CSS.

Regras novas desta migração:

1. **Dois formatos convivem até a D6.** Um projeto é **dbt** se existir
   `<domínio>/.strata/<projeto>/project.yml`; senão é **legado DBML**. Nenhuma fase antes da D6 pode
   quebrar projetos legados — os 163 Cypress atuais continuam verdes sobre a fixture DBML.
2. **`ParseResult` continua sendo o que o canvas consome.** A migração troca a origem e o destino
   dos dados, não o canvas. Qualquer mudança de forma em `ParseResult` precisa de justificativa no
   relatório.
3. **YAML só com a lib `yaml` (Document/CST).** `js-yaml` não entra em código novo. Toda escrita
   preserva comentários, ordem de chaves, âncoras e chaves desconhecidas.
4. **`meta` e configs sempre sob `config:`; `data_tests:`, nunca `tests:`.** Versão do dbt: a
   última estável.
5. **Nada é apagado que o Strata não entende.** SQL manual, macros, testes customizados, configs
   de adapter e comentários sobrevivem a qualquer operação.
6. **Escrita atômica.** O servidor grava cada arquivo em temporário + rename; uma operação que
   toca vários arquivos grava todos ou nenhum.

## 2. Comandos de verificação

Os de `ux/00-README.md` §2, mais, a partir da D1:

```bash
bash scripts/dbt/validate.sh   # venv com dbt-core + dbt-duckdb + sqlglot (últimas estáveis);
                               # dbt parse/compile sobre as fixtures dbt; sqlglot sobre SQL gerado
```

`validate.sh` roda local e **não** entra no CI ainda (decisão da D5).

## 3. Fases, dependências e donos de arquivos

| Fase | Título | Depende de | Arquivos donos |
| --- | --- | --- | --- |
| [D1](01-read-dbt.md) | Ler um projeto dbt | — | `src/features/dbt-source/**` (novo), `server/dbtSource/**` (novo), `server/routes.ts` (rotas de projeto), `server/files.ts` (detecção de formato), `src/infrastructure/api/**`, `fixtures/dbt-source/**`, `cypress/fixtures/data/**` (domínio dbt novo), `scripts/dbt/**` |
| [D2](02-write-dbt.md) | Escrever no dbt a partir do canvas e do inspector | D1 | `src/features/dbt-source/yamlEdit.ts`, `src/features/dbt-source/mutations.ts`, `src/features/shell/useWorkspace.ts` (roteamento de mutações), `src/features/schema/store/documentSlice.ts`, `server/dbtSource/**` |
| [D3](03-code-drawer.md) | Drawer de código: abas dbt e DDL | D2 | `src/features/source/**`, `src/features/dbt-source/ddlProjection.ts` |
| [D4](04-transform.md) | IR de transformação e geração de SQL | D2 | `src/features/dbt-source/transform.ts`, `src/features/dbt-source/yamlEdit.transform.ts` (novo), `src/features/shell/inspector/TransformSection.tsx` (novo), `server/routes/exportRoutes.ts` |
| [D5](05-managed.md) | Marcação de gerenciados, lockfile e drift | D2 | `src/features/dbt-source/managed.ts`, `src/features/dbt-source/yamlEdit.managed.ts` (novo), `server/dbtSource/lock.ts`, `scripts/strata-verify.mjs`, `.github/workflows/ci.yml` |
| [D6](06-migrate-and-retire-dbml.md) | Migrar projetos DBML e aposentar o DBML | D3, D4, D5 | tudo que ainda depende de DBML — lista na própria spec |
| [S13](08-infer-lineage.md) | Linhagem inferida de models manuais | D1, D2 | `src/features/dbt-source/infer/**` (novo), `src/features/dbt-source/yamlEdit.infer.ts` (novo), `src/features/canvas/components/FieldLineageEdge.tsx`, `src/features/shell/inspector/LineageSection.tsx`, `src/features/canvas/toolbar/EdgeVisibility.tsx`, `fixtures/dbt-source/infer/**` |
| [D7](07-transform-canvas.md) | Tela de transformação (antes/depois) — protótipo aprovado | D4, D5, D6 | `src/features/transform/**` (novo), `src/features/shell/Workspace.tsx` (só o mount) |

Caminhos relativos à raiz do repositório.

## 4. Ondas

```
Onda A ─ D1
Onda B ─ D2
Onda C ─ D3 ║ D4 ║ D5 ║ S13        (arquivos donos disjuntos; D4 e D5 NÃO editam yamlEdit.ts —
                              cada uma cria o seu yamlEdit.<fase>.ts reusando os helpers exportados)
Onda D ─ D6
Onda E ─ D7
```

**Edições compartilhadas permitidas** (qualquer fase): i18n, registro de slice em
`schema/store/index.ts`, `docs/parity-inventory.md`, `AGENTS.md` (seção que a fase tornou falsa).

## 5. Relatório

O formato de `ux/00-README.md` §5, mais a linha:
`ARQUIVOS DBT TOCADOS POR GATE: <gate → arquivos que o diff mostrou mudar>`.
