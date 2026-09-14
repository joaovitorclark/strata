# D7 — Tela de transformação (antes/depois)

**Onda:** E (depois da D6) · **Depende de:** D4, D5 · **Decisão:** 0001 §5, §5.1

## 0. Aprovado em protótipo (2026-09-14)

Protótipo: <https://claude.ai/artifact/Ta1TDaZJx19T7VEcYyAxPC> — **aprovado como está**. Onde esta
spec e o protótipo divergirem, **o protótipo vence** e a divergência vai no relatório.

Decisões fechadas com a aprovação:
- **Pipeline no topo** (De → Joins → Filtro → Agregação → + fonte), não em painel lateral.
- **Expressão editada no painel abaixo do model**, não inline na linha.
- **Sem prévia de dados** nesta fase.
- **Entrada:** botão "Editar transformação" na seção Transformação do inspector (D4) e duplo clique
  num model gerenciado no diagrama. **Saída:** segmento "Diagrama" na barra da tela, `Esc`, ou
  navegador voltar (a tela entra na URL: `?transform=<model>`, S06).

## 1. Resultado

Um model gerenciado ganha uma tela dedicada que substitui o canvas enquanto aberta:

```
barra      vendas / gold / fct_vendas · ⚙ gerenciado · status (válido | N problemas) · [Transformação|Diagrama]
pipeline   De p ─→ Join c (tipo, on) ─→ Filtro (on/off) ─→ Agregação (on/off) ─→ + fonte
palco      fontes (antes) ──── linhas mauve de mapeamento ──── model (depois) + editor da coluna
SQL        abas dbt | Spark SQL · caminho do arquivo · Copiar
```

Tudo que se edita grava pelas operações da D2/D4 (`setTransform`, `setColumnExpr`, `addLineage`,
`removeLineage`, `addColumn`, `renameColumn`) e regenera o `.sql` gerenciado — **só quando não há
problemas**. Com problemas, o YAML grava (é o estado do trabalho) e o `.sql` fica na última versão
válida; o status diz "SQL não será gravado".

## 2. Comportamento (do protótipo)

**Pipeline**
- "De": relação principal (`from`), alias exibido.
- Cada join: tipo (`inner|left|right|full`) e `on` editáveis; a fonte do join aparece à esquerda com
  o rótulo do tipo.
- Filtro e Agregação: liga/desliga preservando o texto; Agregação recebe **nomes de colunas do
  model**, resolvidos para as expressões no SQL.
- "+ fonte": busca de tabelas do domínio (models e sources, incluindo de outros projetos via
  `ref()`); ao escolher, cria o join com `on` sugerido pelas FKs entre a nova fonte e as já
  presentes; sem FK, `on` vazio e marcado como problema. Remover fonte: menu da fonte; bloqueado se
  houver colunas mapeadas nela (lista quais).

**Palco**
- Arrastar coluna da fonte → coluna do model: adiciona a origem (linhagem). Duas ou mais origens sem
  expressão → problema.
- Arrastar → "+ nova coluna": cria coluna com o nome e o tipo da origem (sufixo `_2`… se colidir).
- Clique (ou Enter/Espaço) numa coluna do model: seleciona, destaca as linhas dela (animadas) e esmaece
  as outras.
- Coluna com problema: ponto vermelho + `title` com a lista; coluna com expressão: selo `ƒx`.
- Colunas das fontes usadas ficam com a porta preenchida.
- Linhas são exatas: saem do centro da linha da coluna da fonte e chegam no centro da linha da coluna
  do model (mesma regra de precisão da S09 §1.1).

**Editor da coluna**
- Nome (normalizado para identificador; colisão rejeitada com mensagem), origens removíveis,
  expressão (vazia = origem direta), atalhos (`cast` data/decimal, `coalesce`, `upper(trim())`, `sum`,
  `count`) que usam a primeira origem.
- Problemas da coluna listados abaixo.

**Validação** (mesmas regras de `validateTransform`, D4): sem origem; várias origens sem expressão;
alias inexistente; coluna inexistente na fonte; com agregação ligada, coluna fora do GROUP BY e sem
função de agregação; join sem `on`.

**SQL**
- Abas dbt e Spark SQL, geradas por `toDbtSql`/`toSparkSql` (D4), com o caminho de destino e Copiar.
- Destaque de sintaxe com os tokens `--syn-*` do `identity.md`.

**Responsivo** (< 860px): palco empilha fontes sobre o model e as linhas somem; mapeamento por menu
"Mapear origem" na coluna do model (o arrastar não é o único caminho — acessibilidade).

## 3. Arquivos

- `src/features/transform/**` (novo): `TransformScreen.tsx`, `Pipeline.tsx`, `MappingStage.tsx`,
  `ColumnEditor.tsx`, `SqlPreview.tsx`, `useTransformDraft.ts`, `mappingGeometry.ts`.
- Montagem: `src/features/shell/Workspace.tsx` troca o canvas pela tela quando
  `?transform=<model>` (dono do mount: D7).
- Reuso obrigatório: `validateTransform`, `toDbtSql`, `toSparkSql`, operações `yamlEdit*`, tokens e
  glifos do nó (`columnGlyphs.tsx`). Nada de gerar SQL ou validar de novo dentro de `transform/`.

## 4. Gates (12)

1. Cypress `transform-screen.cy.ts`: duplo clique num model gerenciado → tela aberta, URL com
   `?transform=`; "Diagrama" e `Esc` voltam ao canvas com o model selecionado.
2. Cypress: model manual → duplo clique não abre a tela; inspector não mostra o botão.
3. Cypress: arrastar `p.canal` → `canal` → `config.meta.strata.lineage` da coluna ganha a origem no
   YAML em disco e o `.sql` regenerado contém `p.canal as canal`.
4. Cypress: arrastar para "+ nova coluna" → coluna nova no YAML com o tipo da origem.
5. Cypress: editar expressão → `.sql` regenerado contém a expressão; YAML só muda a linha da `expr`.
6. Cypress: criar problema (remover a única origem) → status "SQL não será gravado"; `.sql` em disco
   inalterado; YAML atualizado.
7. Cypress: trocar tipo do join para `inner` → YAML e `.sql` atualizados.
8. Cypress: ligar Agregação com `data_venda, uf` → colunas não agregadas marcadas; aplicar `sum()` nelas
   → problemas somem e `.sql` com `group by`.
9. Cypress: "+ fonte" com tabela ligada por FK → join criado com `on` sugerido; sem FK → `on` vazio
   marcado.
10. Cypress: precisão das linhas — para 5 mapeamentos, |y da ponta − centro da linha da coluna| ≤ 1px
    nas duas pontas.
11. Cypress 400px: mapeamento pelo menu "Mapear origem" grava a mesma mudança do gate 3.
12. Screenshots Cypress da tela nos dois temas em `cypress/screenshots/transform-screen/` para revisão
    humana contra o protótipo.

## 5. Fora de escopo
Prévia de dados, execução de query, edição de `.sql` manual nesta tela, CTEs intermediárias
customizadas, window functions assistidas.
