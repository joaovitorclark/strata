# P8 — Defeitos do teste humano que sobrarem

**Onda:** 5 · **Depende de:** P2–P7

## 1. Contexto

Teste humano da PR 2 (2026-09-14) sobre o domínio `varejo`. Muitos itens deixam de existir com as
specs anteriores (a coluna "Resolvido por" diz qual). Esta spec **verifica** que cada item sumiu e
corrige o que sobrou. Para cada item: reproduzir no estado atual; se não reproduz, anexar o passo e
o screenshot; se reproduz, corrigir com teste que falhava antes.

## 2. Itens

| # | Defeito relatado | Resolvido por | Prova exigida |
| --- | --- | --- | --- |
| 1 | Tabelas sobrepostas ao abrir; Organizar não resolvia | P6 (altura real) | Cypress: abrir `varejo` sem `canvas.yml` → sem sobreposição; `⇧A` idem |
| 2 | Drawer de código cortado atrás do painel esquerdo | P2 | Cypress: drawer aberto com painel aberto → `getBoundingClientRect` do drawer começa na borda do canvas |
| 3 | Registros vazio; "Mudanças dbt" flutuando no canvas | P2 (removidos) | REMOVIDO no relatório; seed visível na aba `seed` do drawer |
| 4 | Modo linhagem com nós esmaecidos sobrepostos e texto vazando | P4 | Cypress: modo Linhagem, rastrear coluna → nós fora da cadeia com opacidade ≤0,3 e nenhum texto fora do nó (`scrollWidth ≤ clientWidth` nas células) |
| 5 | Swatch de cor não aplicava em projeto dbt | P2/P3 | Cypress: cor na tabela → `canvas.yml` muda e a faixa do nó usa a cor |
| 6 | Ícones de hover sobrepondo o tipo da coluna | P3 (portas fora da borda, sem ícones na linha) | Cypress: hover → tipo continua visível (`elementFromPoint` no centro do tipo é o tipo) |
| 7 | Editor inline de "+ coluna" estourava o nó | P3 | Cypress: editor aberto → largura contida no nó |
| 8 | "Problemas 77" suspeito | — | Listar os 77 do `varejo`; cada regra precisa de motivo; falsos positivos corrigidos; contagem esperada registrada em teste |
| 9 | Inspector com rótulos antigos: "Editar no DBML", "Mapeamentos (L2)", "Ref (sql/py)" | P1, P5 | `rg` pelas três strings vazio (código e i18n) |
| 10 | Alça de relacionamento difícil de pegar | P3 | Gate 3 da P3 |
| 11 | Painel Camadas confuso (lista de tabelas, presets, ajuda) | P2 | Gate 2 da P2 |
| 12 | Barra de ações herdada no topo | P2 | Gate 1 da P2 |

## 3. Gates

Um por item da tabela, com a prova exigida. Item 8 é o único que pode gerar código novo além de testes.
