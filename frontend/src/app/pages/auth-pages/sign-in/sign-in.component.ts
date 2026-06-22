import { Component, OnInit } from '@angular/core';
import { AuthPageLayoutComponent } from '../../../shared/layout/auth-page-layout/auth-page-layout.component';
import { SigninFormComponent } from '../../../shared/components/auth/signin-form/signin-form.component';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-sign-in',
  imports: [
    AuthPageLayoutComponent,
    SigninFormComponent,
  ],
  templateUrl: './sign-in.component.html',
  styles: ``,
})
/**
 * Página de entrada responsável por iniciar o fluxo OAuth no backend.
 */
export class SignInComponent implements OnInit {
  constructor(private readonly authService: AuthService) {}

  /**
   * Dispara o redirecionamento para autenticação via Discord.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    this.authService.redirectToDiscordOAuth();
  }
}
