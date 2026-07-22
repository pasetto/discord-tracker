import { LANDING_MOTION } from './motion-tokens';

/** Seletores das seções que recebem reveal único no scroll. */
export const SCROLL_REVEAL_SECTION_SELECTORS = [
  '[data-testid="landing-problem"]',
  '[data-testid="landing-how"]',
  '[data-testid="landing-privacy"]',
  '#pricing',
  '[data-testid="landing-faq"]',
  '[data-testid="landing-final-cta"]',
] as const;

/**
 * Gate único para timelines anime.js na landing.
 * @param opts - Flags de a11y
 * @returns `false` sob reduced-motion
 */
export function shouldRunAnimeTimelines(opts: { reducedMotion: boolean }): boolean {
  return !opts.reducedMotion;
}

/**
 * Duração de exit (75% do enter correspondente).
 * @param enterMs - Duração de enter em ms
 * @returns Duração de exit arredondada
 */
export function exitDuration(enterMs: number): number {
  return Math.round(enterMs * LANDING_MOTION.exitFactor);
}

/**
 * Liga/desliga a classe que habilita estados “from” só com JS/motion.
 * @param root - Raiz da landing
 * @param enabled - Se motion está ativo
 */
export function applyMotionReadyClass(root: Element, enabled: boolean): void {
  root.classList.toggle('has-motion', enabled);
}

/**
 * Marca seção como já revelada (play once).
 * @param el - Elemento da seção
 */
export function markRevealPlayed(el: Element): void {
  el.setAttribute('data-motion-played', 'true');
}

/**
 * Indica se a seção já tocou o reveal.
 * @param el - Elemento da seção
 */
export function isRevealPlayed(el: Element): boolean {
  return el.getAttribute('data-motion-played') === 'true';
}

/**
 * Chips “Sumiu” no mock do hero.
 * @param root - Escopo de busca
 * @returns Elementos com `data-status="missing"`
 */
export function selectMissingStatusChips(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('[data-status="missing"]'));
}

/** Alvos lógicos do hero entrance (SYN-106 §2.1). */
export interface HeroEntranceTargets {
  brand: Element[];
  headline: Element | null;
  subcopy: Element | null;
  ctas: Element | null;
  trust: Element | null;
  mock: Element | null;
  mockChrome: Element[];
  members: Element[];
}

/**
 * Resolve alvos do hero a partir do DOM da landing.
 * @param root - Raiz (`main.landing-root` ou documento)
 */
export function resolveHeroEntranceTargets(root: ParentNode): HeroEntranceTargets {
  const hero = root.querySelector('[data-testid="landing-hero"]');
  const mock = root.querySelector('[data-testid="landing-hero-mock"]');
  const brand = Array.from(
    hero?.querySelectorAll('[data-motion="hero-brand"]') ?? [],
  );
  return {
    brand,
    headline: hero?.querySelector('[data-motion="hero-headline"]') ?? null,
    subcopy: hero?.querySelector('[data-motion="hero-sub"]') ?? null,
    ctas: hero?.querySelector('[data-motion="hero-ctas"]') ?? null,
    trust: hero?.querySelector('[data-motion="hero-trust"]') ?? null,
    mock,
    mockChrome: Array.from(mock?.querySelectorAll('[data-motion="mock-chrome"]') ?? []),
    members: Array.from(
      mock?.querySelectorAll('[data-testid="landing-hero-mock-members"] li') ?? [],
    ),
  };
}

/** API mínima do anime.js injetada para testes. */
export interface AnimeMotionApi {
  animate: (...args: unknown[]) => { pause?: () => void; cancel?: () => void };
  createTimeline: (params?: unknown) => {
    add: (...args: unknown[]) => unknown;
    call?: (...args: unknown[]) => unknown;
    pause?: () => void;
    cancel?: () => void;
  };
  stagger: (value: number) => unknown;
}

export interface PlayHeroEntranceOptions {
  root: ParentNode;
  reducedMotion: boolean;
  anime: AnimeMotionApi;
}

/**
 * Timeline de entrada do hero. No-op sob reduced-motion.
 * @param opts - DOM + API anime + a11y
 * @returns Handle cancelável ou `null`
 */
