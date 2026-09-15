# P4 — Modo único e relacionamento por PK ou índice

**Onda:** 3 (paralela à P7) · **Depende de:** P2, P3 · **Decisão:** 0002 §5, §7

## 1. Resultado

O canvas trabalha em **um modo por vez**. O modo decide o que aparece, o que o arrasto cria, a cor
da porta e o que o Arranjar otimiza. Relacionamentos podem apontar para a PK ou para um índice.

## 2. Modo

- Estado `canvasMode: "lineage" | "relations"` no store do canvas, persistido na URL (`?mode=`) e em
  `.strata/<projeto>/project.yml` (último usado). Padrão: `lineage`.
- Seletor segmentado na barra de status (P2); atalhos `L` e `R` fora de campo de texto; comando no
  `⌘K`. Trocar o modo limpa a aresta selecionada, mantém a seleção de tabela/coluna.
- **Linhagem:** só arestas de linhagem de campo (declaradas e inferidas da S13). **Relacionamentos:**
  só arestas de relacionamento. Nenhuma aresta do outro tipo é renderizada (nem esmaecida).
- O rastreio de coluna (S08) segue o modo: em Linhagem percorre a cadeia inteira nos dois sentidos;
  em Relacionamentos acende os relacionamentos da coluna.
- Some qualquer controle antigo de "modo linhagem", visibilidade por tipo de aresta e o
  `EdgeVisibility` (o toggle "Linhagem inferida" da S13 vai para o menu do seletor de modo).

## 3. O que o arrasto cria

**Modo Linhagem** — sempre cria linhagem, sem menu:
- Origem = coluna da camada mais baixa; destino = da mais alta. Mesma camada: origem = coluna de onde
  o arrasto começou.
- Duplicata → toast "Essa linhagem já existe", nada gravado.
- Somar origem a um destino que já tem transformação **não** apaga a expressão; o destino ganha
  problema "transformação não usa `<origem>`" até o usuário editar (P5).

**Modo Relacionamentos** — sempre cria relacionamento `from` (coluna arrastada) → `to` (alvo):
- Alvo é PK → `via: pk`.
- Alvo pertence a um índice → `via: index`, com o nome do índice.
- Alvo sem PK nem índice → menu: **Criar índice único `ux_<tabela>_<coluna>` e relacionar** ·
  **Relacionar à PK de `<tabela>`** · Cancelar. As duas primeiras são **uma** entrada de undo.
- Mesma tabela é permitido (auto-relacionamento); duplicata → toast, nada gravado.

## 4. Representação no dbt

Na coluna `from`:
```yaml
data_tests:
  - relationships:
      arguments: {to: "ref('canal_venda')", field: codigo}
config:
  meta:
    strata:
      ref: {via: index, index: ux_canal_codigo}   # ausente quando via: pk
```
Índices continuam em `config.meta.strata.indexes` do model (formato da D1). Remover um índice usado
por relacionamento → diálogo listando os relacionamentos, que passam a `via: pk` se o alvo for PK
ou são removidos.

## 5. Aresta e inspector

- Relacionamento via PK: linha contínua Azul com pé-de-galinha. Via índice: pontilhada Azul
  (`1.5 3`, ponta arredondada).
- Inspector do relacionamento: Tipo (`FK → PK` | `FK → índice`), índice referenciado (ou erro
  "nenhum índice em `<coluna>`"), coluna, referência, arquivo, Remover.
- Inspector da tabela ganha **Índices**: lista `nome (colunas) único`, `+ índice` (a partir da coluna
  selecionada, senão a primeira não-PK), `×` para remover.

## 6. Gates (12)

1. Vitest: `canvasMode` na URL e em `project.yml`; recarregar mantém o modo.
2. Cypress: modo Linhagem → nenhuma aresta de relacionamento no DOM; modo Relacionamentos → nenhuma de linhagem.
3. Cypress: modo Linhagem, arrastar de `gold.x.a` para `silver.y.b` → linhagem gravada em `gold.x.a` com `from: silver.y.b` (direção corrigida).
4. Cypress: modo Relacionamentos, soltar numa PK → `relationships` gravado sem `meta.strata.ref`.
5. Cypress: soltar em coluna com índice único → `ref: {via: index, index: <nome>}`.
6. Cypress: soltar em coluna sem índice → menu; "Criar índice único" → índice e relacionamento no
   mesmo diff; um `⌘Z` desfaz os dois (arquivo byte a byte).
7. Cypress: duplicata → nenhuma escrita.
8. Vitest: `yamlEdit.relations.ts` preserva comentários e chaves desconhecidas (um caso por operação).
9. Vitest: remover índice usado → operação retorna os relacionamentos afetados; nada gravado sem confirmação.
10. Cypress: `L`/`R` trocam o modo; digitando num campo não trocam.
11. Vitest: aresta via índice usa a classe pontilhada; via PK, contínua.
12. `bash scripts/dbt/validate.sh` sobre o resultado dos gates 4–6: `dbt parse` exit 0.

## 7. Fora de escopo
Painel de transformação (P5), Arranjar (P6).
