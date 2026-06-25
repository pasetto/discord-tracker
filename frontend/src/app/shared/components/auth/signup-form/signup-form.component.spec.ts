import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SignupFormComponent } from './signup-form.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { of } from 'rxjs';

describe('SignupFormComponent', () => {
  let fixture: ComponentFixture<SignupFormComponent>;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['register']);
    authService.register.and.returnValue(
      of({
        accessToken: 'token',
        user: {
          id: 'user-1',
          email: 'convidado@test.com',
          displayName: 'Convidado',
          memberships: [],
        },
        organization: null,
        organizations: [],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [SignupFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'app/join', redirectTo: '' }, { path: 'app/onboarding', redirectTo: '' }]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignupFormComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentInstance.inviteCode = 'VB87T6AZ';
    fixture.componentInstance.inviteOrganizationName = 'Econdos';
    fixture.componentInstance.displayName = 'Convidado';
    fixture.componentInstance.email = 'convidado@test.com';
    fixture.componentInstance.password = 'senha-segura';
    fixture.componentInstance.isChecked = true;
    fixture.detectChanges();
    httpMock.verify();
  });

  it('cadastra via convite sem exigir nome de organização', () => {
    fixture.componentInstance.onSignUp();

    expect(authService.register).toHaveBeenCalledWith({
      email: 'convidado@test.com',
      password: 'senha-segura',
      displayName: 'Convidado',
      inviteCode: 'VB87T6AZ',
    });
  });
});
