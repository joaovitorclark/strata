# P6 — Arranjar por modo

**Onda:** 4 (paralela à P5) · **Depende de:** P4 · **Decisão:** 0002 §5

## 1. Problema

"Organizar" empilha tabelas por camada. Num lago com 56+ tabelas isso vira colunas altíssimas, e o
mesmo arranjo serve mal para ler linhagem e para ler relacionamentos. O teste humano mostrou tabelas
sobrepostas depois de organizar.

## 2. O que o LocalDrawDB fazia (referência, não copiar)

`autolayout.ts` atual: dagre por componente conectado, grade para singletons, empacotamento por
cluster de camada e um passe de resolução de sobreposição. Problemas: altura estimada diferente da
renderizada (sobreposição), clusters por camada em vez de por conexão, um só arranjo para os dois
tipos de aresta.

## 3. Algoritmo (o protótipo implementa; `organize()` em `docs/prototypes/strata-shell.html`)

Entrada: tabelas visíveis (camadas ocultas e view ativa respeitadas), arestas **do modo ativo**,
altura real de cada nó no nível de detalhe atual.

1. **Grupos:** componentes conectados pelas arestas do modo. Tabelas sem aresta no modo = soltas.
2. **Linhagem** — cada grupo é um fluxo esquerda→direita:
   coluna = maior distância até uma fonte no grafo de tabelas (não o nome da camada; ciclos
   seguros); ordem dentro da coluna por baricentro dos vizinhos, 6 varreduras alternadas.
3. **Relacionamentos** — cada grupo é um cluster ER:
   coluna = `max(profundidade) − profundidade`, com profundidade = maior cadeia seguindo FK até um
   pai; quem só referencia fica à esquerda, os referenciados à direita; baricentro igual ao item 2.
4. **Coluna alta quebra** em subcolunas quando passa de `max(700, √(área do grupo)·1,1)`; colunas
   centralizadas verticalmente no grupo.
5. **Soltas:** grade compacta com `⌈√(n·1,6)⌉` colunas, ordenadas por camada e nome.
6. **Empacotamento:** grupos ordenados por área (maior primeiro) em prateleiras com largura
   `√(Σ área · proporção da tela)`; soltas por último. Espaços: 96px entre colunas, 28px entre
   tabelas, 110px entre grupos; posições em múltiplos de 8.
7. Ajustar à tela; uma entrada de undo; grava só `.strata/<projeto>/canvas.yml`.

## 4. Gates (10)

1. Vitest: **nenhuma sobreposição** (bounding boxes com a altura real de `nodeMetrics`) no `varejo`
   inteiro e no stress de 200 tabelas, nos dois modos e nos três níveis de detalhe.
2. Vitest: modo Linhagem, cadeia `bronze.pedidos → silver.pedido → gold.fct_vendas →
   gold.agg_vendas_diarias` → `x` estritamente crescente.
3. Vitest: silver que lê de outra silver fica uma coluna à direita dela.
4. Vitest: modo Relacionamentos, `fct_vendas → dim_cliente` → `x(fct) < x(dim)`.
5. Vitest: tabela sem aresta no modo vai para a grade de soltas, não entre grupos.
6. Vitest: 56 tabelas (fixture `lake-56`, gerada como no protótipo) → razão largura/altura do
   resultado entre 0,6× e 1,6× a proporção da viewport; nenhuma coluna com mais de 12 tabelas.
7. Vitest: cruzamentos de arestas no `varejo` modo Linhagem ≤ o valor registrado no relatório da
   primeira execução (regressão), e < o do algoritmo antigo.
8. Vitest: determinístico — duas execuções, mesmas posições.
9. Cypress: `⇧A` → só `canvas.yml` muda; `⌘Z` restaura byte a byte.
10. Desempenho: 200 tabelas em ≤ 150 ms (registrar).

## 5. Fora de escopo
Layout incremental ao criar tabela (P2 cuida do "logo abaixo da última da camada").
