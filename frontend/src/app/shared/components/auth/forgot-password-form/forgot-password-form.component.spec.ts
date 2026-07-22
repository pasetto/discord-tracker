import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ForgotPasswordFormComponent } from './forgot-password-form.component';
import { AuthService } from '../../../../core/auth/auth.service';

describe('ForgotPasswordFormComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordFormComponent>;
  let component: ForgotPasswordFormComponent;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['forgotPassword']);
    authService.forgotPassword.and.returnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordFormComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('valida email antes de enviar', () => {
    component.email = 'invalido';
    component.onSubmit();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('email válido');
  });

  it('mostra mensagem genérica após sucesso', () => {
    component.email = 'owner@test.com';
    component.onSubmit();
    expect(authService.forgotPassword).toHaveBeenCalledWith('owner@test.com');
    expect(component.successMessage).toContain('Se o email existir');
  });
});
