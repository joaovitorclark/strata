# P3 — Nó da tabela: portas, + coluna, destaque, índices

**Onda:** 2 (paralela à P2) · **Depende de:** P1 · **Decisão:** 0002 §1, §5, §7

## 1. Resultado

O nó do protótipo: faixa lateral na cor da camada (ou da cor escolhida), cabeçalho `schema.nome`
com o schema apagado e a camada à direita, linhas de 28px, glifos de chave, `+ coluna` no pé.

## 2. Comportamento

**Portas (conectar):**
- Uma porta de cada lado de cada linha, **centrada na borda** (metade para fora), círculo de 10px
  com **área de clique de 24×24**. Aparece no hover da linha e em todas as linhas enquanto um
  arrasto está ativo.
- Cor por modo: Linhagem → `--rel-lineage` (Mauve); Relacionamentos → `--rel-fk` (Azul). A linha
  temporária do arrasto usa a mesma cor e o mesmo traço do tipo que vai criar (tracejada/contínua), e
  a linha alvo sob o cursor acende na mesma cor.
- Arrastar pelo cabeçalho move a tabela; arrastar pela porta conecta; clicar na linha seleciona a
  coluna. Nenhum modificador necessário.

**+ coluna:**
- Botão `+ coluna` no pé do nó, visível no hover ou com a tabela selecionada (nunca no nível NOME).
- Abre editor inline: nome · tipo (sugestões do dialeto, **aceita tipo livre**, começa em `string`).
  `Tab` nome→tipo; `Enter` adiciona **e mantém o editor aberto** com o mesmo tipo; `Esc`, `Enter`
  com nome vazio ou clique no fundo fecha.
- Nome vazio, inválido ou duplicado: campo vermelho, toast com o motivo, **nenhuma escrita**.
- Coluna recém-criada fica visível no nível CHAVES até recarregar o projeto.
- Criar tabela (duplo clique, ⌘K, Esquema) abre o editor da nova tabela.

**Destaque de coluna:**
- Inspector da coluna → "Destaque": sem cor + 6 swatches (tokens Mauve, Blue, Green, Yellow, Peach,
  Red). O nome fica na cor com uma barra de 3px à esquerda.
- Coluna destacada sempre aparece no nível CHAVES.
- Gravado em `.strata/<projeto>/canvas.yml` (`columns.<model>.<coluna>.mark: yellow`) por
  `yamlEdit.visual.ts` — **nunca** no YAML do model.

**Glifos:** PK bolinha verde + `PK`; FK bolinha azul vazada + `FK`; coluna em índice bolinha Sky
tracejada + `IX` (ou `UX` se único); fixada bolinha Mauve. Precedência: PK > FK > índice > fixada.
No nível CHAVES aparecem PK, FK, destacadas, fixadas, rastreadas e, **no modo Relacionamentos**,
colunas indexadas.

## 3. Gates (12)

1. Vitest: geometria da porta — centro sobre a borda, hit area 24×24 (`columnHandleGeometry`).
2. Cypress: modo Relacionamentos → hover na linha → porta com `stroke` = valor de `--rel-fk`; modo
   Linhagem → `--rel-lineage`.
3. Cypress: iniciar arrasto pela porta a 10px **fora** da borda funciona.
4. Cypress: `+ coluna` → `valor` → Tab → `struct<a:int>` → Enter → YAML com `data_type: struct<a:int>`;
   editor continua aberto e focado.
5. Cypress: nome duplicado → sem escrita (arquivo byte a byte igual) e campo com `aria-invalid`.
6. Cypress: `Esc` fecha sem escrever.
7. Cypress: nível NOME não mostra `+ coluna`.
8. Cypress: destacar coluna em amarelo → só `.strata/<projeto>/canvas.yml` muda; `models/**` intacto.
9. Vitest: coluna destacada presente no nível CHAVES.
10. Vitest: glifo `UX` para coluna em índice único, `IX` para não único.
11. Cypress: `⌘Z` após adicionar 3 colunas seguidas desfaz uma por vez.
12. Stress: nó com 184 colunas no nível COLUNAS rola a 60fps no Chrome (registrar perfil).

## 4. Fora de escopo
O que o arrasto cria e as regras de PK/índice (P4).
