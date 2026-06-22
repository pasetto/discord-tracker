import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './absences-settings.component.html',
})
export class AbsencesSettingsComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  guildId = localStorage.getItem('syntra.guildId') ?? '';
  absences: PlannedAbsenceDto[] = [];
  editingAbsenceId: string | null = null;

  createForm: AbsenceFormModel = this.createInitialForm();
  editForm: AbsenceFormModel = this.createInitialForm();

  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Dispara carregamento inicial quando IDs já estão salvos localmente.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (this.orgId && this.guildId) {
      this.loadAbsences();
    }
  }

  /**
   * Carrega lista de ausências da guild selecionada.
   * @returns {void} Não retorna valor.
   */
  loadAbsences(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId para carregar as ausências.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    localStorage.setItem('syntra.guildId', this.guildId);
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.get<{ absences: PlannedAbsenceDto[] }>(`${this.getBaseUrl()}/absences`).subscribe({
      next: (response) => {
        this.absences = response.absences ?? [];
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar as ausências.';
        this.loading = false;
      },
    });
  }

  /**
   * Cria uma nova ausência com os dados do formulário.
   * @returns {void} Não retorna valor.
   */
  createAbsence(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId antes de criar ausência.';
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
      error: () => {
        this.errorMessage = 'Falha ao criar ausência. Verifique trackedUserId e datas.';
        this.saving = false;
      },
    });
  }

  /**
   * Inicia edição de uma ausência existente preenchendo o formulário.
   * @param {PlannedAbsenceDto} absence Registro selecionado para edição.
   * @returns {void} Não retorna valor.
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
   * @returns {void} Não retorna valor.
   */
  cancelEdit(): void {
    this.editingAbsenceId = null;
    this.editForm = this.createInitialForm();
  }

  /**
   * Persiste alterações da ausência em edição.
   * @returns {void} Não retorna valor.
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
        error: () => {
          this.errorMessage = 'Falha ao atualizar ausência.';
          this.saving = false;
        },
      });
  }

  /**
   * Remove (cancela) uma ausência existente.
   * @param {string} absenceId Identificador da ausência.
   * @returns {void} Não retorna valor.
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
      error: () => {
        this.errorMessage = 'Falha ao cancelar ausência.';
        this.saving = false;
      },
    });
  }

  /**
   * Converte tipo técnico para label amigável de interface.
   * @param {PlannedAbsenceType} type Tipo técnico da ausência.
   * @returns {string} Label amigável para exibição.
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
   * @param {AbsenceFormModel} form Formulário origem dos dados.
   * @param {boolean} skipTrackedUserId Quando `true`, omite trackedUserId para update.
   * @returns {Record<string, unknown>} Objeto pronto para envio HTTP.
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
   * @returns {AbsenceFormModel} Estado inicial para criação/edição.
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
   * @param {string} isoDate Data ISO recebida do backend.
   * @returns {string} Data no formato `YYYY-MM-DD`.
   */
  private toDateInputValue(isoDate: string): string {
    return isoDate.slice(0, 10);
  }

  /**
   * Monta URL base dos endpoints de ausência no tenant atual.
   * @returns {string} Prefixo da API para ausências por guild.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}`;
  }
}
