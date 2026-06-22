import { Component } from '@angular/core';
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

    if (!this.displayName.trim() || !this.organizationName.trim() || !this.email.trim() || !this.password) {
      this.errorMessage = 'Preencha todos os campos obrigatórios.';
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
        organizationName: this.organizationName.trim(),
      })
      .subscribe({
        next: () => {
          this.loading = false;
          void this.router.navigate(['/app/onboarding']);
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error?.error?.error ?? 'Não foi possível criar a conta. Tente novamente.';
        },
      });
  }
}
