# Strata — Pesquisa de UX/UI e propostas

**Data:** 2026-09-13
**Status:** proposta para revisão. Substitui `docs/ux-direction.md`, que foi removido nesta branch.
**Referências estudadas:** Liam ERD (usado ao vivo sobre o `schema.rb` do Mastodon, ~200 tabelas),
erwin Data Modeler, Oracle SQL Developer Data Modeler.

---

## 0. Onde discordamos da direção anterior

`ux-direction.md` concluía que o apelo do Liam é **subtração** e propunha aproximar o nó do Strata do
nó do Liam (sem tipo, sem badges, cinza). Isso resolve o sintoma errado: o Liam é um *visualizador*,
e ferramentas de *modelagem* profissionais (erwin, Oracle) mostram **mais** informação, não menos —
elas só deixam o usuário **escolher quanto** ver e **para quem** está desenhando.

A linha desta proposta é outra:

> **Função de modelador (erwin/Oracle) + acabamento e navegação de visualizador (Liam).**
> Não esconder informação: dar ao usuário controles explícitos de *nível de detalhe*, *recorte* e
> *foco*, e deixar a tela quieta por padrão.

E uma decisão de domínio já tomada: **só existe linhagem de campo** (spec
`2026-09-13-field-lineage-only-design.md`, branch `feat/field-lineage-only`). Linhagem de tabela
deixa de ser um conceito; "tabela A alimenta B" é sempre *derivado* dos mapeamentos de campo.

---

## 1. O que as referências fazem bem

### 1.1 Liam ERD (observado ao vivo)

| Padrão | Detalhe observado | Valor para o Strata |
| --- | --- | --- |
| **Uma única barra flutuante** | pill central inferior: `− 46% +`, fit, auto-layout, `show: All Fields / Table Name / Key Only` | substitui os 8 overlays `z-20` do `Workspace.tsx` |
| **Densidade explícita** | o seletor `show` troca o nível de detalhe de *todas* as tabelas, independente do zoom | hoje o LOD do Strata muda sozinho com o zoom — imprevisível |
| **Estado na URL** | clicar numa tabela vira `?showMode=ALL_FIELDS&active=accounts`; botão **Copy Link** | link que abre o diagrama *no ponto da conversa* — perfeito para PRs no git |
| **Lista lateral = navegação** | clicar na tabela centraliza o canvas nela; ícone de olho oculta/mostra por tabela; "Hide All" | o `SchemaTree` do Strata seleciona mas **não navega** |
| **Foco por relacionamento** | tabela ativa destaca vizinhos e arestas; o resto recua | melhor que ligar/desligar categorias de aresta |
| **Inspetor de leitura rápida** | coluna → Type / Primary Key / Not null com glifos; seção **Related tables** com mini-diagrama | modelo para o Inspector do Strata |
| **Busca ⌘K** no topo | salta para qualquer tabela | já temos command palette — falta dar destaque |

### 1.2 erwin Data Modeler

- **Display levels** por diagrama: *Entity* (só nome) · *Primary Key* · *Keys* · *Attribute* ·
  *Definition*. É o `show:` do Liam, só que mais rico — inclui **mostrar a descrição/documentação** no
  nó, algo que nenhuma ferramenta web faz.
- **Key area**: a caixa da tabela tem uma linha horizontal separando a área de chave primária do
  resto das colunas. Leitura imediata de "o que identifica esta tabela" sem badge nenhum.
- **Subject areas** + **stored displays**: o mesmo modelo recortado em vários diagramas por assunto,
  cada um com seu layout e suas preferências de exibição. O Model Explorer tem uma aba por subject
  area para reduzir a árvore ao que importa.
- **Model Explorer sincronizado**: editar na árvore reflete no diagrama e vice-versa.
- Designadores configuráveis: `PK`, `FK`, `AK`, `IE` (índices), nulidade, tipo — cada um liga/desliga.

### 1.3 Oracle SQL Developer Data Modeler

- **Subviews**: diagramas independentes de um mesmo modelo (ex.: uma por schema na importação).
  Objetos são os mesmos; posição é por subview.
- **Displays**: abas no rodapé do diagrama, cada uma com **notação e nível de detalhe próprios** sobre
  o mesmo conjunto de objetos ("apresentação para negócio" vs "visão física").
- **Notação trocável**: Barker / Bachman / Information Engineering.
- **Domains**: tipos reutilizáveis (ex.: `email`, `cpf`, `money`) aplicados a colunas — a mudança no
  domínio propaga.
- **Navigator** (mini-mapa) sempre disponível para modelos grandes.

---

## 2. Diagnóstico do Strata hoje

Confirmado no código da `feat/migration-foundation`:

1. **Chrome flutuando sobre o canvas.** `Workspace.tsx` tem 8 blocos `absolute … z-20` (linhas 46,
   186, 196, 200, 239, 256, 266, 435), cinco no mesmo canto. O `AppShell` já tem slots de navbar,
   rail, árvore, inspector e status bar — eles estão sendo ignorados. Parte do canvas útil some.
