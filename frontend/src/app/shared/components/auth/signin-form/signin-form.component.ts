import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Formulário de login com email e senha da plataforma Syntra.
 */
@Component({
  selector: 'app-signin-form',
  imports: [
    CommonModule,
    LabelComponent,
    CheckboxComponent,
    ButtonComponent,
    InputFieldComponent,
    RouterModule,
    FormsModule,
  ],
  templateUrl: './signin-form.component.html',
  styles: ``,
})
export class SigninFormComponent implements OnInit {
  showPassword = false;
  isChecked = true;
  loading = false;
  errorMessage = '';

  email = '';
  password = '';
  /** Código de convite para redirecionar após login. */
  joinCode = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  /**
   * Lê código de convite da query string, se existir.
   */
  ngOnInit(): void {
    const joinCodeFromQuery = this.route.snapshot.queryParamMap.get('joinCode');
    if (joinCodeFromQuery) {
      this.joinCode = joinCodeFromQuery.toUpperCase();
    }
  }

  /**
   * Alterna visibilidade do campo de senha.
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Autentica usuário e redireciona para o painel.
   */
  onSignIn(): void {
    if (this.loading) {
      return;
    }

    this.errorMessage = '';

    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'Informe email e senha.';
      return;
    }

    this.loading = true;

    this.authService
      .login({
        email: this.email.trim(),
        password: this.password,
        rememberMe: this.isChecked,
      })
      .subscribe({
      next: () => {
        this.loading = false;
        if (this.joinCode) {
          void this.router.navigate(['/app/join'], { queryParams: { code: this.joinCode } });
          return;
        }

        void this.router.navigate(['/app/dashboard']);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.error ?? 'Não foi possível entrar. Verifique suas credenciais.';
      },
    });
  }
}
