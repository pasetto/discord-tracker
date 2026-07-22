import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AdminApiService,
  type AdminPasswordResetResult,
  type AdminPlatformUser,
} from '../../../core/admin/admin-api.service';

/**
 * Listagem e gestão de usuários da plataforma (super admin).
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  loading = false;
  savingId: string | null = null;
  resetBusyId: string | null = null;
  errorMessage = '';
  successMessage = '';
  users: AdminPlatformUser[] = [];
  total = 0;
  /** Último reset gerado por usuário (URL copiável). */
  latestResets: Record<string, AdminPasswordResetResult> = {};

  constructor(private readonly adminApi: AdminApiService) {}

  /**
   * Carrega usuários ao iniciar.
   */
  ngOnInit(): void {
    this.reload();
  }

  /**
   * Alterna flag `isSuperAdmin` de um usuário.
   * @param user Usuário alvo
   */
  toggleSuperAdmin(user: AdminPlatformUser): void {
    this.savingId = user.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.adminApi.updateUser(user.id, { isSuperAdmin: !user.isSuperAdmin }).subscribe({
      next: (updated) => {
        this.users = this.users.map((item) => (item.id === updated.id ? updated : item));
        this.savingId = null;
      },
      error: () => {
        this.errorMessage = 'Não foi possível atualizar o usuário.';
        this.savingId = null;
      },
    });
  }

  /**
   * Gera reset de senha e exibe URL recuperável.
   * @param user Usuário alvo
   */
  resetPassword(user: AdminPlatformUser): void {
    this.runPasswordReset(user, 'create');
  }

  /**
   * Regenera/reenvia email de reset e atualiza URL copiável.
   * @param user Usuário alvo
   */
  resendPasswordReset(user: AdminPlatformUser): void {
    this.runPasswordReset(user, 'resend');
  }

  /**
   * Copia URL de reset para a área de transferência.
   * @param userId ID do usuário
   */
  async copyResetUrl(userId: string): Promise<void> {
    const reset = this.latestResets[userId];
    if (!reset?.resetUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reset.resetUrl);
      this.successMessage = 'Link de redefinição copiado.';
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'Não foi possível copiar o link. Selecione e copie manualmente.';
    }
  }

  private runPasswordReset(user: AdminPlatformUser, mode: 'create' | 'resend'): void {
    this.resetBusyId = user.id;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ =
      mode === 'resend'
        ? this.adminApi.resendUserPasswordReset(user.id)
        : this.adminApi.createUserPasswordReset(user.id);

    request$.subscribe({
      next: (result) => {
        this.latestResets = { ...this.latestResets, [user.id]: result };
        this.successMessage = result.emailed
          ? 'Reset gerado e email enviado. Link disponível para copiar.'
          : 'Reset gerado (SMTP ausente — use o link abaixo).';
        this.resetBusyId = null;
      },
      error: () => {
        this.errorMessage = 'Não foi possível gerar o reset de senha.';
        this.resetBusyId = null;
      },
    });
  }

  private reload(): void {
    this.loading = true;
    this.adminApi.listUsers(100, 0).subscribe({
      next: ({ users, total }) => {
        this.users = users;
        this.total = total;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Falha ao carregar usuários.';
        this.loading = false;
      },
    });
  }
}