2. **Árvore não navega** (`SchemaTree.tsx:147` chama só `selectTable`; `focusTableWithPan` existe).
3. **Controles mortos visíveis** (`docs/dead-affordances.md`): zoom `−/+` da status bar mostrando
   "100%" fixo, botão Share e avatar sem ação, rubber-band selection que não funciona, handles `fl:`
   inexistentes (linhagem de campo não pode ser criada).
4. **Três tipos de aresta com três toggles** (FK, linhagem de tabela, linhagem de campo). Com a
   decisão de linhagem só de campo, cai para dois — mas o problema de ruído continua sem controle de
   foco.
5. **LOD automático pelo zoom** muda o conteúdo sob o cursor enquanto o usuário navega, sem controle
   explícito.
6. **Nó da tabela sem hierarquia**: por linha, borda de camada · ícone · nome · `⋯` · ponto colorido ·
   nome · tipo · badge PK/FK, com várias cores competindo. Não há separação visual de chave.

---

## 3. Propostas

Prioridade: **P0** = destrava o uso diário · **P1** = diferencia · **P2** = profissionaliza.

### P0 — Fazer o que já existe funcionar

**P0.1 Chrome no frame, uma pill no canvas.**
Tudo que é ação vai para a navbar (Salvar, Diff, Importar, Exportar, + Tabela); Problems, estado de
salvamento e densidade vão para a status bar; camadas para o painel esquerdo. No canvas fica **uma**
barra flutuante inferior central, estilo Liam:

```
[ − 64% + ]  [ ⛶ fit ]  [ ⌗ auto-layout ]  │  Detalhe: Chaves ▾  │  Arestas: FK · Linhagem ▾  │  Foco ◎
```

Critério contável: `grep "absolute.*z-20" Workspace.tsx` → 1 ocorrência.

**P0.2 Árvore = navegação.** Clique centraliza e seleciona (`focusTableWithPan`); duplo clique abre
no inspector; ícone de olho por tabela para ocultar do canvas (como Liam). Busca no topo da árvore.

**P0.3 Eliminar ou ligar todo controle morto.** Zoom da status bar ligado ao viewport real; Share
vira **Copiar link** (P1.2); avatar some até existir conta; `panOnDrag={[1,2]}` + `selectionOnDrag`
para rubber-band com botão esquerdo e pan com espaço/botão do meio (padrão Figma/erwin).

**P0.4 Linhagem de campo criável.** Executar a spec field-lineage-only: handles `fl:` nas linhas,
aresta agregada "3 campos" quando as tabelas estão em LOD reduzido, toggle único **Linhagem**.

### P1 — Controles de leitura de modelador

**P1.1 Nível de detalhe explícito (display level).**
Seletor global com os níveis do erwin adaptados ao Strata:

| Nível | Mostra | Uso |
| --- | --- | --- |
| **Nome** | cabeçalho + contagem de colunas | visão geral de 200 tabelas |
| **Chaves** *(padrão)* | PK, FKs, colunas fixadas, colunas com linhagem | modelagem de relacionamentos |
| **Colunas** | todas as colunas, nome + tipo | modelagem física |
| **Documentação** | nome + descrição da tabela e das colunas com `note` | revisão com negócio |

- O zoom **não troca mais o nível**; abaixo de um limiar só simplifica a renderização (texto vira
  barra), mantendo o que o usuário escolheu.
- Override por tabela continua (fixar nível no menu do nó), e selecionar uma tabela a expande.
- Linhagem de campo acompanha: em **Colunas/Chaves** aresta coluna→coluna; em **Nome**, agregada.

**P1.2 Estado compartilhável na URL.**
`?project=vendas&view=silver&detail=keys&focus=pedido&col=cliente_id` + botão **Copiar link**.
Combina com o git: o link vai na descrição do PR e abre exatamente a tabela discutida.

**P1.3 Modo foco em vez de filtros de categoria.**
Selecionar uma tabela (ou pressionar `F`) mostra **só** ela e seus vizinhos a N saltos (1 por padrão,
`[`/`]` ajusta), com o resto em 15% de opacidade. Direção escolhível: *upstream* (de onde vêm os
campos), *downstream* (o que depende dela), *ambos*. Para linhagem de campo, clicar numa coluna
traça o caminho completo daquele campo bronze → silver → gold — **a funcionalidade que nem erwin nem
Liam têm e que é o diferencial do Strata**.

**P1.4 Views (subject areas / subviews).**
Diagramas salvos sobre o mesmo modelo DBML: conjunto de tabelas, posições e nível de detalhe
próprios. Sugestão inicial automática: uma view por camada medallion e uma por `TableGroup`. Abas no
rodapé do canvas (padrão Oracle "displays"). Persistência junto de `Pins {}`/`Colors {}` no DBML,
para passar pelo git.

### P2 — Acabamento visual

**P2.1 Nó da tabela redesenhado — hierarquia, não subtração.**