export function playHeroEntrance(
  opts: PlayHeroEntranceOptions,
): { cancel: () => void } | null {
  if (!shouldRunAnimeTimelines({ reducedMotion: opts.reducedMotion })) {
    return null;
  }

  const targets = resolveHeroEntranceTargets(opts.root);
  const { animate, createTimeline, stagger } = opts.anime;
  const m = LANDING_MOTION;

  const tl = createTimeline({ defaults: { ease: m.easeOutSoft } });

  if (targets.brand.length) {
    tl.add(
      targets.brand,
      {
        opacity: [0, 1],
        y: [m.yEnter, 0],
        duration: m.durationEnter,
        ease: m.easeOutSoft,
      },
      0,
    );
  }

  if (targets.headline) {
    tl.add(
      targets.headline,
      {
        opacity: [0, 1],
        y: [m.yEnter, 0],
        duration: m.durationHero,
        ease: m.easeOutSoft,
      },
      m.staggerBase,
    );
  }

  if (targets.subcopy) {
    tl.add(
      targets.subcopy,
      {
        opacity: [0, 1],
        y: [m.yEnter, 0],
        duration: m.durationEnter,
        ease: m.easeOut,
      },
      `+=${m.staggerBase}`,
    );
  }

  if (targets.ctas) {
    tl.add(
      targets.ctas,
      {
        opacity: [0, 1],
        duration: m.durationEnter,
        ease: m.easeOut,
      },
      `+=${m.staggerBase}`,
    );
  }

  if (targets.trust) {
    tl.add(
      targets.trust,
      {
        opacity: [0, 1],
        duration: m.durationFast,
        ease: m.easeOut,
      },
      `+=${m.staggerBase}`,
    );
  }

  if (targets.mock) {
    tl.add(
      targets.mock,
      {
        opacity: [0, 1],
        y: [m.yCard, 0],
        duration: m.durationHero,
        ease: m.easeOutSoft,
      },
      `+=${m.staggerCards}`,
    );
  }

  if (targets.mockChrome.length) {
    tl.add(
      targets.mockChrome,
      {
        opacity: [0, 1],
        duration: m.durationFast,
        ease: m.easeOut,
      },
      `+=${m.staggerTight}`,
    );
  }

  if (targets.members.length) {
    tl.add(
      targets.members,
      {
        opacity: [0, 1],
        y: [m.yMock, 0],
        duration: m.durationEnter,
        ease: m.easeOut,
        delay: stagger(m.staggerTight),
      },
      '<',
    );
  }

  const missing = targets.mock ? selectMissingStatusChips(targets.mock) : [];
  if (missing.length) {
    animate(missing, {
      scale: [1, m.sumiuPulseScale, 1, m.sumiuPulseScale, 1],
      duration: m.sumiuPulseMs,
      ease: m.easeOut,
      delay: m.durationEnter + m.staggerTight * missing.length,
    });
  }

  return {
    cancel: () => {
      tl.pause?.();
      tl.cancel?.();
    },
  };
}

export interface PlayModeToggleOptions {
  root: ParentNode;
  reducedMotion: boolean;
  anime: AnimeMotionApi;
  /** Chamado no meio do wipe (~120ms) para trocar conteúdo no DOM. */
  swapContent: () => void;
  /** Se o modo destino é Com Syntra (pulse em missing). */
  pulseMissing: boolean;
}

/**
 * Transição Sem/Com Syntra no mock (wipe + stagger + pulse).
 * @param opts - Escopo do mock + callbacks
 * @returns Handle cancelável ou `null` (swap imediato se reduced)
 */
export function playModeToggleTransition(
  opts: PlayModeToggleOptions,
): { cancel: () => void } | null {
  if (!shouldRunAnimeTimelines({ reducedMotion: opts.reducedMotion })) {
    opts.swapContent();
    return null;
  }

  const { animate, createTimeline, stagger } = opts.anime;
  const m = LANDING_MOTION;
  const content = opts.root.querySelector('[data-motion="mock-body"]') ?? opts.root;
  const members = Array.from(
    opts.root.querySelectorAll('[data-testid="landing-hero-mock-members"] li'),
  );
  const headline =
    opts.root.querySelector('[data-testid="landing-hero-mock-headline"]') ?? content;

  const tl = createTimeline();
  const exitMs = exitDuration(m.durationEnter);

  tl.add(
    [headline, ...members],
    {
      opacity: 0.35,
      y: -4,
      duration: m.durationInstant,
      ease: m.easeOut,
    },
    0,
  );

  tl.call?.(
    () => {
      opts.swapContent();
    },
    m.durationInstant,
  );

  tl.add(
    headline,
    {
      opacity: [0.35, 1],
      y: [m.yMock, 0],
      duration: m.durationLayout - m.durationInstant,
      ease: m.easeOutSoft,
    },
    m.durationInstant,
  );

  if (members.length) {
    tl.add(
      members,
      {
        opacity: [0.35, 1],
        y: [m.yMock, 0],
        duration: m.durationLayout - m.durationInstant,
        ease: m.easeOut,
        delay: stagger(m.staggerTight),
      },
      m.durationInstant,
    );
  }

  if (opts.pulseMissing) {
    const runPulse = () => {
      const chips = selectMissingStatusChips(opts.root);
      if (!chips.length) {
        return;
      }
      animate(chips, {
        scale: [1, m.sumiuPulseScale, 1, m.sumiuPulseScale, 1],
        duration: m.sumiuPulseMs,
        ease: m.easeOut,
      });
    };
    tl.call?.(runPulse, m.durationLayout);
    // Fallback se createTimeline mock não tiver `.call`
    if (!tl.call) {
      globalThis.setTimeout(runPulse, m.durationLayout);
    }
  }

  void exitMs;

  return {
    cancel: () => {
      tl.pause?.();
      tl.cancel?.();
    },
  };
}

