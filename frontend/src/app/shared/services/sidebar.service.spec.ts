import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SIDEBAR_DESKTOP_BREAKPOINT_PX, SidebarService } from './sidebar.service';

describe('SidebarService', () => {
  let service: SidebarService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SidebarService],
    });
    service = TestBed.inject(SidebarService);
  });

  it('deve iniciar com drawer mobile fechado', async () => {
    expect(service.isMobileOpen()).toBeFalse();
    expect(await firstValueFrom(service.isMobileOpen$)).toBeFalse();
  });

  it('toggleMobileOpen deve abrir e fechar o drawer', async () => {
    service.toggleMobileOpen();
    expect(service.isMobileOpen()).toBeTrue();
    expect(await firstValueFrom(service.isMobileOpen$)).toBeTrue();

    service.toggleMobileOpen();
    expect(service.isMobileOpen()).toBeFalse();
  });

  it('setMobileOpen(false) deve fechar após abrir', () => {
    service.setMobileOpen(true);
    service.setMobileOpen(false);
    expect(service.isMobileOpen()).toBeFalse();
  });

  it('deve expor breakpoint desktop alinhado ao Tailwind xl', () => {
    expect(SIDEBAR_DESKTOP_BREAKPOINT_PX).toBe(1280);
  });
});
