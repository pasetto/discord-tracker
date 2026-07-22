import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppSidebarComponent } from './app-sidebar.component';
import { SidebarService } from '../../services/sidebar.service';

describe('AppSidebarComponent', () => {
  let fixture: ComponentFixture<AppSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([]), SidebarService],
    }).compileComponents();

    fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
  });

  it('deve criar a sidebar reorganizada', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve expor quatro itens principais de navegação', () => {
    expect(fixture.componentInstance.navItems.length).toBe(4);
    expect(fixture.componentInstance.navItems[0].name).toBe('Início');
    expect(fixture.componentInstance.navItems[1].name).toBe('Time ao vivo');
    expect(fixture.componentInstance.navItems[2].name).toBe('Relatórios');
    expect(fixture.componentInstance.navItems[3].name).toBe('Configurações');
  });

  it('deve marcar relatórios ativo por prefixo de rota', () => {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/reports/goals');

    const reportsItem = fixture.componentInstance.navItems[2];
    expect(fixture.componentInstance.isActive(reportsItem)).toBeTrue();
  });

  it('deve agrupar configurações com cabeçalhos de seção', () => {
    const settings = fixture.componentInstance.navItems[3];
    expect(settings.subItems?.some((item) => item.sectionHeader && item.name === 'Integração')).toBeTrue();
    expect(settings.subItems?.some((item) => item.path === '/app/settings/absences' && item.name === 'Cadastrar PTO')).toBeTrue();
  });

  it('closeMobileSidebar deve fechar o drawer via SidebarService', () => {
    const sidebarService = TestBed.inject(SidebarService);
    sidebarService.setMobileOpen(true);

    fixture.componentInstance.closeMobileSidebar();

    expect(sidebarService.isMobileOpen()).toBeFalse();
  });

  it('deve usar logo.svg no tema claro e logo-dark.svg no escuro', () => {
    const sidebarService = TestBed.inject(SidebarService);
    sidebarService.setMobileOpen(true);
    fixture.detectChanges();

    const imgs = fixture.nativeElement.querySelectorAll('a[routerlink="/app/dashboard"] img, a[href] img');
    const srcs = Array.from(imgs as NodeListOf<HTMLImageElement>).map((img) => img.getAttribute('src'));
    expect(srcs.some((src) => src === '/images/logo/logo.svg')).toBeTrue();
    expect(srcs.some((src) => src === '/images/logo/logo-dark.svg')).toBeTrue();
  });
});
