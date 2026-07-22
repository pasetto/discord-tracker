/**
 * Client script: toggle Sem/Com Syntra no hero mock + timelines anime.js.
 */
import {
  loadAnimeMotionApi,
  playModeToggleTransition,
  type AnimeMotionApi,
} from '../scripts/motion/landing-motion.ts';
import { prefersReducedMotion } from '../scripts/motion/prefers-reduced-motion.ts';

type HeroMockMode = 'without' | 'with';
type HeroMockStatus = 'online' | 'collaborating' | 'missing' | 'pto';

interface HeroMockMember {
  name: string;
  initials: string;
  avatarTone: string;
  withoutStatus: HeroMockStatus;
  withStatus: HeroMockStatus;
}

const MEMBERS: HeroMockMember[] = [
  {
    name: 'Ana',
    initials: 'A',
    avatarTone: 'sky',
    withoutStatus: 'online',
    withStatus: 'collaborating',
  },
  {
    name: 'Bruno',
    initials: 'B',
    avatarTone: 'emerald',
    withoutStatus: 'online',
    withStatus: 'missing',
  },
  {
    name: 'Camila',
    initials: 'C',
    avatarTone: 'amber',
    withoutStatus: 'online',
    withStatus: 'pto',
  },
  {
    name: 'Diego',
    initials: 'D',
    avatarTone: 'rose',
    withoutStatus: 'online',
    withStatus: 'missing',
  },
  {
    name: 'Elena',
    initials: 'E',
    avatarTone: 'indigo',
    withoutStatus: 'online',
    withStatus: 'missing',
  },
];

function statusLabel(status: HeroMockStatus): string {
  switch (status) {
    case 'collaborating':
      return 'Colaborando';
    case 'missing':
      return 'Sumiu';
    case 'pto':
      return 'Em PTO';
    default:
      return 'Online';
  }
}

function renderMembers(root: HTMLElement, mode: HeroMockMode): void {
  const list = root.querySelector<HTMLElement>('[data-testid="landing-hero-mock-members"]');
  const headline = root.querySelector<HTMLElement>('[data-testid="landing-hero-mock-headline"]');
  const support = root.querySelector<HTMLElement>('[data-testid="landing-hero-mock-support"]');
  if (!list || !headline) return;

  headline.textContent =
    mode === 'with'
      ? 'Três pessoas sumiram da colaboração hoje.'
      : 'Todo mundo “online”. Ninguém sabe quem sumiu.';

  if (support) {
    support.textContent =
      mode === 'without' ? 'AFK misturado com trabalho. PTO fora da cabeça.' : '';
    support.hidden = mode !== 'without';
  }

  list.innerHTML = MEMBERS.map((member) => {
    const status = mode === 'with' ? member.withStatus : member.withoutStatus;
    return `
      <li class="hero-mock__member">
        <div class="hero-mock__person">
          <span class="hero-mock__avatar hero-mock__avatar--${member.avatarTone}" aria-hidden="true">${member.initials}</span>
          <span class="hero-mock__name">${member.name}</span>
        </div>
        <span class="hero-mock__chip hero-mock__chip--${status}" data-status="${status}">${statusLabel(status)}</span>
      </li>
    `;
  }).join('');
}

/**
 * Liga o toggle Sem/Com Syntra no mock do hero.
 * @param root - Contêiner do mock
 */
export function bindHeroLiveMock(root: HTMLElement): void {
  let mode: HeroMockMode = 'with';
  let animeApi: AnimeMotionApi | null = null;
  let animeLoad: Promise<AnimeMotionApi | null> | null = null;
  let cancelToggle: (() => void) | null = null;
  let toggleSeq = 0;

  const withoutBtn = root.querySelector<HTMLButtonElement>(
    '[data-testid="landing-hero-toggle-without"]',
  );
  const withBtn = root.querySelector<HTMLButtonElement>(
    '[data-testid="landing-hero-toggle-with"]',
  );

  const syncToggleUi = () => {
    root.setAttribute('data-mode', mode);
    if (withoutBtn) {
      withoutBtn.setAttribute('aria-checked', String(mode === 'without'));
      withoutBtn.classList.toggle('is-active', mode === 'without');
    }
    if (withBtn) {
      withBtn.setAttribute('aria-checked', String(mode === 'with'));
      withBtn.classList.toggle('is-active', mode === 'with');
    }
  };

  const ensureAnime = async (): Promise<AnimeMotionApi | null> => {
    if (animeApi) return animeApi;
    if (!animeLoad) {
      animeLoad = loadAnimeMotionApi()
        .then((api) => {
          animeApi = api;
          return api;
        })
        .catch(() => null);
    }
    return animeLoad;
  };

  const setMode = (next: HeroMockMode) => {
    if (next === mode) return;

    const reduced = prefersReducedMotion();
    if (reduced) {
      mode = next;
      renderMembers(root, mode);
      syncToggleUi();
      return;
    }

    const seq = ++toggleSeq;
    void (async () => {
      const anime = await ensureAnime();
      if (seq !== toggleSeq) return;
      if (!anime) {
        mode = next;
        renderMembers(root, mode);
        syncToggleUi();
        return;
      }

      cancelToggle?.();
      const handle = playModeToggleTransition({
        root,
        reducedMotion: false,
        anime,
        pulseMissing: next === 'with',
        swapContent: () => {
          if (seq !== toggleSeq) return;
          mode = next;
          renderMembers(root, mode);
          syncToggleUi();
        },
      });
      cancelToggle = handle?.cancel ?? null;
    })();
  };

  withoutBtn?.addEventListener('click', () => setMode('without'));
  withBtn?.addEventListener('click', () => setMode('with'));

  renderMembers(root, mode);
  syncToggleUi();
}

const mockRoot = document.querySelector<HTMLElement>('[data-testid="landing-hero-mock"]');
if (mockRoot) {
  bindHeroLiveMock(mockRoot);
}
