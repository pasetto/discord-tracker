import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { OnboardingProgressService } from '../../../../core/onboarding/onboarding-progress.service';

/**
 * Dropdown do usuário autenticado com nome, email e logout real.
 */
@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports: [CommonModule, RouterLink],
})
export class UserDropdownComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly onboardingProgressService = inject(OnboardingProgressService);

  /** Controla exibição do link de configuração inicial no menu. */
  readonly showOnboardingLink$: Observable<boolean>;

  isOpen = false;

  constructor() {
    this.showOnboardingLink$ = this.onboardingProgressService.progress$.pipe(
      map((progress) => !(progress.completedAt || progress.completedSteps.includes(8))),
    );
  }

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
   * Carrega progresso do onboarding para decidir links do menu.
   */
  ngOnInit(): void {
    this.onboardingProgressService.load(this.authService.getOrganizationId()).subscribe();
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
