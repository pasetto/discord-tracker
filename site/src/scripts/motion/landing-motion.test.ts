/**
 * Specs do motion system da landing Astro (SYN-111) — port dos helpers Angular.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANDING_MOTION } from './motion-tokens';
import {
  type AnimeMotionApi,
  applyMotionReadyClass,
  clearMotionGate,
  exitDuration,
  HERO_ENTRANCE_FAILSAFE_MS,
  isRevealPlayed,
  loadAnimeMotionApi,
  markRevealPlayed,
  playHeroEntrance,
  playModeToggleTransition,
  playSectionReveal,
  selectMissingStatusChips,
  shouldRunAnimeTimelines,
  SCROLL_REVEAL_SECTION_SELECTORS,
} from './landing-motion';
import { prefersReducedMotion } from './prefers-reduced-motion';

function createAnimeMock(): AnimeMotionApi & {
  animate: ReturnType<typeof vi.fn>;
  createTimeline: ReturnType<typeof vi.fn>;
  stagger: ReturnType<typeof vi.fn>;
} {
  const timeline = {
    add: vi.fn(function (this: unknown) {
      return this;
    }),
    call: vi.fn(function (this: unknown) {
      return this;
    }),
    pause: vi.fn(),
    cancel: vi.fn(),
  };
  return {
    animate: vi.fn(),
    createTimeline: vi.fn(() => timeline),
    stagger: vi.fn((v: number) => v),
  };
}

describe('site landing motion (SYN-111)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('expõe tokens alinhados ao motion-direction SYN-106', () => {
    expect(LANDING_MOTION.durationEnter).toBe(280);
    expect(LANDING_MOTION.durationHero).toBe(420);
    expect(LANDING_MOTION.durationLayout).toBe(360);
    expect(LANDING_MOTION.durationInstant).toBe(120);
    expect(LANDING_MOTION.easeOut).toBe('outQuart');
    expect(LANDING_MOTION.easeOutSoft).toBe('outQuint');
    expect(LANDING_MOTION.yEnter).toBe(12);
    expect(LANDING_MOTION.yMock).toBe(8);
    expect(LANDING_MOTION.yCard).toBe(16);
    expect(LANDING_MOTION.staggerTight).toBe(40);
    expect(LANDING_MOTION.staggerBase).toBe(60);
    expect(LANDING_MOTION.staggerCards).toBe(80);
    expect(LANDING_MOTION.sumiuPulseScale).toBe(1.04);
  });

  it('prefersReducedMotion lê matchMedia reduce', () => {
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);
    expect(prefersReducedMotion(() => ({ matches: false }))).toBe(false);
  });

  it('shouldRunAnimeTimelines é false sob reduced-motion', () => {
    expect(shouldRunAnimeTimelines({ reducedMotion: true })).toBe(false);
    expect(shouldRunAnimeTimelines({ reducedMotion: false })).toBe(true);
  });

  it('exitDuration aplica fator 75%', () => {
    expect(exitDuration(280)).toBe(210);
    expect(exitDuration(400)).toBe(300);
  });

  it('applyMotionReadyClass liga/desliga has-motion', () => {
    const root = document.createElement('main');
    applyMotionReadyClass(root, true);
    expect(root.classList.contains('has-motion')).toBe(true);
    applyMotionReadyClass(root, false);
    expect(root.classList.contains('has-motion')).toBe(false);
  });

  it('markRevealPlayed / isRevealPlayed usam data-motion-played', () => {
    const section = document.createElement('section');
    expect(isRevealPlayed(section)).toBe(false);
    markRevealPlayed(section);
    expect(section.getAttribute('data-motion-played')).toBe('true');
    expect(isRevealPlayed(section)).toBe(true);
  });

  it('selectMissingStatusChips filtra só missing', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <span data-status="online"></span>
      <span data-status="missing"></span>
      <span data-status="missing"></span>
      <span data-status="pto"></span>
    `;
    expect(selectMissingStatusChips(root).length).toBe(2);
  });

  it('lista seções de scroll reveal da landing', () => {
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('[data-testid="landing-problem"]');
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('[data-testid="landing-product"]');
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('[data-testid="landing-how"]');
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('[data-testid="landing-privacy"]');
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('#pricing');
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('[data-testid="landing-faq"]');
    expect(SCROLL_REVEAL_SECTION_SELECTORS).toContain('[data-testid="landing-final-cta"]');
  });

  it('clearMotionGate remove has-motion para não deixar opacity:0 preso', () => {
    const root = document.createElement('main');
    root.classList.add('landing-root', 'has-motion');
    root.innerHTML = `<h1 data-motion="hero-headline" style="opacity: 0">Quem sumiu</h1>`;
    clearMotionGate(root);
    expect(root.classList.contains('has-motion')).toBe(false);
    const headline = root.querySelector<HTMLElement>('[data-motion="hero-headline"]');
    expect(headline?.style.opacity).toBe('1');
  });

  it('playHeroEntrance não cria timeline sob reduced-motion', () => {
    const anime = createAnimeMock();
    const root = document.createElement('div');
    const handle = playHeroEntrance({ root, reducedMotion: true, anime });
    expect(handle).toBeNull();
    expect(anime.createTimeline).not.toHaveBeenCalled();
  });

  it('playHeroEntrance cria timeline quando motion permitido', () => {
    const anime = createAnimeMock();
    const root = document.createElement('div');
    root.innerHTML = `
      <section data-testid="landing-hero">
        <img data-motion="hero-brand" data-testid="landing-hero-logo" />
        <h1 data-motion="hero-headline">Quem sumiu</h1>
        <p data-motion="hero-sub">Radar</p>
        <div data-motion="hero-ctas"><a href="/signup">Criar conta</a></div>
        <p data-motion="hero-trust">Sem cartão</p>
        <div data-testid="landing-hero-mock">
          <div data-motion="mock-chrome">Time agora</div>
          <ul data-testid="landing-hero-mock-members">
            <li><span data-status="missing">Sumiu</span></li>
          </ul>
        </div>
      </section>
    `;
    const handle = playHeroEntrance({ root, reducedMotion: false, anime });
    expect(handle).not.toBeNull();
    expect(anime.createTimeline).toHaveBeenCalled();
    expect(anime.animate).toHaveBeenCalled();
  });

  it('playHeroEntrance termina chrome+members antes do fail-safe (SYN-121)', async () => {
    const root = document.createElement('main');
    root.classList.add('landing-root', 'has-motion');
    root.innerHTML = `
      <section data-testid="landing-hero">
        <img data-motion="hero-brand" data-testid="landing-hero-logo" />
        <h1 data-motion="hero-headline">Quem sumiu</h1>
        <p data-motion="hero-sub">Radar</p>
        <div data-motion="hero-ctas"><a href="/signup">Criar conta</a></div>
        <p data-motion="hero-trust">Sem cartão</p>
        <div data-testid="landing-hero-mock">
          <div data-motion="mock-chrome">Time agora</div>
          <ul data-testid="landing-hero-mock-members">
            <li>A</li><li>B</li><li>C</li><li>D</li><li>E</li>
          </ul>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    const anime = await loadAnimeMotionApi();
    const realCreate = anime.createTimeline;
    let timelineDuration = 0;
    anime.createTimeline = ((params?: unknown) => {
      const tl = realCreate({
        ...(typeof params === 'object' && params ? params : {}),
        autoplay: false,
      });
      const realAdd = tl.add.bind(tl);
      tl.add = (...args: unknown[]) => {
        const result = realAdd(...args);
        timelineDuration = (tl as { duration: number }).duration;
        return result;
      };
      return tl;
    }) as AnimeMotionApi['createTimeline'];

    const handle = playHeroEntrance({ root, reducedMotion: false, anime });
    expect(handle).not.toBeNull();
    expect(timelineDuration).toBeGreaterThan(0);
    // Sequential += chain used to land ~2400ms > fail-safe, leaving chrome/members at opacity 0.
    expect(timelineDuration).toBeLessThan(HERO_ENTRANCE_FAILSAFE_MS);
  });

  it('playHeroEntrance sucesso não remove has-motion no fail-safe (SYN-121)', () => {
    vi.useFakeTimers();
    const anime = createAnimeMock();
    const root = document.createElement('main');
    root.classList.add('landing-root', 'has-motion');
    root.innerHTML = `
      <section data-testid="landing-hero">
        <h1 data-motion="hero-headline">Quem sumiu</h1>
        <div data-testid="landing-hero-mock">
          <div data-motion="mock-chrome">chrome</div>
          <ul data-testid="landing-hero-mock-members"><li>A</li></ul>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    let onComplete: (() => void) | undefined;
    anime.createTimeline = vi.fn((params?: { onComplete?: () => void }) => {
      onComplete = params?.onComplete;
      return {
        add: vi.fn(function (this: unknown) {
          return this;
        }),
        call: vi.fn(function (this: unknown) {
          return this;
        }),
        pause: vi.fn(),
        cancel: vi.fn(),
      };
    });

    playHeroEntrance({ root, reducedMotion: false, anime });
    expect(typeof onComplete).toBe('function');
    onComplete?.();
    vi.advanceTimersByTime(HERO_ENTRANCE_FAILSAFE_MS + 100);
    expect(root.classList.contains('has-motion')).toBe(true);
    vi.useRealTimers();
  });

  it('playModeToggleTransition sob reduced-motion só faz swap', () => {
    const anime = createAnimeMock();
    let swapped = false;
    const handle = playModeToggleTransition({
      root: document.createElement('div'),
      reducedMotion: true,
      anime,
      pulseMissing: true,
      swapContent: () => {
        swapped = true;
      },
    });
    expect(handle).toBeNull();
    expect(swapped).toBe(true);
    expect(anime.createTimeline).not.toHaveBeenCalled();
  });

  it('playModeToggleTransition cancel impede swap tardio', () => {
    const anime = createAnimeMock();
    const root = document.createElement('div');
    root.innerHTML = `
      <p data-testid="landing-hero-mock-headline">Antes</p>
      <ul data-testid="landing-hero-mock-members"><li>A</li></ul>
    `;
    let swaps = 0;
    const handle = playModeToggleTransition({
      root,
      reducedMotion: false,
      anime,
      pulseMissing: false,
      swapContent: () => {
        swaps += 1;
      },
    });
    expect(handle).not.toBeNull();
    handle?.cancel();
    const callSpy = anime.createTimeline.mock.results[0]?.value.call as ReturnType<typeof vi.fn>;
    const swapCb = callSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(typeof swapCb).toBe('function');
    swapCb?.();
    expect(swaps).toBe(0);
  });

  it('playSectionReveal marca played e anima filhos', () => {
    const anime = createAnimeMock();
    const section = document.createElement('section');
    section.innerHTML = `
      <h2 data-motion="reveal-heading">Título</h2>
      <p data-motion="reveal-lead">Lead</p>
      <article data-motion="reveal-child">A</article>
      <article data-motion="reveal-child">B</article>
    `;
    expect(playSectionReveal({ section, reducedMotion: false, anime })).toBe(true);
    expect(isRevealPlayed(section)).toBe(true);
    expect(anime.animate).toHaveBeenCalled();
    expect(playSectionReveal({ section, reducedMotion: false, anime })).toBe(false);
  });
});
