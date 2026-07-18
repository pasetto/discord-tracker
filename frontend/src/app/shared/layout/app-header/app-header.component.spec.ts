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

  it('deve manter título entre logo e menu de ações (hierarquia mobile)', () => {
    const hamburger = fixture.nativeElement.querySelector('button[aria-label="Toggle Sidebar"]') as HTMLElement;
    const logo = fixture.nativeElement.querySelector('a[aria-label="Syntra"]') as HTMLElement;
    const title = fixture.nativeElement.querySelector('header .min-w-0.flex-1') as HTMLElement;
    const actions = fixture.nativeElement.querySelector('button[aria-label="Abrir menu de ações"]') as HTMLElement;
    const row = hamburger.parentElement as HTMLElement;

    expect(row).toBeTruthy();
    expect(logo.parentElement).toBe(row);
    expect(title.parentElement).toBe(row);
    expect(actions.parentElement).toBe(row);

    const children = Array.from(row.children);
    expect(children.indexOf(hamburger)).toBeLessThan(children.indexOf(logo));
    expect(children.indexOf(logo)).toBeLessThan(children.indexOf(title));
    expect(children.indexOf(title)).toBeLessThan(children.indexOf(actions));
  });

  it('deve usar alvos de toque ≥44px nos controles mobile do header', () => {
    const hamburger = fixture.nativeElement.querySelector('button[aria-label="Toggle Sidebar"]') as HTMLElement;
    const actions = fixture.nativeElement.querySelector('button[aria-label="Abrir menu de ações"]') as HTMLElement;
    expect(hamburger.className).toContain('min-h-11');
    expect(hamburger.className).toContain('min-w-11');
    expect(actions.className).toContain('min-h-11');
    expect(actions.className).toContain('min-w-11');
  });
});
