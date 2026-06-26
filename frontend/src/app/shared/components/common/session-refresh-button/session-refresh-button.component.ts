import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';

/**
 * Botão para renovar manualmente a sessão (refresh token + contexto do tenant)
 * e recarregar a página — útil após aprovação de convite sem logout/login.
 */
@Component({
  selector: 'app-session-refresh-button',
  imports: [CommonModule],
  templateUrl: './session-refresh-button.component.html',
})
export class SessionRefreshButtonComponent {
  private readonly authService = inject(AuthService);
  private readonly tenantContextService = inject(TenantContextService);
  private readonly document = inject(DOCUMENT);

  loading = false;
  errorMessage = '';

  /**
   * Renova o access token, atualiza o contexto do tenant e recarrega a página.
   */
  refreshSession(): void {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService
      .refreshAccessToken()
      .pipe(
        switchMap(() => this.tenantContextService.refresh()),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.document.location.reload();
        },
        error: () => {
          this.errorMessage = 'Não foi possível atualizar a sessão.';
        },
      });
  }
}
