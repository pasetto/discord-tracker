/**
 * Boot client-side do motion system (lazy anime.js).
 * Respeita prefers-reduced-motion; no-op se falhar o import.
 * Aplica `has-motion` só depois do import OK — evita opacity:0 preso.
 */
import {
  applyMotionReadyClass,
  clearMotionGate,
  loadAnimeMotionApi,
  observeScrollReveals,
  playHeroEntrance,
} from './landing-motion';
import { prefersReducedMotion } from './prefers-reduced-motion';

/**
 * Inicializa entrance + scroll reveals na raiz da landing.
 * @returns Cleanup
 */
export async function bootLandingMotion(): Promise<() => void> {
  const root =
    document.querySelector<HTMLElement>('.landing-root') ?? document.body;
  const reduced = prefersReducedMotion();

  if (reduced) {
    applyMotionReadyClass(root, false);
    return () => undefined;
  }

  try {
    const anime = await loadAnimeMotionApi();
    applyMotionReadyClass(root, true);
    const heroHandle = playHeroEntrance({ root, reducedMotion: false, anime });
    const cleanupReveals = observeScrollReveals(root, {
      reducedMotion: false,
      anime,
    });
    return () => {
      heroHandle?.cancel();
      cleanupReveals();
    };
  } catch {
    clearMotionGate(root);
    return () => undefined;
  }
}

void bootLandingMotion();
