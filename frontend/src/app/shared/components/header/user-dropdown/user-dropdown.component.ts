import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import type { AuthOrganizationOption } from '../../../../core/auth/auth-session.model';
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
  private readonly router = inject(Router);

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
   * Organizações ativas disponíveis para troca.
   */
  get organizations(): AuthOrganizationOption[] {
    return this.authService.getActiveOrganizations();
  }

  /**
   * ID da organização ativa no momento.
   */
  get activeOrganizationId(): string {
    return this.authService.getOrganizationId();
  }

  /**
   * Nome da organização ativa.
   */
  get organizationName(): string {
    return this.authService.getOrganization()?.name ?? 'Minha organização';
  }

  /**
   * Indica se o usuário logado é super admin da plataforma.
   */
  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
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
    this.authService.syncSession().subscribe(() => {
      this.onboardingProgressService.load(this.authService.getOrganizationId()).subscribe();
    });
  }

  /**
   * Troca organização ativa e recarrega o app no dashboard.
   * @param organizationId ID da organização selecionada
   */
  switchOrganization(organizationId: string): void {
    if (organizationId === this.activeOrganizationId) {
      this.closeDropdown();
      return;
    }

    this.authService.switchOrganization(organizationId).subscribe({
      next: () => {
        this.closeDropdown();
        void this.router.navigateByUrl('/app/dashboard');
      },
    });
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
