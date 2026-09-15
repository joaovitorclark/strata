# S02 — Chrome no frame, uma pill no canvas

**Onda:** 1 · **Depende de:** — · **Pesquisa:** `ux-ui-research.md` §2.1, P0.1

## 1. Problema

`src/features/shell/Workspace.tsx` monta 8 overlays `absolute … z-20` por cima do canvas:
`EditorChrome` (top-left, linha ~435), botão `?` (top-right), `StatusLog`, `TableInfoPopover`,
`DraggableOverlay` de `LayersPanel` e `ColumnPanel`, `RecordsPanel` (bottom), `ProblemsPanel`
(bottom-right) e o card de settings. Além disso `Canvas.tsx` renderiza `<Controls />` e `<MiniMap />`
do React Flow. O `AppShell` já tem slots (navbar, rail, tree, canvas, inspector, drawer, statusbar)
que estão sendo ignorados.

## 2. Resultado esperado

```
┌ Navbar ───────────────────────────────────────────────────────────────────────────────┐
│ ◆ Strata  Domínio / Projeto ▾  git ▾ │ ↶ ↷ │ + Tabela  Importar  Organizar │ ⌘K │ Diff  Salvar ● auto │ Exportar ▾ │ ? ☾ │
├ rail ┬ painel esquerdo (aba: Tabelas | Camadas) ┬───────── canvas ─────────┬ Inspector ┤
│      │                                          │                          │           │
│      │                                          │   [ pill inferior ]      │           │
├──────┴──────────────────────────────────────────┴──────────────────────────┴───────────┤
│ Status: ✓ Problemas 0 · Salvo há 2 min · log ▾ │ </> DBML ▲ │ Registros ▲ │ Densidade │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Navbar
Recebe as ações do `EditorChrome`: Desfazer, Refazer, + Tabela, + Metadado, Importar, Organizar
DBML, Diff, Salvar (com rótulo de estado), switch Autosave, e o botão Ajuda (`?`). Agrupados com
separadores verticais na ordem do desenho. Em larguras < 1280px, o grupo "+ Tabela / + Metadado /
Importar / Organizar" colapsa num `DropdownMenu` "Mais ▾" (shadcn existente). Nada quebra linha:
`flex-nowrap`, `overflow-hidden`.

Props novas em `NavbarProps` (todas opcionais, o Navbar não conhece o store):
`history?: { canUndo; canRedo; onUndo; onRedo }`, `editActions?: { onAddTable; onAddMetadata;
onImport; onOrganize }`, `save?: { label; state; autoSave; onSave; onToggleAutoSave; onDiff }`,
`onHelp?`. Remova `onPrimaryAction` e `onAvatarClick` e seus botões (Share e avatar mortos — S06
adiciona "Copiar link").

### 2.2 Painel esquerdo com abas
O slot `tree` do `AppShell` passa a renderizar `LeftPanel` (novo, `shell/LeftPanel.tsx`) com abas
shadcn `Tabs`: **Tabelas** (`SchemaTree`) e **Camadas** (`LayersPanel`). O rail "tables"/"layers"
seleciona a aba. `LayersPanel` perde o `DraggableOverlay` e o estado `collapsed` flutuante (vira
conteúdo do painel, altura 100%, scroll próprio).

### 2.3 Inspector
`ColumnPanel` (mapeamentos de coluna) sai do overlay arrastável e vira **seção** dentro do
`Inspector`, visível quando há coluna ou tabela selecionada. Mantenha as mesmas props. S10 redesenha
depois; aqui é só realocar.

### 2.4 Status bar
- `ProblemsPanel` abre como `Popover` ancorado no botão "Problemas" da status bar (não mais canto do
  canvas).
- `StatusLog` vira item da status bar (texto do último status + `Popover` com o log).
- `RecordsPanel` vira aba do **drawer inferior** ao lado de DBML: o `SourceDrawer` ganha abas
  `</> DBML | Registros | Diff`. O `DbmlDiff` modal passa a ser a aba Diff. Botões "DBML" e
  "Registros" na status bar abrem o drawer já na aba.
- Settings (card flutuante) vira item do menu do `ProjectSwitcher` que já está na navbar; remova o
  card.
- `TableInfoPopover` no hover: sai do canto do canvas. Temporariamente deixe de montá-lo — S07
  coloca como tooltip no cabeçalho do nó. **Registre isso como pendência no relatório.**

### 2.5 Pill do canvas
Novo diretório `src/features/canvas/toolbar/`:

```
CanvasToolbar.tsx     container: absolute bottom-3 left-1/2 -translate-x-1/2 z-10, rounded-full,
                      bg-card/95 border shadow-md, h-9, gap-1, px-1.5; itens separados por <Separator vertical/>
