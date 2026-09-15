# 0002 — Strata na família Atrium: shell do protótipo, nada de DBML, git com padrão

**Status:** aceita (2026-09-15) · **Emenda:** 0001 §4 (DBML como importador) e §7 (drawer)

## Contexto

O teste humano da PR 2 mostrou que o app herdou do LocalDrawDB menus, painéis e gestos (barra de
ações no topo, botão de modo linhagem, painel Camadas com lista de tabelas, presets e ajuda, aba
Registros flutuando no canvas). O resultado ficou mais pesado que o primeiro protótipo do Strata.
O Strata passa a fazer parte da família **Atrium** (`atrium/brand/`), ao lado de Structura e Acta.

## Decisões

1. **O protótipo é o contrato de UI.** `docs/prototypes/strata-shell.html` (publicado em
   <https://claude.ai/artifact/NoDkVcWEPqMNyyzxFj3D4m>, versão 7). Abrir no navegador e usar antes de
   implementar qualquer spec da PR 3. Onde spec e protótipo divergirem, **o protótipo vence**; a
   divergência vai no relatório.
2. **Nenhum recurso do LocalDrawDB é copiado.** Se uma função existe hoje, ela é repensada no
   formato do protótipo ou removida. "Já existe" não é argumento para manter.
3. **Zero DBML.** Sai da UI, do servidor, do importador, das fixtures, dos testes, do i18n e dos
   docs vivos. Substitui 0001 §4 ("DBML só como importador"). Projetos DBML existentes são
   convertidos uma vez por script (`scripts/migrate-dbml-to-dbt.mjs`) fora do app.
4. **Marca Atrium.** Símbolo e wordmark de `atrium/brand/strata/` (três camadas; a de cima Mauve,
   as outras Teal; wordmark Outfit Medium minúsculo). Teal é identidade, **não** semântica: na UI
   o acento continua Mauve, relacionamento Azul, linhagem Mauve, PK Verde.
5. **Um modo por vez no canvas:** `Linhagem | Relacionamentos`. O modo decide o que o canvas mostra,
   o que o arrasto cria, a cor da porta e o que "Arranjar" otimiza. Não existe botão "modo linhagem"
   separado.
6. **Linhagem é N:M por coluna.** Uma coluna pode ter várias origens e alimentar vários destinos. A
   transformação pertence ao **destino** (`config.meta.strata.transform` da coluna destino), então
   cada destino tem o seu ETL sobre as mesmas origens.
7. **Relacionamento aponta para PK ou para índice** (`via: pk | index`). Relacionar a coluna sem PK
   nem índice exige criar o índice ou mudar o alvo — nunca grava referência solta.
8. **Git com padrão.** Um domínio = um repositório = um projeto dbt. Domínio novo (clonar vazio ou
   criar do zero) nasce com o template da §P7 num único commit `chore(strata): inicializa domínio
   <nome>` em `main`. **Depois disso o Strata nunca commita em `main`**: pede uma branch
   `feat/<projeto>-<assunto>`. Abrir uma pasta dbt existente não reescreve nem commita nada.

## Consequências

- As fases D6 e D7 da migração dbt entram na PR 3 (D6 é absorvida pela P1).
- Os 163 Cypress da fixture DBML são reescritos sobre fixtures dbt ou apagados junto com a função
  que testavam; a contagem cai e o relatório lista cada remoção.
