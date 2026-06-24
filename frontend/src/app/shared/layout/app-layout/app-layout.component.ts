import { Component, OnInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';
import { BackdropComponent } from '../backdrop/backdrop.component';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { OnboardingBannerComponent } from '../../components/onboarding-banner/onboarding-banner.component';
import { MobileBottomNavComponent } from '../mobile-bottom-nav/mobile-bottom-nav.component';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    AppSidebarComponent,
    BackdropComponent,
    OnboardingBannerComponent,
    MobileBottomNavComponent,
  ],
  templateUrl: './app-layout.component.html',
})

export class AppLayoutComponent implements OnInit {
  readonly isExpanded$;
  readonly isHovered$;
  readonly isMobileOpen$;

  constructor(
    public sidebarService: SidebarService,
    private readonly tenantContextService: TenantContextService,
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isHovered$ = this.sidebarService.isHovered$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  /**
   * Carrega contexto do tenant ao entrar no app autenticado.
   */
  ngOnInit(): void {
    this.tenantContextService.refresh().subscribe();
  }

  get containerClasses() {
    return [
      'flex-1',
      'transition-all',
      'duration-300',
      'ease-in-out',
      (this.isExpanded$ || this.isHovered$) ? 'xl:ml-[290px]' : 'xl:ml-[90px]',
      this.isMobileOpen$ ? 'ml-0' : ''
    ];
  }

}
