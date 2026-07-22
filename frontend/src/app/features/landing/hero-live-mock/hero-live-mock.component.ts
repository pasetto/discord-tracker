import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import {
  AnimeMotionApi,
  loadAnimeMotionApi,
  playModeToggleTransition,
} from '../motion/landing-motion';
import { prefersReducedMotion } from '../motion/prefers-reduced-motion';

/** Modo do toggle Sem Syntra / Com Syntra no mock do hero. */
export type HeroMockMode = 'without' | 'with';

/** Status visual de um membro no mock. */
export type HeroMockStatus = 'online' | 'collaborating' | 'missing' | 'pto';

/**
 * Membro fictício exibido no painel “Time agora”.
 */
export interface HeroMockMember {
  /** Nome fictício (claramente fake). */
  name: string;
  /** Iniciais do avatar CSS. */
  initials: string;
  /** Classe Tailwind de fundo do avatar. */
  avatarClass: string;
  /** Status no modo Sem Syntra. */
  withoutStatus: HeroMockStatus;
  /** Status no modo Com Syntra. */
  withStatus: HeroMockStatus;
}

/**
 * Mock interativo P0: “Time agora / quem sumiu” com toggle Sem/Com Syntra.
 * Transições anime.js lazy; swap instantâneo sob reduced-motion.
 */
@Component({
  selector: 'app-hero-live-mock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-live-mock.component.html',
  styles: [
    `
      .hero-mock-fade {
        transition: opacity 200ms ease;
      }

      @media (prefers-reduced-motion: reduce) {
        .hero-mock-fade {
          transition: none;
        }
      }
    `,
  ],
})
export class HeroLiveMockComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private animeApi: AnimeMotionApi | null = null;
  private animeLoad: Promise<AnimeMotionApi | null> | null = null;
  private cancelToggle: (() => void) | null = null;
  private destroyed = false;
  private toggleSeq = 0;

  /** Modo ativo do painel (default: Com Syntra). */
  mode: HeroMockMode = 'with';

  /** Cinco membros fictícios do mock. */
  readonly members: HeroMockMember[] = [
    {
      name: 'Ana',
      initials: 'A',
      avatarClass: 'bg-sky-600',
      withoutStatus: 'online',
      withStatus: 'collaborating',
    },
    {
      name: 'Bruno',
      initials: 'B',
      avatarClass: 'bg-emerald-600',
      withoutStatus: 'online',
      withStatus: 'missing',
    },
    {
      name: 'Camila',
      initials: 'C',
      avatarClass: 'bg-amber-600',
      withoutStatus: 'online',
      withStatus: 'pto',
    },
    {
      name: 'Diego',
      initials: 'D',
      avatarClass: 'bg-rose-600',
      withoutStatus: 'online',
      withStatus: 'missing',
    },
    {
      name: 'Elena',
      initials: 'E',
      avatarClass: 'bg-indigo-600',
      withoutStatus: 'online',
      withStatus: 'missing',
    },
  ];

  /** Cleanup de timelines pendentes. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelToggle?.();
  }

  /**
   * Alterna o modo do mock (Sem Syntra / Com Syntra) com timeline quando permitido.
   * @param next - Modo desejado
   * @returns void
   */
  setMode(next: HeroMockMode): void {
    if (next === this.mode) {
      return;
    }

    const reduced = prefersReducedMotion();
    if (reduced) {
      this.mode = next;
      return;
    }

    const seq = ++this.toggleSeq;
    void this.runToggleWithMotion(next, seq);
  }

  /**
   * Headline contextual conforme o modo ativo.
   * @returns Texto da headline do painel
   */
  get headline(): string {
    return this.mode === 'with'
      ? 'Três pessoas sumiram da colaboração hoje.'
      : 'Todo mundo “online”. Ninguém sabe quem sumiu.';
  }

  /**
   * Linha de apoio no modo Sem Syntra (vazia no modo Com).
   * @returns Texto de apoio ou string vazia
   */
  get supportLine(): string {
    return this.mode === 'without'
      ? 'AFK misturado com trabalho. PTO fora da cabeça.'
      : '';
  }

  /**
   * Status efetivo do membro no modo atual.
   * @param member - Membro do mock
   * @returns Status a exibir no chip
   */
  statusOf(member: HeroMockMember): HeroMockStatus {
    return this.mode === 'with' ? member.withStatus : member.withoutStatus;
  }

  /**
   * Rótulo do chip de status.
   * @param status - Status visual
   * @returns Texto do chip
   */
  statusLabel(status: HeroMockStatus): string {
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

  /**
   * Classes Tailwind do chip conforme o status.
   * @param status - Status visual
   * @returns Classes CSS do chip
   */
  statusChipClass(status: HeroMockStatus): string {
    switch (status) {
      case 'collaborating':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
      case 'missing':
        return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
      case 'pto':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  private async ensureAnime(): Promise<AnimeMotionApi | null> {
    if (this.animeApi) {
      return this.animeApi;
    }
    if (!this.animeLoad) {
      this.animeLoad = loadAnimeMotionApi()
        .then((api) => {
          this.animeApi = api;
          return api;
        })
        .catch(() => null);
    }
    return this.animeLoad;
  }

  private async runToggleWithMotion(next: HeroMockMode, seq: number): Promise<void> {
    const anime = await this.ensureAnime();
    if (this.destroyed || seq !== this.toggleSeq) {
      return;
    }
    if (!anime) {
      this.mode = next;
      return;
    }

    this.cancelToggle?.();
    const root = this.host.nativeElement;
    const handle = playModeToggleTransition({
      root,
      reducedMotion: false,
      anime,
      pulseMissing: next === 'with',
      swapContent: () => {
        if (this.destroyed || seq !== this.toggleSeq) {
          return;
        }
        this.mode = next;
        this.cdr.detectChanges();
      },
    });
    this.cancelToggle = handle?.cancel ?? null;
  }
}
