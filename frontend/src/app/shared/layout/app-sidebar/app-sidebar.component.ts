import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SafeHtmlPipe } from '../../pipe/safe-html.pipe';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

type NavSubItem = {
  name: string;
  path?: string;
  sectionHeader?: boolean;
};

type NavItem = {
  name: string;
  icon: string;
  path?: string;
  matchPrefix?: string;
  subItems?: NavSubItem[];
};

/**
 * Sidebar principal com IA simplificada para gestores.
 */
@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, SafeHtmlPipe],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent implements OnInit, OnDestroy {
  /** Navegação principal reorganizada por jornada do gestor. */
  readonly navItems: NavItem[] = [
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 3.25C4.25736 3.25 3.25 4.25736 3.25 5.5V8.99998C3.25 10.2426 4.25736 11.25 5.5 11.25H9C10.2426 11.25 11.25 10.2426 11.25 8.99998V5.5C11.25 4.25736 10.2426 3.25 9 3.25H5.5Z" fill="currentColor"></path></svg>`,
      name: 'Início',
      path: '/app/dashboard',
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.5"/></svg>`,
      name: 'Time ao vivo',
      path: '/app/live',
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.5"/></svg>`,
      name: 'Relatórios',
      path: '/app/reports/inactivity',
      matchPrefix: '/app/reports',
    },
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 15a7.9 7.9 0 00.1-2 7.9 7.9 0 00-.1-2l2-1.5-2-3.5-2.3 1a8 8 0 00-1.7-1L15 2h-6l-.4 3.5a8 8 0 00-1.7 1l-2.3-1-2 3.5 2 1.5a7.9 7.9 0 00-.1 2c0 .7.03 1.35.1 2l-2 1.5 2 3.5 2.3-1a8 8 0 001.7 1L9 22h6l.4-3.5a8 8 0 001.7-1l2.3 1 2-3.5-2-1.5z" stroke="currentColor" stroke-width="1.2"/></svg>`,
      name: 'Configurações',
      subItems: [
        { name: 'Integração', sectionHeader: true },
        { name: 'Discord', path: '/app/settings/discord' },
        { name: 'Canais', path: '/app/settings/channels' },
        { name: 'Regras', sectionHeader: true },
        { name: 'Calendário', path: '/app/settings/calendar' },
        { name: 'Quem sumiu (limiares)', path: '/app/settings/inactivity' },
        { name: 'Cadastrar PTO', path: '/app/settings/absences' },
        { name: 'Time', sectionHeader: true },
        { name: 'Convites e membros', path: '/app/settings/team' },
        { name: 'Categorias', path: '/app/settings/categories' },
        { name: 'Metas', path: '/app/settings/goals' },
        { name: 'Gamificação', path: '/app/settings/gamification' },
      ],
    },
  ];

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
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    this.subscription.add(
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
        this.setActiveMenuFromRoute(this.router.url);
      }),
    );

    this.setActiveMenuFromRoute(this.router.url);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  /**
   * Verifica se rota está ativa, incluindo prefixos configurados.
   * @param item Item de navegação
   * @returns true quando item deve aparecer ativo
   */
  isActive(item: NavItem): boolean {
    if (item.matchPrefix) {
      return this.router.url.startsWith(item.matchPrefix);
    }
    if (item.path) {
      return this.router.url === item.path || this.router.url.startsWith(`${item.path}/`);
    }
    return false;
  }

  /**
   * Verifica se subitem de configurações está ativo.
   * @param path Caminho do subitem
   * @returns true quando URL coincide
   */
  isSubItemActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(`${path}/`);
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
          this.cdr.detectChanges();
        }
      });
    }
  }

  onSidebarMouseEnter() {
    this.isExpanded$.subscribe((expanded) => {
      if (!expanded) {
        this.sidebarService.setHovered(true);
      }
    }).unsubscribe();
  }

  private setActiveMenuFromRoute(currentUrl: string) {
    this.navItems.forEach((nav, i) => {
      if (!nav.subItems) {
        return;
      }

      const hasActiveChild = nav.subItems.some(
        (subItem) => subItem.path && this.isSubItemActive(subItem.path),
      );

      if (hasActiveChild || currentUrl.startsWith('/app/settings')) {
        const key = `main-${i}`;
        this.openSubmenu = key;

        setTimeout(() => {
          const el = document.getElementById(key);
          if (el) {
            this.subMenuHeights[key] = el.scrollHeight;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  /**
   * Fecha o drawer mobile após navegação (links e logo).
   * @returns {void}
   */
  closeMobileSidebar(): void {
    this.sidebarService.setMobileOpen(false);
  }

  /**
   * @deprecated Use {@link closeMobileSidebar} — mantido para compatibilidade.
   * @returns {void}
   */
  onSubmenuClick(): void {
    this.closeMobileSidebar();
  }
}
