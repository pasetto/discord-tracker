import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Item de navegação inferior para mobile. */
interface MobileNavItem {
  label: string;
  route: string;
  icon: string;
}

/**
 * Barra de navegação inferior visível apenas em telas pequenas.
 */
@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
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
              routerLinkActive="text-brand-600 dark:text-brand-400"
              class="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-medium text-gray-600 dark:text-gray-300"
            >
              <span class="text-base leading-none" aria-hidden="true">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class MobileBottomNavComponent {
  /** Links principais da aplicação em mobile. */
  readonly items: MobileNavItem[] = [
    { label: 'Início', route: '/app/dashboard', icon: '⌂' },
    { label: 'Relatórios', route: '/app/reports', icon: '📊' },
    { label: 'Onboarding', route: '/app/onboarding', icon: '✓' },
    { label: 'Metas', route: '/app/settings/goals', icon: '🎯' },
    { label: 'Meu portal', route: '/app/me', icon: '👤' },
  ];
}