ZoomControls.tsx      S02: placeholder que usa useReactFlow(): − / % / + / fit. S03 finaliza.
LayoutButton.tsx      chama onAutolayout (props)
DetailLevelSelect.tsx S02: exporta componente que retorna null. Dono: S05.
EdgeVisibility.tsx    S02: move os toggles "Relações" e "Linhagem" do LayersPanel para cá (DropdownMenu com CheckboxItems)
FocusControls.tsx     S02: retorna null. Dono: S08.
ViewTabs.tsx          S02: retorna null. Dono: S11.
MiniMapToggle.tsx     S02: retorna null. Dono: S12.
index.ts              barrel
```

`CanvasToolbar` é montado **dentro** de `<ReactFlow>` em `Canvas.tsx` (precisa do contexto do
`useReactFlow`) via uma prop `toolbar?: ReactNode` que o `Workspace` preenche. Remova `<Controls />`
e `<MiniMap />` do `Canvas.tsx` (MiniMap volta em S12).

**Dono do mount:** S02 monta `CanvasToolbar` com todos os slots, mesmo os que retornam null. As
specs posteriores só implementam o conteúdo de cada arquivo.

## 3. Fora de escopo
Novo visual do nó, zoom funcionando de verdade na status bar (S03), URL (S06).

## 4. Tarefas
1. Criar `canvas/toolbar/**` com os stubs e `CanvasToolbar`; adicionar prop `toolbar` ao `Canvas`.
2. Migrar ações do `EditorChrome` para `Navbar`; apagar `EditorChrome`.
3. Criar `LeftPanel` com abas; mover `LayersPanel`; ligar rail.
4. Mover `ColumnPanel` para seção do `Inspector`.
5. Drawer com abas DBML/Registros/Diff; status bar com Problemas/Log/Registros.
6. Remover `DraggableOverlay`, botão `?`, card settings, `Controls`, `MiniMap`.
7. i18n das novas strings; atualizar Cypress que dependia de seletores antigos (**seletor**, não
   asserção de comportamento — liste cada um).

## 5. Gates (10)
1. `grep -c "absolute" src/features/shell/Workspace.tsx` → **0**.
2. `grep -rn "DraggableOverlay\|EditorChrome" src/` → 0 fora de testes de remoção.
3. Cypress `shell-chrome.cy.ts`: Desfazer na navbar após adicionar tabela → DBML volta ao anterior.
4. Cypress: "+ Tabela" na navbar → DBML ganha um bloco `Table`.
5. Cypress: Salvar na navbar → rótulo muda para "Salvo".
6. Cypress: clicar "Problemas" na status bar abre popover com a lista.
7. Cypress: "Registros" na status bar abre drawer na aba Registros.
8. Cypress: aba Camadas no painel esquerdo mostra `LayersPanel`.
9. Cypress: pill visível e centralizada (|centroX pill − centroX canvas| < 4px); após "fit", o
   `bottom` do nó mais baixo fica acima do `top` da pill (o fit usa padding inferior ≥ altura da
   pill + 12px).
10. Cypress 1280×720: navbar em uma linha (altura ≤ 48px).
