# P5 — Linhagem N:M com transformação por destino

**Onda:** 4 (paralela à P6) · **Depende de:** P4, D4 · **Decisão:** 0002 §6

## 1. Problema

Uma coluna pode ter **várias origens** (`valor_liquido ← vl_total, vl_desconto`) e **alimentar
vários destinos** (`silver.pedido.valor_liquido → gold.fct_vendas.receita_liquida` e
`→ silver.cliente_compras.total_gasto`). Cada destino aplica o seu ETL. Hoje o inspector trata
linhagem como pares soltos e não mostra a transformação.

## 2. Modelo

- A transformação pertence à **coluna destino**: `config.meta.strata.transform` da coluna, no IR da
  D4: `{kind, expr}` com `kind ∈ direct | rename | cast | calc | agg | expr`.
- Sem `transform` gravado, o Strata **deriva** para exibir (nunca grava): 1 origem com o mesmo nome →
  `direct`; 1 origem com outro nome → `rename`; N origens → `expr` sem expressão, com problema
  "defina a transformação".
- Uma origem nunca guarda transformação. Não existe transformação por aresta.

## 3. UI (conferir no protótipo: `silver.pedido.valor_liquido`, `silver.cliente_compras.ticket_medio`)

**Clicar numa aresta de linhagem** abre o inspector do **destino**:
- Destino `tabela.coluna`; contagem de origens.
- **Origens:** todas, a da aresta clicada realçada, cada uma com link (centraliza) e `×` (remove só
  aquela origem). Dica: "Arraste outra coluna até `<coluna>` para somar uma origem."
- **Transformação:** tipo (select) + expressão (monoespaçada, editável; desabilitada em `direct`) +
  prévia `select <expr> as <coluna>`. Trocar o tipo sugere forma (`agg` embrulha em `sum(...)`,
  `cast` em `cast(... as string)`) sem apagar o que o usuário escreveu.
- Arquivo onde grava; "Remover esta origem".

**Inspector da coluna:**
- **Origem:** lista + tipo e expressão da transformação desta coluna + botão "transformação" (abre o
  painel acima).
- **Alimenta:** **um item por destino**, cada um com o tipo e o início da expressão *daquele
  destino*; clicar abre o inspector do destino.

**Canvas:** ao rastrear uma coluna, cada aresta acesa mostra na ponta de destino um rótulo com a
expressão (até 34 caracteres) quando `kind ≠ direct`. Um rótulo por coluna destino.

**SQL/dbt gerados (D4):** a expressão do destino entra no `select` do model destino; origens em
tabelas diferentes viram CTEs/joins como a D4 já define.

## 4. Gates (10)

1. Vitest: derivação §2 (direct, rename, N origens) sem escrita.
2. Vitest: `validateTransform` reporta expressão que não referencia uma origem declarada e origem
   declarada que a expressão não usa.
3. Cypress: clicar na aresta `vl_desconto → valor_liquido` abre o destino com 2 origens, a clicada realçada.
4. Cypress: editar expressão → só `config.meta.strata.transform` da coluna destino muda (diff); `.sql`
   gerenciado regenerado com a expressão.
5. Cypress: `×` numa origem remove só aquela entrada de `lineage`; a outra origem e o `transform` ficam.
6. Cypress: coluna com 2 destinos → "Alimenta" mostra 2 itens com tipos diferentes; clicar no segundo abre o segundo destino.
7. Cypress: rastrear `silver.pedido.valor_liquido` → rótulos com a expressão de cada destino.
8. Cypress: modo Linhagem, arrastar nova origem para destino com `calc` → expressão preservada e problema "transformação não usa …" aparece.
9. Vitest: `.sql` gerado para `silver.cliente_compras` contém `sum(valor_liquido) as total_gasto` e
   `sum(valor_liquido) / count(distinct pedido_id) as ticket_medio`.
10. `bash scripts/dbt/validate.sh`: `dbt compile` dos models tocados exit 0.

## 5. Fixture
Adicionar ao `varejo` (spec em `scripts/fixtures/varejo/`) o model `silver.cliente_compras` do
protótipo, alimentado por `silver.pedido`, e regenerar.

## 6. Fora de escopo
Tela de transformação antes/depois (D7).
