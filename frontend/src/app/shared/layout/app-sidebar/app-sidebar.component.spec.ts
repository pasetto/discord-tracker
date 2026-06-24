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
});
