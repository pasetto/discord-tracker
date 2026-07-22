/**
 * Boot client-side do motion system (lazy anime.js).
 * Respeita prefers-reduced-motion; no-op se falhar o import.
 */
import {
  applyMotionReadyClass,
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

  applyMotionReadyClass(root, true);

  try {
    const anime = await loadAnimeMotionApi();
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
    applyMotionReadyClass(root, false);
    return () => undefined;
  }
}

void bootLandingMotion();
