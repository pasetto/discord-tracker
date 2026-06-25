import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Formulário de cadastro com email, senha e organização.
 */
@Component({
  selector: 'app-signup-form',
  imports: [
    CommonModule,
    LabelComponent,
    CheckboxComponent,
    InputFieldComponent,
    RouterModule,
    FormsModule,
  ],
  templateUrl: './signup-form.component.html',
  styles: ``,
})
export class SignupFormComponent {
  /** Código de convite de 8 caracteres — cadastro entra na org existente. */
  @Input() inviteCode = '';
  /** Nome da organização exibido no fluxo de convite. */
  @Input() inviteOrganizationName = '';

  showPassword = false;
  isChecked = false;
  loading = false;
  errorMessage = '';

  displayName = '';
  organizationName = '';
  email = '';
  password = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  /**
   * Indica cadastro via convite (sem criação de organização).
   * @returns `true` quando há código de convite válido
   */
  get isInviteSignup(): boolean {
    return this.inviteCode.trim().length === 8;
  }

  /**
   * Alterna visibilidade do campo de senha.
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Cadastra nova conta e redireciona para o painel.
   */
  onSignUp(): void {
    if (this.loading) {
      return;
    }

    this.errorMessage = '';

    if (!this.displayName.trim() || !this.email.trim() || !this.password) {
      this.errorMessage = 'Preencha todos os campos obrigatórios.';
      return;
    }

    if (!this.isInviteSignup && !this.organizationName.trim()) {
      this.errorMessage = 'Informe o nome da organização.';
      return;
    }

    if (!this.isChecked) {
      this.errorMessage = 'Aceite os termos para criar a conta.';
      return;
    }

    this.loading = true;

    this.authService
      .register({
        email: this.email.trim(),
        password: this.password,
        displayName: this.displayName.trim(),
        ...(this.isInviteSignup
          ? { inviteCode: this.inviteCode.trim().toUpperCase() }
          : { organizationName: this.organizationName.trim() }),
      })
      .subscribe({
        next: () => {
          this.loading = false;
          if (this.isInviteSignup) {
            void this.router.navigate(['/app/join'], {
              queryParams: { code: this.inviteCode.trim().toUpperCase(), registered: '1' },
            });
            return;
          }

          void this.router.navigate(['/app/onboarding']);
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error?.error?.error ?? 'Não foi possível criar a conta. Tente novamente.';
        },
      });
  }
}