export interface RevealSectionOptions {
  section: Element;
  reducedMotion: boolean;
  anime: AnimeMotionApi;
}

/**
 * Reveal de uma seção (heading → lead → filhos). Play once.
 * @param opts - Seção + anime API
 * @returns `true` se animou
 */
export function playSectionReveal(opts: RevealSectionOptions): boolean {
  if (!shouldRunAnimeTimelines({ reducedMotion: opts.reducedMotion })) {
    markRevealPlayed(opts.section);
    return false;
  }
  if (isRevealPlayed(opts.section)) {
    return false;
  }

  markRevealPlayed(opts.section);
  const m = LANDING_MOTION;
  const { animate, stagger } = opts.anime;

  const heading = opts.section.querySelector('[data-motion="reveal-heading"]');
  const lead = opts.section.querySelector('[data-motion="reveal-lead"]');
  const children = Array.from(
    opts.section.querySelectorAll('[data-motion="reveal-child"]'),
  ).slice(0, 6);
  const shell = opts.section.querySelector('[data-motion="reveal-shell"]');

  let delay = 0;
  if (shell) {
    animate(shell, {
      opacity: [0, 1],
      y: [m.yEnter, 0],
      duration: m.durationEnter,
      ease: m.easeOutSoft,
    });
    delay += m.staggerBase;
  }
  if (heading) {
    animate(heading, {
      opacity: [0, 1],
      y: [m.yEnter, 0],
      duration: m.durationEnter,
      ease: m.easeOut,
      delay,
    });
    delay += m.staggerBase;
  }
  if (lead) {
    animate(lead, {
      opacity: [0, 1],
      y: [m.yEnter, 0],
      duration: m.durationEnter,
      ease: m.easeOut,
      delay,
    });
    delay += m.staggerBase;
  }
  if (children.length) {
    animate(children, {
      opacity: [0, 1],
      y: [m.yCard, 0],
      duration: m.durationEnter,
      ease: m.easeOut,
      delay: stagger(m.staggerCards),
    });
  }

  return true;
}

/**
 * Observa seções e toca reveal uma vez.
 * @param root - Raiz da landing
 * @param opts - Flags + anime
 * @returns Cleanup do observer
 */
export function observeScrollReveals(
  root: ParentNode,
  opts: { reducedMotion: boolean; anime: AnimeMotionApi },
): () => void {
  if (!shouldRunAnimeTimelines({ reducedMotion: opts.reducedMotion })) {
    return () => undefined;
  }

  const sections = SCROLL_REVEAL_SECTION_SELECTORS.map((sel) =>
    root.querySelector(sel),
  ).filter((el): el is Element => Boolean(el));

  if (typeof IntersectionObserver === 'undefined') {
    sections.forEach((section) => playSectionReveal({ section, ...opts }));
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        playSectionReveal({ section: entry.target, ...opts });
        observer.unobserve(entry.target);
      }
    },
    {
      threshold: LANDING_MOTION.revealThreshold,
      rootMargin: '0px 0px -8% 0px',
    },
  );

  sections.forEach((section) => observer.observe(section));
  return () => observer.disconnect();
}

/**
 * Lazy-import do anime.js (só na rota landing).
 * @returns API usada pelos helpers
 */
export async function loadAnimeMotionApi(): Promise<AnimeMotionApi> {
  const mod = await import('animejs');
  return {
    animate: mod.animate as AnimeMotionApi['animate'],
    createTimeline: mod.createTimeline as AnimeMotionApi['createTimeline'],
    stagger: mod.utils.stagger as AnimeMotionApi['stagger'],
  };
}
