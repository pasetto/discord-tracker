import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AdminApiService, type AdminPlatformUser } from '../../../core/admin/admin-api.service';

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
  errorMessage = '';
  users: AdminPlatformUser[] = [];
  total = 0;

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
