# S07 — Nó da tabela redesenhado

**Onda:** 3 · **Depende de:** S05 · **Pesquisa:** P2.1 · **Referências:** erwin key area, Liam row dividers

## 1. Princípio
Hierarquia, não subtração: tudo que o modelador precisa continua no nó, mas com **uma** cor por
significado e ações só em hover/seleção.

## 2. Anatomia (níveis Chaves/Colunas)

```
┌▌───────────────────────────────────────────┐
│▌ silver · pedido                  187  ⋯   │ A cabeçalho
│▌───────────────────────────────────────────│
│▌ ⚷  id                  bigint             │ B key area (PK), bg --surface
│▌═══════════════════════════════════════════│ C separador duplo
│▌ ↗  cliente_id          bigint             │ D linhas, divisória 1px --border/60
│▌ ◆  status              varchar            │
│▌ ⇢  valor_total         numeric(12,2)      │
│▌    + 183 colunas                          │ E overflow (controle real)
└────────────────────────────────────────────┘
 ▌ = 3px camada (já existe)
```

**A. Cabeçalho** (`TABLE_HEADER_H` inalterado)
- Schema em `--muted-foreground` + `·` + nome em `--foreground` 500, mono 12px, `truncate`.
- Contagem de colunas `tabular-nums` 11px muted.
- `⋯` **só em hover do nó ou selecionado** (`opacity-0 group-hover:opacity-100`, mas sempre
  focável por teclado — `focus-visible:opacity-100`).
- Cor da tabela (`Colors {}`): tinta de 10% no fundo do cabeçalho, nunca no texto.
- Tooltip no nome (shadcn `Tooltip`, delay 500ms) com o conteúdo do `TableInfoPopover` — **remonta**
  o que S02 desmontou. Dono do mount: S07.

**B/C. Key area**: linhas de PK (inclusive composta) primeiro, fundo `--surface`, separadas do resto
por borda dupla (`border-b-[3px] border-double`). Sem PK → sem separador.

**D. Linha de coluna** (`COLUMN_VIRTUAL_ROW_H` inalterado — virtualização não pode mudar):
`[glifo 14px] [nome mono 12px flex-1 truncate] [tipo mono 11px muted, right, tabular-nums]`.
- Hover: `--surface-hover`; aparecem à direita do tipo, sobrepostos (absolute, sem mudar layout):
  lápis (renomear, já existe `editing`) e alfinete (fixar).
- Coluna selecionada: fundo `--primary/12` + borda esquerda 2px `--primary`.
- Divisória `border-b border-border/60` exceto última.
- Handles (`t:`, `s:`, `fl:`) **inalterados em id e posição**. Não mexer em
  `columnHandleGeometry.ts` — se a geometria mudar, os testes vermelhos indicam erro.

**Glifos** — `canvas/components/columnGlyphs.tsx` exporta `ColumnGlyph({ flags })`, SVG inline
1.5px stroke, cor `--muted-foreground`, exceto PK em `--key-pk`. Prioridade (um glifo por linha):

| Flag | Glifo | aria-label |
| --- | --- | --- |
| PK | chave (`KeyRound` lucide) | "Chave primária" |
| FK | `ArrowUpRight` | "Chave estrangeira" |
| linhagem de campo | `GitCommitHorizontal`/`⇢` | "Tem linhagem" |
| unique / índice | losango duplo | "Único" / "Índice" |
| not null | losango cheio | "Não nulo" |
| nullable | losango vazio | "Anulável" |

Flags secundárias (ex.: FK **e** not null) aparecem no tooltip da linha: `bigint · FK → cliente.id ·
not null`. Remova os badges `PK`/`FK` em texto e o ponto colorido.

**E. Overflow**: `+ N colunas` clicável (troca o nó para `full` pinado), 11px muted.

**Nível Nome**: só cabeçalho, com contagem de relações `↔ 4` à direita.
**Nível Documentação** (S05): nota da tabela em 11px abaixo do cabeçalho (máx. 3 linhas).

## 3. Acessibilidade
- Nó: `role="group"` `aria-label="Tabela <schema.nome>, <n> colunas"`.
- Linha: `aria-label` com nome, tipo e flags.
- Contraste do tipo muted ≥ 4.5:1 nos dois temas (tokens existentes já passam — ver identity.md §3).

## 4. Gates (10)
1. Vitest `columnGlyphs.test.tsx`: tabela de prioridade — 6 casos.
2. Vitest: linha FK+notnull → um glifo FK e tooltip contém "not null".
3. Cypress `node-anatomy.cy.ts`: tabela com PK composta → 2 linhas antes do separador duplo.
4. Cypress: `⋯` com `opacity 0` sem hover, `1` com hover e com foco de teclado.
5. Cypress: nenhum elemento com texto exato `PK` ou `FK` dentro de `.react-flow__node`.
6. Cypress: renomear pelo lápis → **DBML** com novo nome.
7. Cypress: `+ N colunas` → nó mostra todas.
8. `canvas-edges.cy.ts`, `handle-connect-smoke.cy.ts` e `stress-*` verdes **sem alterações**.
9. Altura: gate 8 de S05 continua verde.
10. Screenshot Cypress salvo para os 4 níveis × 2 temas em `cypress/screenshots/node-anatomy/` —
    anexar caminhos no relatório para revisão humana.
