/**
 * Detecta `prefers-reduced-motion: reduce` (injetável para testes).
 * @param matchMediaFn - Função estilo `window.matchMedia`
 * @returns `true` quando o usuário pediu menos motion
 */
export function prefersReducedMotion(
  matchMediaFn: (query: string) => Pick<MediaQueryList, 'matches'> = (query) =>
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia(query)
      : { matches: false },
): boolean {
  try {
    return Boolean(matchMediaFn('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}
