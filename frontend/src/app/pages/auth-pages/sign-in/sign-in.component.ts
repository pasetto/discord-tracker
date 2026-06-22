import { Component } from '@angular/core';
import { AuthPageLayoutComponent } from '../../../shared/layout/auth-page-layout/auth-page-layout.component';
import { SigninFormComponent } from '../../../shared/components/auth/signin-form/signin-form.component';

/**
 * Página de login com email e senha.
 */
@Component({
  selector: 'app-sign-in',
  imports: [AuthPageLayoutComponent, SigninFormComponent],
  templateUrl: './sign-in.component.html',
})
export class SignInComponent {}
