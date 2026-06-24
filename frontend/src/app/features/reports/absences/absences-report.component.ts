import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrackedMemberOption, TrackedMembersService } from '../../../core/members/tracked-members.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Tipos de ausência suportados pelo backend.
 */
type PlannedAbsenceType = 'vacation' | 'pto' | 'sick_leave' | 'other';

/**
 * Ausência ativa retornada pela API.
 */
interface ActiveAbsenceDto {
  _id: string;
  trackedUserId: string;
  discordId: string;
  type: PlannedAbsenceType;
  startDate: string;
  endDate: string;
  note?: string;
  status: 'active';
}

/**
 * Página de relatório com ausências ativas no momento.
 */
@Component({
  selector: 'app-absences-report',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './absences-report.component.html',
})
export class AbsencesReportComponent implements OnInit {
  absences: ActiveAbsenceDto[] = [];
  members: TrackedMemberOption[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
    private readonly trackedMembersService: TrackedMembersService,
  ) {}

  /**
   * Indica se há servidor Discord selecionado.
   */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /**
   * Nome do servidor monitorado.
   */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /**
   * Carrega ausências ativas quando o tenant já tem servidor.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadMembers();
        this.loadActiveAbsences();
      }
    });
  }

  /**
   * Consulta ausências ativas do servidor monitorado.
   */
  loadActiveAbsences(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor antes de ver ausências ativas.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ absences: ActiveAbsenceDto[] }>(`${this.getBaseUrl()}/absences/active`).subscribe({
      next: (response) => {
        this.absences = response.absences ?? [];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Não foi possível carregar as ausências ativas.';
        this.loading = false;
      },
    });
  }

  /**
   * Retorna nome amigável do colaborador para exibição na lista.
   * @param absence Ausência ativa
   */
  getMemberLabel(absence: ActiveAbsenceDto): string {
    const member = this.members.find((item) => item.id === absence.trackedUserId);
    return member?.displayName ?? absence.discordId;
  }

  /**
   * Converte tipo técnico para label amigável de interface.
   * @param type Tipo técnico da ausência
   */
  formatType(type: PlannedAbsenceType): string {
    const labels: Record<PlannedAbsenceType, string> = {
      vacation: 'Férias',
      pto: 'PTO',
      sick_leave: 'Licença médica',
      other: 'Outro',
    };
    return labels[type];
  }

  /**
   * Carrega membros rastreados para exibir nomes amigáveis.
   */
  private loadMembers(): void {
    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
    });
  }

  /**
   * Monta URL base dos endpoints de ausência no tenant atual.
   */
  private getBaseUrl(): string {
    return this.tenantContext.getGuildApiBaseUrl();
  }
}
