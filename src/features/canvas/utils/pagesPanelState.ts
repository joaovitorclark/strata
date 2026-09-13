/** Núcleo puro de parse de flag de colapso (preservado para tests). */
export function parsePagesCollapsed(raw: string | null): boolean {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return true;
}
