import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { SignupFormComponent } from '../../shared/components/auth/signup-form/signup-form.component';

/** Preview público de organização pelo código de convite. */
interface InvitePreviewDto {
  organizationId: string;
  organizationName: string;
  inviteCode: string;
}

/**
 * Tela para entrar em organização via código de convite de 8 caracteres.
 * Acessível sem autenticação para permitir cadastro direto na organização convidada.
 */
@Component({
  selector: 'app-join-organization',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthPageLayoutComponent, SignupFormComponent],
  templateUrl: './join-organization.component.html',
})
export class JoinOrganizationComponent implements OnInit {
  inviteCode = '';
  preview: InvitePreviewDto | null = null;
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  /**
   * Indica se o usuário já possui sessão válida.
   * @returns `true` quando autenticado
   */
  get isAuthenticated(): boolean {
    return this.authService.isTokenValid();
  }

  /**
   * Preenche código vindo da query string, se existir.
   */
  ngOnInit(): void {
    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    if (codeFromQuery) {
      this.inviteCode = codeFromQuery.toUpperCase();
      this.previewInvite();
    }

    if (this.route.snapshot.queryParamMap.get('registered') === '1') {
      this.successMessage = 'Conta criada. Aguarde aprovação de um membro da organização.';
    }
  }

  /**
   * Valida código e exibe nome da organização.
   */
  previewInvite(): void {
    const normalizedCode = this.inviteCode.trim().toUpperCase();
    if (normalizedCode.length !== 8) {
      this.errorMessage = 'Informe um código válido com 8 caracteres.';
      this.preview = null;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    if (!this.successMessage.includes('Conta criada')) {
      this.successMessage = '';
    }

    this.httpClient.get<InvitePreviewDto>(`/api/v1/public/invite-codes/${normalizedCode}`).subscribe({
      next: (response) => {
        this.preview = response;
        this.inviteCode = response.inviteCode;
        this.loading = false;

        if (this.isAuthenticated) {
          const pendingMembership = this.authService
            .getOrganizations()
            .find((organization) => organization.id === response.organizationId && organization.status === 'pending');
          if (pendingMembership) {
            this.successMessage = 'Solicitação enviada. Aguarde aprovação de um membro da organização.';
          }
        }
      },
      error: () => {
        this.loading = false;
        this.preview = null;
        this.errorMessage = 'Código inválido. Verifique com o administrador da organização.';
      },
    });
  }

  /**
   * Envia solicitação de entrada na organização (usuário autenticado).
   */
  submitJoinRequest(): void {
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.joinOrganization(this.inviteCode).subscribe({
      next: (session) => {
        this.submitting = false;
        this.successMessage = 'Solicitação enviada. Aguarde aprovação de um membro da organização.';

        const hasActiveOrganization = (session.organizations ?? []).some(
          (organization) => organization.status === 'active',
        );
        if (hasActiveOrganization) {
          void this.router.navigate(['/app/dashboard']);
        }
      },
      error: (error: { error?: { error?: string } }) => {
        this.submitting = false;
        this.errorMessage = error.error?.error ?? 'Não foi possível solicitar acesso.';
      },
    });
  }
}
