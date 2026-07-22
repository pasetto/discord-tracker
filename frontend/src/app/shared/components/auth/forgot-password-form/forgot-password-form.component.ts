import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { LabelComponent } from '../../form/label/label.component';

/**
 * Formulário público para solicitar reset de senha via SMTP.
 */
@Component({
  selector: 'app-forgot-password-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LabelComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './forgot-password-form.component.html',
})
export class ForgotPasswordFormComponent {
  email = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly authService: AuthService) {}

  /**
   * Envia pedido de reset (resposta sempre genérica).
   */
  onSubmit(): void {
    if (this.loading) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email.trim() || !this.email.includes('@')) {
      this.errorMessage = 'Informe um email válido.';
      return;
    }

    this.loading = true;
    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.successMessage =
          'Se o email existir, enviaremos instruções para redefinir a senha.';
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível enviar o pedido. Tente novamente.';
        this.loading = false;
      },
    });
  }
}
