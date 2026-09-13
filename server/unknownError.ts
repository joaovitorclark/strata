export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function errorMessage(e: unknown, fallback: string): string {
  if (!isRecord(e)) return fallback;
  if (typeof e.stderr === 'string' && e.stderr) return e.stderr;
  if (typeof e.message === 'string' && e.message) return e.message;
  return fallback;
}

export function isNotFound(e: unknown): boolean {
  return isRecord(e) && typeof e.message === 'string' && e.message.includes('não encontrado');
}

export function dbmlErrorMessage(e: unknown): string {
  if (!isRecord(e)) return 'DBML inválido';
  const diags = e.diags;
  if (Array.isArray(diags) && diags.length && isRecord(diags[0])) {
    const d = diags[0];
    if (typeof d.message === 'string') return d.message;
    if (typeof d.error === 'string') return d.error;
  }
  if (typeof e.message === 'string') return e.message;
  return 'DBML inválido';
}

export function errorMessageString(e: unknown): string | undefined {
  return isRecord(e) && typeof e.message === 'string' ? e.message : undefined;
}
