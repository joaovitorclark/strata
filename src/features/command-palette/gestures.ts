import type { Command } from "./registry";

export type Gesture = { gesture: string; effect: string };

export type ShortcutRow = { keys: string; label: string };

export type ShortcutSpec = { mod?: boolean; shift?: boolean; alt?: boolean; key: string };

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable], .cm-editor"));
}

export const CANVAS_GESTURES: Gesture[] = [
  { gesture: "Hover em coluna ou ref", effect: "Destaca relações FK conectadas" },
  { gesture: "Arrastar coluna → coluna", effect: "Cria bloco Ref: no DBML" },
  { gesture: "Clicar em coluna", effect: "Abre o painel do campo" },
  { gesture: "Hover no nome da tabela", effect: "Abre metadados da tabela (tooltip)" },
  { gesture: "Cmd/Ctrl + clique ou arrasto", effect: "Seleciona várias tabelas" },
  { gesture: "Arrastar retângulo no canvas", effect: "Seleciona as tabelas cobertas" },
  { gesture: "Espaço + arrasto", effect: "Pan do canvas (cursor grab)" },
  {
    gesture: "Modo linhagem: arrastar entre pontos das colunas",
    effect: "Cria mapeamento de campo no DBML",
  },
  { gesture: "Delete", effect: "Remove ref selecionada" },
  { gesture: "Escape", effect: "1º limpa a coluna; 2º limpa a tabela e fecha modais" },
];

export const FIXED_SHORTCUT_SPECS: { label: string; spec: ShortcutSpec }[] = [
  { label: "Buscar comandos e tabelas", spec: { mod: true, key: "K" } },
  { label: "Remover ref selecionada", spec: { key: "Delete" } },
  { label: "Limpar seleção / fechar modais", spec: { key: "Escape" } },
  { label: "Atalhos e gestos", spec: { key: "?" } },
  { label: "Aumentar zoom", spec: { mod: true, key: "+" } },
  { label: "Reduzir zoom", spec: { mod: true, key: "-" } },
  { label: "Ajustar à tela", spec: { shift: true, key: "1" } },
  { label: "Zoom 100%", spec: { mod: true, key: "0" } },
  { label: "Nível de detalhe: Nome", spec: { key: "1" } },
  { label: "Nível de detalhe: Chaves", spec: { key: "2" } },
  { label: "Nível de detalhe: Colunas", spec: { key: "3" } },
  { label: "Nível de detalhe: Documentação", spec: { key: "4" } },
];

export function formatShortcut(mac: boolean, spec: ShortcutSpec): string {
  const key = spec.key.length === 1 && spec.key !== "?" ? spec.key.toUpperCase() : spec.key;
  if (mac) {
    let result = "";
    if (spec.mod) result += "⌘";
    if (spec.alt) result += "⌥";
    if (spec.shift) result += "⇧";
    return result + key;
  }
  const parts: string[] = [];
  if (spec.mod) parts.push("Ctrl");
  if (spec.alt) parts.push("Alt");
  if (spec.shift) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

function parseRegistryShortcut(shortcut: string, mac: boolean): string {
  const hasMod = shortcut.startsWith("Cmd/Ctrl");
  const rest = hasMod ? shortcut.slice("Cmd/Ctrl".length).replace(/^\+/, "") : shortcut;
  const hasShift = rest.startsWith("Shift+") || rest === "Shift";
  const key = hasShift ? rest.replace(/^Shift\+?/, "") : rest;
  return formatShortcut(mac, { mod: hasMod, shift: hasShift, key });
}

export function shortcutsFromCommands(commands: Command[], mac: boolean): ShortcutRow[] {
  const fromRegistry = commands
    .filter((command): command is Command & { shortcut: string } => Boolean(command.shortcut))
    .map((command) => ({
      keys: parseRegistryShortcut(command.shortcut, mac),
      label: command.label,
    }));

  const fixed = FIXED_SHORTCUT_SPECS.map(({ label, spec }) => ({
    keys: formatShortcut(mac, spec),
    label,
  }));

  return [...fromRegistry, ...fixed];
}
