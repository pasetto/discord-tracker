import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, interval, switchMap, takeUntil } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { SignupFormComponent } from '../../shared/components/auth/signup-form/signup-form.component';

/** Intervalo (ms) entre verificações de aprovação do convite. */
const APPROVAL_POLL_INTERVAL_MS = 15000;

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
export class JoinOrganizationComponent implements OnInit, OnDestroy {
  inviteCode = '';
  preview: InvitePreviewDto | null = null;
  loading = false;
  submitting = false;
  errorMessage = '';
  successMessage = '';

  private readonly destroy$ = new Subject<void>();
  private approvalPollingStarted = false;

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
   * Reage aos parâmetros de query (código e flag de cadastro recém-criado).
   * Usa o observable (não o snapshot) porque o cadastro via convite reaproveita
   * esta mesma rota, sem recriar o componente.
   */
  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const codeFromQuery = params.get('code');
      if (codeFromQuery) {
        const normalizedCode = codeFromQuery.toUpperCase();
        if (normalizedCode !== this.inviteCode) {
          this.inviteCode = normalizedCode;
          this.previewInvite();
        }
      }

      if (params.get('registered') === '1') {
        this.successMessage = 'Conta criada. Aguarde aprovação de um membro da organização.';
      }

      this.maybeStartApprovalPolling();
    });
  }

  /**
   * Encerra assinaturas ativas ao destruir o componente.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicia o polling de aprovação quando o usuário está autenticado e ainda não
   * possui organização ativa. Ao ser aprovado, renova a sessão (novo token) e
   * leva ao dashboard sem exigir logout/login.
   */
  private maybeStartApprovalPolling(): void {
    if (this.approvalPollingStarted || !this.isAuthenticated) {
      return;
    }

    if (this.authService.getActiveOrganizations().length > 0) {
      return;
    }

    this.approvalPollingStarted = true;
    interval(APPROVAL_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.authService.refreshSession()),
        takeUntil(this.destroy$),
      )
      .subscribe((hasActiveOrganization) => {
        if (hasActiveOrganization) {
          void this.router.navigate(['/app/dashboard']);
        }
      });
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
