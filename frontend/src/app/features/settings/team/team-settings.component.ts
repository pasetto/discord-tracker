import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/** Membro ou solicitação pendente da organização. */
interface OrganizationMemberDto {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: 'active' | 'pending';
  invitedAt: string;
  acceptedAt?: string;
}

/**
 * Configurações de time: código de convite, aprovações e membros.
 */
@Component({
  selector: 'app-team-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-settings.component.html',
})
export class TeamSettingsComponent implements OnInit {
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  inviteCode = '';
  members: OrganizationMemberDto[] = [];

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Link amigável para compartilhar o código. */
  get inviteLink(): string {
    if (!this.inviteCode) {
      return '';
    }
    return `${window.location.origin}/app/join?code=${this.inviteCode}`;
  }

  /** Solicitações aguardando aprovação. */
  get pendingMembers(): OrganizationMemberDto[] {
    return this.members.filter((member) => member.status === 'pending');
  }

  /** Membros ativos da organização. */
  get activeMembers(): OrganizationMemberDto[] {
    return this.members.filter((member) => member.status === 'active');
  }

  /**
   * Carrega código de convite e membros ao abrir a tela.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.tenantContext.orgId) {
        this.loadTeamData();
      }
    });
  }

  /**
   * Busca código de convite e lista de membros.
   */
  loadTeamData(): void {
    const baseUrl = this.tenantContext.getOrgApiBaseUrl();
    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ inviteCode: string }>(`${baseUrl}/team/invite-code`).subscribe({
      next: (response) => {
        this.inviteCode = response.inviteCode;
        this.loadMembers();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Não foi possível carregar o código de convite.';
      },
    });
  }

  /**
   * Copia código de convite para a área de transferência.
   */
  async copyInviteCode(): Promise<void> {
    if (!this.inviteCode) {
      return;
    }

    await navigator.clipboard.writeText(this.inviteCode);
    this.successMessage = 'Código copiado.';
  }

  /**
   * Copia link de convite para a área de transferência.
   */
  async copyInviteLink(): Promise<void> {
    if (!this.inviteLink) {
      return;
    }

    await navigator.clipboard.writeText(this.inviteLink);
    this.successMessage = 'Link copiado.';
  }

  /**
   * Gera novo código de convite da organização.
   */
  regenerateInviteCode(): void {
    const baseUrl = this.tenantContext.getOrgApiBaseUrl();
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.post<{ inviteCode: string }>(`${baseUrl}/team/invite-code/regenerate`, {}).subscribe({
      next: (response) => {
        this.inviteCode = response.inviteCode;
        this.saving = false;
        this.successMessage = 'Novo código gerado.';
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Não foi possível gerar um novo código.';
      },
    });
  }

  /**
   * Aprova solicitação pendente de acesso.
   * @param userId ID do usuário aprovado
   */
  approveMember(userId: string): void {
    const baseUrl = this.tenantContext.getOrgApiBaseUrl();
    this.httpClient.post<{ members: OrganizationMemberDto[] }>(`${baseUrl}/team/members/${userId}/approve`, {}).subscribe({
      next: (response) => {
        this.members = response.members;
        this.successMessage = 'Acesso aprovado.';
      },
      error: () => {
        this.errorMessage = 'Não foi possível aprovar o acesso.';
      },
    });
  }

  /**
   * Remove membro ou rejeita solicitação pendente.
   * @param userId ID do usuário removido
   */
  removeMember(userId: string): void {
    const baseUrl = this.tenantContext.getOrgApiBaseUrl();
    this.httpClient.delete<{ members: OrganizationMemberDto[] }>(`${baseUrl}/team/members/${userId}`).subscribe({
      next: (response) => {
        this.members = response.members;
        this.successMessage = 'Membro atualizado.';
      },
      error: () => {
        this.errorMessage = 'Não foi possível remover o membro.';
      },
    });
  }

  /**
   * Carrega membros ativos e pendentes.
   */
  private loadMembers(): void {
    const baseUrl = this.tenantContext.getOrgApiBaseUrl();
    this.httpClient.get<{ members: OrganizationMemberDto[] }>(`${baseUrl}/team/members`).subscribe({
      next: (response) => {
        this.members = response.members;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Não foi possível carregar os membros.';
      },
    });
  }
}
