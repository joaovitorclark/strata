# PR 3 — Strata moderno, limpo e funcional

**Leitura obrigatória, inteira, antes de qualquer spec:**
1. [`docs/decisions/0002-atrium-shell-and-no-dbml.md`](../../../decisions/0002-atrium-shell-and-no-dbml.md)
2. [`docs/decisions/0001-dbt-as-source-of-truth.md`](../../../decisions/0001-dbt-as-source-of-truth.md) (com as emendas da 0002)
3. **O protótipo:** abra `docs/prototypes/strata-shell.html` no navegador e faça cada gesto da spec
   que vai implementar. Ele é o contrato visual e de comportamento.

**Base:** `research/ux-ui-proposal` depois da integração da Onda C da migração dbt (D3, D4, D5, S13).

---

## 1. Regras globais

Valem `AGENTS.md`, `specs/ux/00-README.md` §1 e `specs/dbt/00-README.md` §1, mais:

1. **O protótipo vence.** Divergência vira linha no relatório, não decisão silenciosa.
2. **Não copiar o LocalDrawDB.** Código que só existe para um recurso removido é apagado na mesma
   spec, com os testes dele. Nada de `display:none`, flag ou "por enquanto".
3. **Nenhuma string, arquivo, rota, tipo ou teste com `dbml`** depois da P1 (gate global:
   `rg -i dbml src server cypress scripts fixtures` vazio, exceto `scripts/migrate-dbml-to-dbt.mjs` e
   `docs/decisions/**`).
4. **Uma mutação é verificada pelo diff dos arquivos dbt**, como na migração.
5. **Tokens, não cores.** Toda cor vem de `design-system/globals.css`. Semântica fixa: acento Mauve,
   relacionamento Azul (`--rel-fk`), linhagem Mauve (`--rel-lineage`), PK Verde, índice Sky, Teal só
   na marca.
6. **Portas 5170–5199 com checagem de cwd; sem push; não tocar em `research` nem em
   `~/www/strata-claude`.**

## 2. Specs, dependências e donos

| Spec | Título | Depende de | Arquivos donos |
| --- | --- | --- | --- |
| [P1](01-retire-dbml.md) | Aposentar o DBML por completo (absorve a D6) | Onda C | tudo com `dbml` — lista na spec |
| [P2](02-shell-and-brand.md) | Shell do protótipo e marca Atrium | P1 | `src/features/shell/{AppShell,Navbar,IconRail,LeftPanel,SchemaTree,StatusBar,Workspace,EmptyState}.tsx`, `src/features/panels/{LayersPanel,RecordsPanel,StatusLog,SelectionBar,PageImportWizard}.tsx`, `src/features/canvas/toolbar/**`, `src/features/command-palette/**`, `design-system/**`, `public/brand/**`, `index.html` |
| [P3](03-node-and-ports.md) | Nó da tabela: portas por modo, + coluna, destaque, índices | P1 | `src/features/canvas/components/{TableNode,ColumnRow,TableColumnList,ColumnComposer,columnGlyphs}.tsx`, `src/features/canvas/utils/{columnHandleGeometry,lod,nodeMetrics}.ts`, `src/features/dbt-source/yamlEdit.visual.ts` (novo) |
| [P4](04-mode-and-relationships.md) | Modo único e relacionamento por PK ou índice | P2, P3 | `src/features/canvas/Canvas.tsx`, `src/features/canvas/components/{RelationEdge,FieldLineageEdge,LineageEdge,EdgeMarkers}.tsx`, `src/features/canvas/components/edgeClasses.css`, `src/features/dbt-source/yamlEdit.relations.ts` (novo), `src/features/shell/inspector/{RelationsSection,RelatedTablesSection}.tsx` |
| [P5](05-lineage-nm.md) | Linhagem N:M com transformação por destino | P4, D4 | `src/features/shell/inspector/{LineageSection,ColumnDetail,TransformSection}.tsx`, `src/features/shell/Inspector.tsx`, `src/features/dbt-source/transform.ts` |
| [P6](06-arrange-by-mode.md) | Arranjar por modo | P4 | `src/features/canvas/utils/autolayout.ts` (reescrito), `src/features/canvas/utils/__tests__/autolayout*.test.ts` |
| [P7](07-domains-and-git.md) | Domínios, template do primeiro commit, nunca commitar em `main` | P2 | `src/features/domains/**`, `src/features/projects/**`, `server/git.ts`, `server/domains.ts`, `server/routes/domainRoutes.ts`, `server/domainTemplate/**` (novo) |
| [P8](08-human-test-fixes.md) | Defeitos do teste humano que sobrarem | P2–P7 | só os arquivos citados em cada item |

## 3. Ondas

```
Onda 1 ─ P1
Onda 2 ─ P2 ║ P3            (donos disjuntos)
Onda 3 ─ P4 ║ P7
Onda 4 ─ P5 ║ P6
Onda 5 ─ P8 ─ D7 (tela de transformação, spec dbt/07, já aprovada)
```

**Edições compartilhadas permitidas:** i18n, `schema/store/index.ts` (registro de slice),
`AGENTS.md` (seção que a spec tornou falsa), `docs/parity-inventory.md`.

## 4. Verificação

`npm run typecheck && npm run lint && npm run test && npm run build`, Cypress da spec +
`cypress/e2e/smoke*.cy.ts`, `bash scripts/dbt/validate.sh`, e `npm run fixtures:varejo` sem diff.

## 5. Relatório

Formato de `specs/ux/00-README.md` §5, mais:
- `DIVERGÊNCIAS DO PROTÓTIPO: <gesto → o que ficou diferente e por quê>`
- `REMOVIDO: <arquivo/teste → recurso que ele servia>`
- `ARQUIVOS DBT TOCADOS POR GATE: <gate → arquivos>`
