# P7 — Domínios, primeiro commit padrão e nunca commitar em `main`

**Onda:** 3 (paralela à P4) · **Depende de:** P2 · **Decisão:** 0002 §8

## 1. Resultado

Trocar de domínio e projeto, clonar, criar e abrir pastas dbt pelo seletor do caminho no navbar,
com um template versionado para repositórios novos e um fluxo de commit que segue padrão.
O fluxo atual (`DomainPicker`, `GitPanel`, `CredentialsWizard`, `bootstrapEmptyRepo` com
"first commit") é **substituído**, não ajustado.

## 2. Conceitos

- **Domínio** = um repositório git = um projeto dbt (`dbt_project.yml` na raiz).
- **Projeto Strata** = pasta `models/<projeto>/` + `.strata/<projeto>/`.

## 3. Seletor (clique em `<domínio> / <projeto>`)

Lista por domínio (nome · remoto ou "só local"), projetos com contagem de tabelas, o atual marcado.
Rodapé: **+ Projeto em `<domínio>`** e **+ Domínio**.

**+ Projeto:** nome → cria `models/<projeto>/{bronze,silver,gold}/.gitkeep` e
`.strata/<projeto>/project.yml`; com git, entra nas mudanças pendentes (não commita sozinho).

**+ Domínio** — modal com três origens (como no protótipo):

| Origem | Campos | O que acontece |
| --- | --- | --- |
| Clonar repositório | URL, nome (sugerido da URL), primeiro projeto, adapter | clona; **vazio** → aplica o template e faz o primeiro commit em `main` e envia; **com `dbt_project.yml`** → só abre; **sem dbt e não vazio** → oferece aplicar o template num commit separado, sem tocar no que existe |
| Criar do zero | nome, primeiro projeto, adapter | `git init -b main`, template, primeiro commit; remoto conectado depois |
| Abrir pasta dbt | caminho | não reescreve nem commita nada; projetos = pastas de `models/`; `.strata/` só nasce no primeiro salvamento |

O lado direito do modal mostra a **prévia do primeiro commit** (árvore + mensagem) atualizada ao digitar.

## 4. Template (`server/domainTemplate/`)

```
<domínio>/
├─ dbt_project.yml        # name: <domínio_snake>, profile: <domínio_snake>, model-paths, seeds, +materialized por camada
├─ packages.yml           # dbt_utils com versão fixada
├─ profiles.example.yml   # adapter escolhido (spark/databricks/duckdb), sem segredo
├─ models/<projeto>/{bronze,silver,gold}/.gitkeep
├─ seeds/.gitkeep
├─ .strata/domain.yml     # formato, camadas e cores
├─ .strata/<projeto>/project.yml
├─ .gitignore             # target/ dbt_packages/ logs/ profiles.yml .env
├─ .gitattributes         # models/**/*.sql linguist-generated=true (D5)
└─ README.md              # o que é, como abrir no Strata, como rodar dbt
```
Mensagem: `chore(strata): inicializa domínio <nome>`. Branch: `main`. Autor: o do git local.
O template é gerado por código testado, não copiado de uma pasta de exemplo.

## 5. Commit do dia a dia (chip da branch no navbar)

- Chip: nome da branch + contagem de arquivos alterados.
- Popover: arquivos (`A`/`M`/`D` + caminho), mensagem **sugerida** das mudanças no padrão
  Conventional Commits em português (`feat(<projeto>): …`, `fix`, `refactor`, `chore`; corpo com um
  item por tabela/coluna tocada), botões **Commit**, **Commit e enviar**, **Atualizar** (`pull --ff-only`).
  Depois de enviar: toast com **Abrir PR** (URL de comparação do remoto).
- **Em `main` (ou na branch padrão do remoto):** Commit fica bloqueado; o popover mostra **Criar
  branch** com nome sugerido `feat/<projeto>-<assunto>` (assunto = 2–4 palavras da mensagem, slug) e
  commita nela. Única exceção: o primeiro commit do template.
- Pull com mudanças locais → mensagem "Commit ou descarte antes de atualizar", sem stash automático.
- Credenciais: usa o helper do git do sistema; sem wizard próprio. Falha de autenticação → mensagem
  com o comando para o usuário rodar.

## 6. Gates (12)

1. Vitest (servidor): template para `logistica` + `entregas` + spark → árvore exata da §4;
   `dbt parse` do resultado exit 0 (`validate.sh`).
2. Vitest: "Criar do zero" → 1 commit em `main` com a mensagem exata; working tree limpo.
3. Vitest: clonar repositório vazio (bare local) → 1 commit enviado ao remoto.
4. Vitest: clonar repositório com `dbt_project.yml` → zero commits novos e nenhum arquivo alterado.
5. Vitest: pasta dbt existente aberta → nenhum arquivo criado até a primeira edição; na primeira
   edição só `.strata/**` e o arquivo editado.
6. Vitest: commit em `main` pela API → erro `COMMIT_ON_DEFAULT_BRANCH`; com `createBranch` → commit na branch nova.
7. Vitest: sugestão de mensagem para mudanças em `_pedido.yml` e `canvas.yml` começa com `feat(vendas):`
   e lista as tabelas.
8. Vitest: nome de branch sugerido é slug válido (`git check-ref-format`).
9. Cypress: seletor → + Projeto → pastas criadas; aparece na lista com 0 tabelas.
10. Cypress: modal + Domínio → trocar origem atualiza a prévia; nome digitado aparece na árvore e na mensagem.
11. Cypress: em `main`, chip → Commit desabilitado e "Criar branch" visível.
12. `DomainPicker.tsx`, `GitPanel.tsx`, `CredentialsWizard.tsx` e `bootstrapEmptyRepo` apagados (REMOVIDO).

## 7. Fora de escopo
Abrir PR pela API do GitHub, revisão dentro do app, múltiplos remotos.
