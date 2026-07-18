import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subscription } from 'rxjs';

/** Item de navegação inferior para mobile. */
interface MobileNavItem {
  label: string;
  route: string;
  matchPrefix?: string;
}

/**
 * Barra de navegação inferior alinhada à IA principal do produto.
 */
@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav
      class="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95"
      aria-label="Navegação principal mobile"
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
    { label: 'Config', route: '/app/settings', matchPrefix: '/app/settings' },
  ];

  currentUrl = '';

  private subscription = new Subscription();

  constructor(private readonly router: Router) {}

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
