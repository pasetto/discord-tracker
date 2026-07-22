import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ResetPasswordFormComponent } from './reset-password-form.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthApiService } from '../../../../core/auth/auth-api.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';

describe('ResetPasswordFormComponent', () => {
  let fixture: ComponentFixture<ResetPasswordFormComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
        AuthApiService,
        TenantContextService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (key: string) => (key === 'token' ? 'tok-1' : null) } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordFormComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('envia nova senha com token da query', () => {
    const component = fixture.componentInstance;
    expect(component.token).toBe('tok-1');
    component.newPassword = 'senha-nova-123';
    component.confirmPassword = 'senha-nova-123';
    component.onSubmit();

    const req = httpMock.expectOne('/api/v1/auth/reset-password');
    expect(req.request.body).toEqual({ token: 'tok-1', newPassword: 'senha-nova-123' });
    req.flush({ ok: true });
    fixture.detectChanges();

    expect(component.successMessage).toContain('Senha atualizada');
  });
});
