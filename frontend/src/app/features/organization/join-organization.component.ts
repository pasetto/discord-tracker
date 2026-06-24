import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Preview público de organização pelo código de convite. */
interface InvitePreviewDto {
  organizationId: string;
  organizationName: string;
  inviteCode: string;
}

/**
 * Tela para entrar em organização via código de convite de 8 caracteres.
 */
@Component({
  selector: 'app-join-organization',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
   * Preenche código vindo da query string, se existir.
   */
  ngOnInit(): void {
    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    if (codeFromQuery) {
      this.inviteCode = codeFromQuery.toUpperCase();
      this.previewInvite();
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
    this.successMessage = '';

    this.httpClient.get<InvitePreviewDto>(`/api/v1/public/invite-codes/${normalizedCode}`).subscribe({
      next: (response) => {
        this.preview = response;
        this.inviteCode = response.inviteCode;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.preview = null;
        this.errorMessage = 'Código inválido. Verifique com o administrador da organização.';
      },
    });
  }

  /**
   * Envia solicitação de entrada na organização.
   */
  submitJoinRequest(): void {
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.joinOrganization(this.inviteCode).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Solicitação enviada. Aguarde aprovação de um membro da organização.';
        void this.router.navigate(['/app/dashboard']);
      },
      error: (error: { error?: { error?: string } }) => {
        this.submitting = false;
        this.errorMessage = error.error?.error ?? 'Não foi possível solicitar acesso.';
      },
    });
  }
}
