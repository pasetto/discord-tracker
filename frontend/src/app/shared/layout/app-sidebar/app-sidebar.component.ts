import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SafeHtmlPipe } from '../../pipe/safe-html.pipe';
import { combineLatest, map, Subscription } from 'rxjs';
import { OnboardingProgressService } from '../../../core/onboarding/onboarding-progress.service';
import { AuthService } from '../../../core/auth/auth.service';

type NavItem = {
  name: string;
  icon: string;
  path?: string;
  new?: boolean;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

@Component({
  selector: 'app-sidebar',
  imports: [
    CommonModule,
    RouterModule,
    SafeHtmlPipe,
  ],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent implements OnInit, OnDestroy {

  /** Navegação principal do Syntra em português. */
  private readonly allNavItems: NavItem[] = [
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 3.25C4.25736 3.25 3.25 4.25736 3.25 5.5V8.99998C3.25 10.2426 4.25736 11.25 5.5 11.25H9C10.2426 11.25 11.25 10.2426 11.25 8.99998V5.5C11.25 4.25736 10.2426 3.25 9 3.25H5.5Z" fill="currentColor"></path></svg>`,
      name: 'Dashboard',
      path: '/app/dashboard',
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.5"/></svg>`,
      name: 'Relatórios',
      subItems: [
        { name: 'Quem sumiu', path: '/app/reports/inactivity' },
        { name: 'Metas semanais', path: '/app/reports/goals' },
      ],
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.5"/></svg>`,
      name: 'Onboarding',
      path: '/app/onboarding',
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="1.5"/></svg>`,
      name: 'Meu portal',
      path: '/app/me',
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 15a7.9 7.9 0 00.1-2 7.9 7.9 0 00-.1-2l2-1.5-2-3.5-2.3 1a8 8 0 00-1.7-1L15 2h-6l-.4 3.5a8 8 0 00-1.7 1l-2.3-1-2 3.5 2 1.5a7.9 7.9 0 00-.1 2c0 .7.03 1.35.1 2l-2 1.5 2 3.5 2.3-1a8 8 0 001.7 1L9 22h6l.4-3.5a8 8 0 001.7-1l2.3 1 2-3.5-2-1.5z" stroke="currentColor" stroke-width="1.2"/></svg>`,
      name: 'Configurações',
      subItems: [
        { name: 'Discord', path: '/app/settings/discord' },
        { name: 'Canais', path: '/app/settings/channels' },
        { name: 'Calendário', path: '/app/settings/calendar' },
        { name: 'Categorias', path: '/app/settings/categories' },
        { name: 'Metas', path: '/app/settings/goals' },
        { name: 'Inatividade', path: '/app/settings/inactivity' },
        { name: 'Ausências', path: '/app/settings/absences' },
        { name: 'Gamificação', path: '/app/settings/gamification' },
      ],
    },
  ];

  /** Itens visíveis após filtrar onboarding concluído. */
  navItems: NavItem[] = [...this.allNavItems];

  othersItems: NavItem[] = [];

  openSubmenu: string | null | number = null;
  subMenuHeights: { [key: string]: number } = {};
  @ViewChildren('subMenu') subMenuRefs!: QueryList<ElementRef>;

  readonly isExpanded$;
  readonly isMobileOpen$;
  readonly isHovered$;

  private subscription: Subscription = new Subscription();

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private readonly onboardingProgressService: OnboardingProgressService,
    private readonly authService: AuthService,
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    this.onboardingProgressService.load(this.authService.getOrganizationId()).subscribe();
    this.subscription.add(
      this.onboardingProgressService.progress$
        .pipe(map((progress) => this.onboardingProgressService.shouldShowOnboardingBanner(progress)))
        .subscribe((showOnboarding) => {
          this.navItems = showOnboarding
            ? [...this.allNavItems]
            : this.allNavItems.filter((item) => item.path !== '/app/onboarding');
          this.cdr.detectChanges();
        }),
    );

    // Subscribe to router events
    this.subscription.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.setActiveMenuFromRoute(this.router.url);
        }
      })
    );

    // Subscribe to combined observables to close submenus when all are false
    this.subscription.add(
      combineLatest([this.isExpanded$, this.isMobileOpen$, this.isHovered$]).subscribe(
        ([isExpanded, isMobileOpen, isHovered]) => {
          if (!isExpanded && !isMobileOpen && !isHovered) {
            // this.openSubmenu = null;
            // this.savedSubMenuHeights = { ...this.subMenuHeights };
            // this.subMenuHeights = {};
            this.cdr.detectChanges();
          } else {
            // Restore saved heights when reopening
            // this.subMenuHeights = { ...this.savedSubMenuHeights };
            // this.cdr.detectChanges();
          }
        }
      )
    );

    // Initial load
    this.setActiveMenuFromRoute(this.router.url);
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscription.unsubscribe();
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  toggleSubmenu(section: string, index: number) {
    const key = `${section}-${index}`;

    if (this.openSubmenu === key) {
      this.openSubmenu = null;
      this.subMenuHeights[key] = 0;
    } else {
      this.openSubmenu = key;

      setTimeout(() => {
        const el = document.getElementById(key);
        if (el) {
          this.subMenuHeights[key] = el.scrollHeight;
          this.cdr.detectChanges(); // Ensure UI updates
        }
      });
    }
  }

  onSidebarMouseEnter() {
    this.isExpanded$.subscribe(expanded => {
      if (!expanded) {
        this.sidebarService.setHovered(true);
      }
    }).unsubscribe();
  }

  private setActiveMenuFromRoute(currentUrl: string) {
    const menuGroups = [
      { items: this.navItems, prefix: 'main' },
      { items: this.othersItems, prefix: 'others' },
    ];

    menuGroups.forEach(group => {
      group.items.forEach((nav, i) => {
        if (nav.subItems) {
          nav.subItems.forEach(subItem => {
            if (currentUrl === subItem.path) {
              const key = `${group.prefix}-${i}`;
              this.openSubmenu = key;

              setTimeout(() => {
                const el = document.getElementById(key);
                if (el) {
                  this.subMenuHeights[key] = el.scrollHeight;
                  this.cdr.detectChanges(); // Ensure UI updates
                }
              });
            }
          });
        }
      });
    });
  }

  onSubmenuClick() {
    console.log('click submenu');
    this.isMobileOpen$.subscribe(isMobile => {
      if (isMobile) {
        this.sidebarService.setMobileOpen(false);
      }
    }).unsubscribe();
  }  

  
}
