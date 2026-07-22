import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { LabelComponent } from '../../form/label/label.component';

/**
 * Formulário para concluir reset de senha com token da URL.
 */
@Component({
  selector: 'app-reset-password-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LabelComponent, InputFieldComponent, ButtonComponent],
  templateUrl: './reset-password-form.component.html',
})
export class ResetPasswordFormComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
  ) {}

  /**
   * Lê token da query string (`?token=`).
   */
  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMessage = 'Link de redefinição inválido ou incompleto.';
    }
  }

  /**
   * Envia nova senha com o token.
   */
  onSubmit(): void {
    if (this.loading) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (!this.token.trim()) {
      this.errorMessage = 'Link de redefinição inválido ou incompleto.';
      return;
    }

    if (!this.newPassword || this.newPassword.length < 8) {
      this.errorMessage = 'A senha deve ter pelo menos 8 caracteres.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'As senhas não conferem.';
      return;
    }

    this.loading = true;
    this.authService
      .resetPassword({ token: this.token.trim(), newPassword: this.newPassword })
      .subscribe({
        next: () => {
          this.successMessage = 'Senha atualizada. Você já pode entrar.';
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage =
            err?.error?.error ?? 'Não foi possível redefinir a senha. Solicite um novo link.';
          this.loading = false;
        },
      });
  }
}
