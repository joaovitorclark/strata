export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type StatusIcon = 'warning' | 'dot' | 'check' | null;

export function statusLabel(
  saveState: SaveState,
  status: string,
): { text: string; cls: string; icon: StatusIcon } {
  const cls = `savestate--${saveState}`;
  if (saveState === 'saving') return { text: 'Salvando…', cls, icon: null };
  if (saveState === 'error') return { text: 'Falha ao salvar', cls, icon: 'warning' };
  if (saveState === 'dirty') return { text: 'Não salvo', cls, icon: 'dot' };
  if (status !== 'Pronto') return { text: status, cls, icon: null };
  return { text: 'Salvo', cls, icon: 'check' };
}