```
┌▌─────────────────────────────────────────┐
│▌ ▤ silver.pedido               187 ⋯     │  cabeçalho: nome mono; camada no ▌ lateral
│▌─────────────────────────────────────────│
│▌ ⚷ id              bigint                │  ← key area (PK) com fundo levemente elevado
│▌═════════════════════════════════════════│  ← separador de chave (erwin)
│▌ ↗ cliente_id      bigint                │  ↗ = FK (glifo, não badge)
│▌ ◆ status          varchar               │  ◆ = not null · ◇ = nullable
│▌ ⇢ valor_total     numeric(12,2)         │  ⇢ = tem linhagem de campo
│▌  + 183 colunas                          │
└──────────────────────────────────────────┘
```

- **Glifos** no lugar de badges PK/FK (legíveis a 12px, sem cor obrigatória): `⚷` PK, `↗` FK, `◆/◇`
  nulidade, `⇢` linhagem, `◈` índice/unique.
- **Divisória de linha** 1px entre colunas (tabela lê como tabela) e **divisória dupla** após a PK.
- Tipo em `--muted-foreground`, alinhado à direita, `tabular-nums`. Some só no nível *Nome*.
- **Cor:** uma cor semântica por vez. Camada só na borda lateral; cabeçalho neutro; o destaque
  (`--primary`) só para seleção/foco. Cores por tabela (`Colors {}`) ficam como tinta suave no
  cabeçalho, opcional.
- Ações (`⋯`, renomear, adicionar coluna) aparecem no hover/seleção — não em todas as linhas.

**P2.2 Arestas mais quietas que os nós.**
FK: 1px, neutra (`--rel-muted`), notação crow's foot com cardinalidade real (0..1, 1, N) —
**opção de notação** IE / Barker nas preferências do projeto, como no Oracle. Linhagem de campo:
teal tracejado, animação **só** no caminho em foco (não em todas — animação em centenas de arestas é
ruído e custo de CPU). Arestas ativas (hover/foco) sobem para `--rel-active` 2px.

**P2.3 Inspector de leitura e edição.**
Seções colapsáveis como no Liam: *Colunas* (cada uma com tipo, PK, nulidade, default, nota,
**linhagem de entrada/saída do campo**), *Relacionamentos*, *Tabelas relacionadas* (mini-diagrama
clicável), *Documentação* (markdown). Edição inline no mesmo lugar — é aqui que o Strata é modelador.

**P2.4 Mini-mapa e primeiro uso.**
Mini-mapa recolhível no canto da pill (Oracle Navigator). Estado vazio com **colar SQL/DBML/`schema.rb`
ou apontar um projeto dbt** → diagrama em segundos (a baixa fricção do Liam).

**P2.5 Domínios de coluna** (P2, depois das anteriores): tipos reutilizáveis estilo Oracle, mapeáveis
para testes do dbt (`not_null`, `accepted_values`).

---

## 4. Ordem sugerida

1. **P0.1 + P0.3** — um único plano: tirar o chrome do canvas e matar controles mortos.
2. **P0.4** — já especificado (field-lineage-only).
3. **P0.2 + P1.2** — navegação e link compartilhável (usam a mesma máquina de foco).
4. **P1.1 + P2.1** — nível de detalhe explícito e o novo nó (mudam o mesmo componente juntos).
5. **P1.3** — modo foco e rastreio de campo (depende de P0.4).
6. **P1.4, P2.2–P2.5.**

Cada item vira spec → plano → tarefas, conforme `AGENTS.md`. Linhas do `parity-inventory.md`
invalidadas por essas mudanças viram `dropped` com referência a esta pesquisa.

## 5. Decisões para o dono do produto

- Nível de detalhe desacoplado do zoom (P1.1): **recomendado**; LOD por zoom vira só simplificação.
- Notação IE como padrão, Barker opcional?
- Views persistidas no DBML (via git) ou em arquivo lateral do projeto?
- Animação de linhagem apenas em foco?

---

## Fontes

- Liam ERD — <https://liambx.com/erd/p/github.com/mastodon/mastodon/blob/main/db/schema.rb> (uso direto)
- erwin — [Set Table Display Preferences](https://bookshelf.erwin.com/bookshelf/public_html/Content/User%20Guides/erwin%20Help/Set_Table_Display_Preferences.html),
  [Logical Display Levels](https://bookshelf.erwin.com/bookshelf/9.7.00/Bookshelf_Files/HTML/erwin%20NE%20User/3326.html),
  [Navigator Edition User Guide 15.0](https://bookshelf.erwin.com/bookshelf/public_html/15.0/Content/PDFs/Navigator%20Edition%20User%20Guide.pdf)
- Oracle — [Using Displays](https://www.thatjeffsmith.com/archive/2013/02/oracle-sql-developer-data-modeler-using-displays/),
  [Use SubViews](https://www.thatjeffsmith.com/archive/2011/11/sql-developer-data-modeler-quick-tip-use-subviews/),
  [Data Modeler Concepts and Usage](https://docs.oracle.com/en/database/oracle/sql-developer-data-modeler/19.1/dmdug/data-modeler-concepts-usage.html)
