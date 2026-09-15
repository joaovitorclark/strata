# P2 — Shell do protótipo e marca Atrium

**Onda:** 2 (paralela à P3) · **Depende de:** P1 · **Decisão:** 0002 §1, §2, §4, §5

## 1. Resultado

O app tem exatamente a moldura do protótipo: navbar, trilho de ícones, painel lateral, canvas,
inspector e barra de status. Tudo que o LocalDrawDB trouxe e não aparece no protótipo sai.

## 2. Layout (conferir no protótipo)

**Navbar, da esquerda para a direita:** botão da família Atrium · marca `strata` · caminho
`<domínio> / <projeto>` (abre o seletor, P7) · chip da branch com contagem de mudanças (P7) ·
"Salvo no dbt" · espaço · busca `⌘K` · tema · Exportar `Spark` · Compartilhar.
**Sai do navbar:** Desfazer, Refazer, + Tabela, + Metadados, Importar (input/), Organizar DBML e
qualquer outro botão de ação de edição.

**Trilho:** Esquema · Camadas · Views · Código · (espaço) · Configurações. Clicar no ícone ativo
fecha o painel.

**Painéis:**
- *Esquema:* título com contagem e **+ tabela**; filtro de tabelas e colunas; grupos por camada com
  **+** no hover; linha = nome curto + contagem de colunas; clique centraliza e seleciona. Criar
  pelo painel: campo inline dentro do grupo, `Enter` cria naquela camada logo abaixo da última
  tabela da camada (sem sobrepor), centraliza e abre o `+ coluna` (P3). `Esc` cancela.
- *Camadas:* só as camadas do `dbt_project.yml`, com cor, contagem e olho (mostrar/ocultar) e uma
  frase explicando que mudar a camada move o arquivo. **Sem** lista de tabelas, presets ou ajuda.
- *Views:* recortes salvos em `.strata/<projeto>/views.yml` com contagem; "Tudo" primeiro.

**Barra de status:** Problemas (pill com contagem, abre lista navegável) · Código · espaço ·
seletor `Linhagem | Relacionamentos` (P4) · Arranjar (ícone, P6) · nível de detalhe
(`NOME | CHAVES | COLUNAS`) · zoom com slider. O nível de detalhe **segue o zoom** (<55%, 55–110%,
>110%), como no protótipo; "+ N colunas ocultas" expande só aquela tabela.

**Drawer de código:** abas `dbt · SQL · DDL Spark` da tabela selecionada, caminho do arquivo,
Copiar. Sem aba Registros; o CSV de um seed aparece como aba extra `seed` quando a tabela tem seed.

**Sem chrome flutuante no canvas** além da dica contextual no canto (rastreando, arrastando, view
ativa) e dos toasts. "Mudanças dbt" (`DbtChangeLog.tsx`) sai.

## 3. Ações sem botão

| Ação | Onde fica |
| --- | --- |
| Desfazer / Refazer | `⌘Z` / `⇧⌘Z`; toast "Desfazer" após ação destrutiva ou criação |
| Nova tabela | duplo clique no fundo · `⌘K` · + tabela no Esquema |
| Arranjar | ícone na barra · `⇧A` · `⌘K` |
| Trocar modo | seletor · `L` / `R` · `⌘K` |
| Ajustar à tela | `⌘0` · `⌘K` |
| Abrir projeto dbt / novo domínio | seletor de domínio (P7) · `⌘K` |

A paleta `⌘K` busca tabelas, colunas (a partir de 2 letras) e comandos, agrupados.

## 4. Marca

- Copiar `~/www/atrium/brand/strata/` inteiro para `public/brand/strata/` e o `mark-mono.svg` de
  `atrium`, `structura`, `acta`, `catena`, `custodia` para `public/brand/family/`.
- Favicon e `apple-touch-icon` a partir de `png/icon-*`. `<title>` = `strata`.
- Marca no navbar: símbolo com as cores por token (`--mauve` na camada de cima, `--teal` nas outras)
  e wordmark em Outfit Medium, minúsculo, `-0.02em`, símbolo 1,2× o texto. Outfit entra só para a
  marca (peso 500).
- Botão Atrium abre a lista da família como no protótipo; Catena (proposto) e Custodia (adiado)
  desativados; Structura e Acta abrem o app irmão quando configurado, senão toast explicando.
- Adicionar `--teal` e `--brand` a `design-system/globals.css`; **nenhum** uso de `--brand` fora da
  marca (gate).

## 5. Gates (12)

1. Vitest: `Navbar` não renderiza Desfazer, Refazer, + Tabela, + Metadados, Importar nem Organizar.
2. Vitest: `LayersPanel` lista só camadas com cor, contagem e olho; sem lista de tabelas nem presets.
3. `RecordsPanel.tsx`, `StatusLog.tsx`, `DbtChangeLog.tsx`, `PageImportWizard.tsx` e o toolbar
   flutuante do canvas apagados, com seus testes (listados em REMOVIDO) — ou justificativa.
4. Cypress: `⌘K` → "Nova tabela" → nome → tabela criada e `+ coluna` aberto; YAML criado.
5. Cypress: Esquema → + no grupo gold → `fct_teste` → `models/<projeto>/gold/_fct_teste.yml` existe,
   tabela visível sem sobrepor nenhuma outra (bounding boxes).
6. Cypress: `⌘Z` desfaz a criação (arquivo some); `⇧⌘Z` refaz.
7. Cypress: zoom 40% → nós em `NOME`; 90% → `CHAVES`; 130% → `COLUNAS` com filtro no nó.
8. Cypress: clicar em Problemas → item → tabela centralizada e selecionada.
9. Cypress: drawer abre pela barra; abas dbt/SQL/DDL mostram o arquivo da tabela selecionada.
10. Vitest: favicon e `<title>` corretos; `rg -- "--brand" src` só em `Brand*.tsx`.
11. Screenshot Cypress do shell (dark e light) anexado ao relatório, lado a lado com o protótipo.
12. Vitest: botão Atrium lista 5 produtos; 2 desativados.

## 6. Fora de escopo
Nó e portas (P3), modo e relacionamentos (P4), seletor de domínio e git (P7).
