import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppHeaderComponent } from './app-header.component';
import { SidebarService } from '../../services/sidebar.service';
import { PageContextService } from '../../../core/layout/page-context.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

describe('AppHeaderComponent', () => {
  let fixture: ComponentFixture<AppHeaderComponent>;
  let component: AppHeaderComponent;
  let sidebarService: SidebarService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent],
      providers: [
        provideRouter([]),
        SidebarService,
        {
          provide: PageContextService,
          useValue: {
            context$: of({ title: 'Início' }),
            refresh: jasmine.createSpy('refresh'),
          },
        },
        {
          provide: TenantContextService,
          useValue: { guildName: 'Servidor Teste' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppHeaderComponent);
    component = fixture.componentInstance;
    sidebarService = TestBed.inject(SidebarService);
    fixture.detectChanges();
  });

  it('deve criar o header', () => {
    expect(component).toBeTruthy();
  });

  it('handleToggle abaixo de xl deve abrir o drawer mobile', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(390);
    const toggleSpy = spyOn(sidebarService, 'toggleMobileOpen').and.callThrough();

    component.handleToggle();

    expect(toggleSpy).toHaveBeenCalled();
    expect(sidebarService.isMobileOpen()).toBeTrue();
  });

  it('handleToggle em desktop xl deve expandir sidebar, não o drawer', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1280);
    const mobileSpy = spyOn(sidebarService, 'toggleMobileOpen').and.callThrough();
    const expandedSpy = spyOn(sidebarService, 'toggleExpanded').and.callThrough();

    component.handleToggle();

    expect(mobileSpy).not.toHaveBeenCalled();
    expect(expandedSpy).toHaveBeenCalled();
  });

  it('deve exibir logo de tema claro e escuro no markup mobile', () => {
    const imgs = fixture.nativeElement.querySelectorAll('a[aria-label="Syntra"] img');
    const srcs = Array.from(imgs as NodeListOf<HTMLImageElement>).map((img) => img.getAttribute('src'));
    expect(srcs).toContain('/images/logo/logo.svg');
    expect(srcs).toContain('/images/logo/logo-dark.svg');
  });
});
