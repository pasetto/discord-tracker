import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { SessionRefreshButtonComponent } from './session-refresh-button.component';

describe('SessionRefreshButtonComponent', () => {
  let fixture: ComponentFixture<SessionRefreshButtonComponent>;
  let component: SessionRefreshButtonComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let tenantContextService: jasmine.SpyObj<TenantContextService>;
  let reloadSpy: jasmine.Spy;

  beforeEach(async () => {
    reloadSpy = jasmine.createSpy('reload');
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['refreshAccessToken']);
    tenantContextService = jasmine.createSpyObj<TenantContextService>('TenantContextService', ['refresh']);

    await TestBed.configureTestingModule({
      imports: [SessionRefreshButtonComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TenantContextService, useValue: tenantContextService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionRefreshButtonComponent);
    component = fixture.componentInstance;
    (component as unknown as { document: { location: { reload: jasmine.Spy } } }).document = {
      location: { reload: reloadSpy },
    };
  });

  it('renova sessão e recarrega a página ao clicar', () => {
    authService.refreshAccessToken.and.returnValue(of('new-token'));
    tenantContextService.refresh.and.returnValue(
      of({
        orgId: 'org-1',
        guildId: 'guild-1',
        guildName: 'Servidor',
        botConnected: true,
        activeConnection: null,
        loaded: true,
      }),
    );

    component.refreshSession();

    expect(authService.refreshAccessToken).toHaveBeenCalled();
    expect(tenantContextService.refresh).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('exibe erro quando a renovação falha', () => {
    authService.refreshAccessToken.and.returnValue(throwError(() => new Error('falha')));

    component.refreshSession();

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Não foi possível');
    expect(component.loading).toBeFalse();
  });
});
