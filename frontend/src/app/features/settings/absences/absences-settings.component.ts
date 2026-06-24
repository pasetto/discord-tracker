import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrackedMemberOption, TrackedMembersService } from '../../../core/members/tracked-members.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { MemberSelectComponent } from '../../../shared/components/member-select/member-select.component';

/**
 * Tipos de ausência suportados pelo backend.
 */
type PlannedAbsenceType = 'vacation' | 'pto' | 'sick_leave' | 'other';

/**
 * Item de ausência planejada retornado pela API.
 */
interface PlannedAbsenceDto {
  _id: string;
  trackedUserId: string;
  discordId: string;
  type: PlannedAbsenceType;
  startDate: string;
  endDate: string;
  note?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

/**
 * Formulário de criação/edição de ausência.
 */
interface AbsenceFormModel {
  trackedUserId: string;
  discordId: string;
  type: PlannedAbsenceType;
  startDate: string;
  endDate: string;
  note: string;
}

/**
 * Tela de gestão de ausências planejadas por organização/guild.
 */
@Component({
  selector: 'app-absences-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MemberSelectComponent],
  templateUrl: './absences-settings.component.html',
})
export class AbsencesSettingsComponent implements OnInit {
  absences: PlannedAbsenceDto[] = [];
  members: TrackedMemberOption[] = [];
  editingAbsenceId: string | null = null;

  createForm: AbsenceFormModel = this.createInitialForm();
  editForm: AbsenceFormModel = this.createInitialForm();

  loading = false;
  saving = false;
  syncing = false;
  errorMessage = '';
  successMessage = '';

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
   * Dispara carregamento inicial quando o tenant já tem servidor.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadMembers();
        this.loadAbsences();
      }
    });
  }

  /**
   * Carrega membros rastreados para seleção nos formulários.
   */
  loadMembers(): void {
    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar os colaboradores do servidor.';
      },
    });
  }

  /**
   * Sincroniza membros do Discord e recarrega formulários.
   */
  syncMembers(): void {
    this.syncing = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.trackedMembersService.syncMembers().subscribe({
      next: (response) => {
        this.members = response.members;
        this.syncing = false;
        this.successMessage = `${response.syncedCount} colaboradores sincronizados do Discord.`;
      },
      error: (error) => {
        this.syncing = false;
        this.errorMessage = error.error?.error ?? 'Falha ao sincronizar membros do Discord.';
      },
    });
  }

  /**
   * Carrega lista de ausências da guild selecionada.
   */
  loadAbsences(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor antes de gerenciar ausências.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ absences: PlannedAbsenceDto[] }>(`${this.getBaseUrl()}/absences`).subscribe({
      next: (response) => {
        this.absences = response.absences ?? [];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Não foi possível carregar as ausências.';
        this.loading = false;
      },
    });
  }

  /**
   * Cria uma nova ausência com os dados do formulário.
   */
  createAbsence(): void {
    if (!this.createForm.trackedUserId || !this.createForm.discordId) {
      this.errorMessage = 'Selecione um colaborador antes de criar a ausência.';
      return;
    }

    if (!this.createForm.startDate || !this.createForm.endDate) {
      this.errorMessage = 'Informe as datas de início e fim.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.post<{ absence: PlannedAbsenceDto }>(`${this.getBaseUrl()}/absences`, this.createPayloadFromForm(this.createForm)).subscribe({
      next: () => {
        this.createForm = this.createInitialForm();
        this.saving = false;
        this.successMessage = 'Ausência criada com sucesso.';
        this.loadAbsences();
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Falha ao criar ausência.';
        this.saving = false;
      },
    });
  }

  /**
   * Inicia edição de uma ausência existente preenchendo o formulário.
   * @param absence Registro selecionado para edição
   */
  startEdit(absence: PlannedAbsenceDto): void {
    this.editingAbsenceId = absence._id;
    this.editForm = {
      trackedUserId: absence.trackedUserId,
      discordId: absence.discordId,
      type: absence.type,
      startDate: this.toDateInputValue(absence.startDate),
      endDate: this.toDateInputValue(absence.endDate),
      note: absence.note ?? '',
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Cancela estado de edição da ausência atual.
   */
  cancelEdit(): void {
    this.editingAbsenceId = null;
    this.editForm = this.createInitialForm();
  }

  /**
   * Persiste alterações da ausência em edição.
   */
  updateAbsence(): void {
    if (!this.editingAbsenceId) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .put<{ absence: PlannedAbsenceDto }>(
        `${this.getBaseUrl()}/absences/${this.editingAbsenceId}`,
        this.createPayloadFromForm(this.editForm, true),
      )
      .subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Ausência atualizada com sucesso.';
          this.cancelEdit();
          this.loadAbsences();
        },
        error: (error) => {
          this.errorMessage = error.error?.error ?? 'Falha ao atualizar ausência.';
          this.saving = false;
        },
      });
  }

  /**
   * Remove (cancela) uma ausência existente.
   * @param absenceId Identificador da ausência
   */
  deleteAbsence(absenceId: string): void {
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.delete(`${this.getBaseUrl()}/absences/${absenceId}`).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Ausência cancelada com sucesso.';
        this.loadAbsences();
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Falha ao cancelar ausência.';
        this.saving = false;
      },
    });
  }

  /**
   * Preenche IDs do colaborador selecionado no formulário de criação.
   * @param member Membro selecionado ou null
   */
  onCreateMemberSelected(member: TrackedMemberOption | null): void {
    this.createForm.trackedUserId = member?.id ?? '';
    this.createForm.discordId = member?.discordId ?? '';
  }

  /**
   * Retorna nome amigável do colaborador para exibição na lista.
   * @param absence Ausência cadastrada
   */
  getMemberLabel(absence: PlannedAbsenceDto): string {
    const member = this.members.find((item) => item.id === absence.trackedUserId);
    return member?.displayName ?? absence.discordId;
  }

  /**
   * Retorna nome amigável a partir dos IDs do formulário de edição.
   */
  get editMemberLabel(): string {
    return this.getMemberLabel({
      trackedUserId: this.editForm.trackedUserId,
      discordId: this.editForm.discordId,
    } as PlannedAbsenceDto);
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
   * Constrói payload compatível com endpoint de ausência.
   * @param form Formulário origem dos dados
   * @param skipTrackedUserId Quando `true`, omite trackedUserId para update
   */
  private createPayloadFromForm(form: AbsenceFormModel, skipTrackedUserId = false): Record<string, unknown> {
    return {
      ...(skipTrackedUserId ? {} : { trackedUserId: form.trackedUserId.trim() }),
      discordId: form.discordId.trim(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      note: form.note.trim() || undefined,
    };
  }

  /**
   * Retorna um formulário inicial vazio com defaults do MVP.
   */
  private createInitialForm(): AbsenceFormModel {
    return {
      trackedUserId: '',
      discordId: '',
      type: 'vacation',
      startDate: '',
      endDate: '',
      note: '',
    };
  }

  /**
   * Normaliza data ISO para valor aceito pelo input `date`.
   * @param isoDate Data ISO recebida do backend
   */
  private toDateInputValue(isoDate: string): string {
    return isoDate.slice(0, 10);
  }

  /**
   * Monta URL base dos endpoints de ausência no tenant atual.
   */
  private getBaseUrl(): string {
    return this.tenantContext.getGuildApiBaseUrl();
  }
}
