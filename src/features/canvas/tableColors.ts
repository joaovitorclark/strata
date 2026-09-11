/**
 * Header colours offered in the table colour picker. Catppuccin hues, in the
 * order the picker shows them. Values are the dark-theme Catppuccin hues: a saved
 * project stores the literal hex, so these are written out rather than read
 * from tokens, and existing projects keep whatever hex they already hold.
 */
export const TABLE_COLORS = [
  "#c6a0f6", // mauve
  "#8aadf4", // blue
  "#a6da95", // green
  "#eed49f", // yellow
  "#f5a97f", // peach
  "#ed8796", // red
  "#8bd5ca", // teal
  "#91d7e3", // sky
  "#b7bdf8", // lavender
  "#f5bde6", // pink
  "#ee99a0", // maroon
  "#939ab7", // overlay2
] as const;

export type TableColor = (typeof TABLE_COLORS)[number];
