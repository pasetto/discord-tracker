import { AsyncPipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Observable, Subscription, filter } from 'rxjs';
import { SidebarService } from '../../services/sidebar.service';

/** Item de navegação inferior para mobile. */
interface MobileNavItem {
  label: string;
  route: string;
  matchPrefix?: string;
}

/**
 * Barra de navegação inferior alinhada à IA principal do produto.
 * Esconde-se abaixo de xl e enquanto o drawer lateral estiver aberto (Hick / Cognitive Load).
 */
@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, AsyncPipe, NgClass],
  template: `
    <nav
      class="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur xl:hidden dark:border-gray-800 dark:bg-gray-900/95"
      aria-label="Navegação principal mobile"
      [ngClass]="{ hidden: (isMobileOpen$ | async) }"
    >
      <ul class="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        @for (item of items; track item.route) {
          <li class="flex-1">
            <a
              [routerLink]="item.route"
              class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium"
              [class.text-brand-600]="isActive(item)"
              [class.dark:text-brand-400]="isActive(item)"
              [class.text-gray-600]="!isActive(item)"
              [class.dark:text-gray-300]="!isActive(item)"
            >
              <span class="text-[11px] font-semibold leading-none">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class MobileBottomNavComponent implements OnInit, OnDestroy {
  /** Links principais alinhados ao sidebar desktop. */
  readonly items: MobileNavItem[] = [
    { label: 'Início', route: '/app/dashboard' },
    { label: 'Ao vivo', route: '/app/live' },
    { label: 'Relatórios', route: '/app/reports/inactivity', matchPrefix: '/app/reports' },
    { label: 'Config', route: '/app/settings/discord', matchPrefix: '/app/settings' },
  ];

  currentUrl = '';
  readonly isMobileOpen$: Observable<boolean>;

  private subscription = new Subscription();

  constructor(
    private readonly router: Router,
    sidebarService: SidebarService,
  ) {
    this.isMobileOpen$ = sidebarService.isMobileOpen$;
  }

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    this.subscription.add(
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
        this.currentUrl = this.router.url;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Verifica rota ativa incluindo prefixos de hub.
   * @param item Item de navegação mobile
   * @returns true quando URL corresponde ao item
   */
  isActive(item: MobileNavItem): boolean {
    if (item.matchPrefix) {
      return this.currentUrl.startsWith(item.matchPrefix);
    }
    return this.currentUrl === item.route;
  }
}
