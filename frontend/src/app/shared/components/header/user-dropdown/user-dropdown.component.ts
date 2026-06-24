import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Dropdown do usuário autenticado com nome, email e logout real.
 */
@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports: [CommonModule, RouterLink],
})
export class UserDropdownComponent {
  private readonly authService = inject(AuthService);

  isOpen = false;

  /**
   * Nome exibido no header.
   */
  get displayName(): string {
    return this.authService.getDisplayName();
  }

  /**
   * Email do usuário autenticado.
   */
  get email(): string {
    return this.authService.getUser()?.email ?? '';
  }

  /**
   * Nome da organização ativa.
   */
  get organizationName(): string {
    return this.authService.getOrganization()?.name ?? 'Minha organização';
  }

  /**
   * Iniciais para avatar quando não há imagem.
   */
  get initials(): string {
    const parts = this.displayName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return this.displayName.slice(0, 2).toUpperCase();
  }

  /**
   * Alterna visibilidade do menu.
   */
  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * Fecha menu dropdown.
   */
  closeDropdown(): void {
    this.isOpen = false;
  }

  /**
   * Encerra sessão e redireciona para login.
   */
  signOut(): void {
    this.closeDropdown();
    this.authService.logout();
  }
}
