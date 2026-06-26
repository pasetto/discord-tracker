import { Component, OnInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeToggleButtonComponent } from '../../components/common/theme-toggle/theme-toggle-button.component';
import { SessionRefreshButtonComponent } from '../../components/common/session-refresh-button/session-refresh-button.component';
import { UserDropdownComponent } from '../../components/header/user-dropdown/user-dropdown.component';
import { PageContextService } from '../../../core/layout/page-context.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Cabeçalho principal com título contextual e chip do servidor monitorado.
 */
@Component({
  selector: 'app-header',
  imports: [
    CommonModule,
    RouterModule,
    ThemeToggleButtonComponent,
    SessionRefreshButtonComponent,
    UserDropdownComponent,
  ],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent implements OnInit {
  isApplicationMenuOpen = false;
  readonly isMobileOpen$;
  readonly pageContext$;

  constructor(
    public sidebarService: SidebarService,
    private readonly pageContextService: PageContextService,
    readonly tenantContext: TenantContextService,
  ) {
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.pageContext$ = this.pageContextService.context$;
  }

  ngOnInit(): void {
    this.pageContextService.refresh();
  }

  /** Alterna sidebar expandida (desktop) ou aberta (mobile). */
  handleToggle(): void {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  /** Alterna menu de ações no mobile. */
  toggleApplicationMenu(): void {
    this.isApplicationMenuOpen = !this.isApplicationMenuOpen;
  }
}
