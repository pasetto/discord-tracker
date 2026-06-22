import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Chaves válidas de dias da semana para configuração do calendário.
 */
type WorkWeekDayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Configuração de um dia da semana no calendário.
 */
interface WorkDaySchedule {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
}

/**
 * Jornada semanal de trabalho usada na tela de calendário.
 */
interface WorkWeek {
  monday: WorkDaySchedule;
  tuesday: WorkDaySchedule;
  wednesday: WorkDaySchedule;
  thursday: WorkDaySchedule;
  friday: WorkDaySchedule;
  saturday: WorkDaySchedule;
  sunday: WorkDaySchedule;
}

/**
 * Feriado configurado para excluir dias úteis no cálculo de colaboração.
 */
interface WorkCalendarHoliday {
  date: string;
  name: string;
  type: 'national_br' | 'company_custom';
  recurring?: boolean;
}

/**
 * Estrutura de calendário retornada pelo backend.
 */
interface WorkCalendarDto {
  workWeek: WorkWeek;
  holidays: WorkCalendarHoliday[];
  brNationalHolidaysSeeded: boolean;
}

/**
 * Item de apresentação para renderizar dias da semana com labels amigáveis.
 */
interface WorkWeekUiItem {
  key: WorkWeekDayKey;
  label: string;
}

/**
 * Tela de configurações de calendário com jornada semanal e feriados.
 */
@Component({
  selector: 'app-calendar-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-settings.component.html',
})
export class CalendarSettingsComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  calendar: WorkCalendarDto | null = null;
  loading = false;
  saving = false;
  seeding = false;
  errorMessage = '';
  successMessage = '';

  readonly weekItems: WorkWeekUiItem[] = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega calendário da organização no bootstrap da página.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (!this.orgId) {
      this.errorMessage = 'Preencha organizationId para carregar o calendário.';
      return;
    }

    this.loadCalendar();
  }

  /**
   * Busca calendário atual da organização no backend.
   * @returns {void} Não retorna valor.
   */
  loadCalendar(): void {
    if (!this.orgId) {
      this.errorMessage = 'organizationId é obrigatório.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.get<{ calendar: WorkCalendarDto }>(`${this.getBaseUrl()}/work-calendar`).subscribe({
      next: (response) => {
        this.calendar = response.calendar;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o calendário da organização.';
        this.loading = false;
      },
    });
  }

  /**
   * Persiste jornada semanal e feriados no backend.
   * @returns {void} Não retorna valor.
   */
  saveCalendar(): void {
    if (!this.calendar) {
      this.errorMessage = 'Carregue o calendário antes de salvar.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .put<{ calendar: WorkCalendarDto }>(`${this.getBaseUrl()}/work-calendar`, {
        workWeek: this.calendar.workWeek,
        holidays: this.calendar.holidays,
      })
      .subscribe({
        next: (response) => {
          this.calendar = response.calendar;
          this.saving = false;
          this.successMessage = 'Calendário salvo com sucesso.';
        },
        error: () => {
          this.errorMessage = 'Falha ao salvar calendário.';
          this.saving = false;
        },
      });
  }

  /**
   * Aplica seed dos feriados nacionais do Brasil no calendário atual.
   * @returns {void} Não retorna valor.
   */
  seedBrazilHolidays(): void {
    this.seeding = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .post<{ calendar: WorkCalendarDto; insertedCount: number }>(`${this.getBaseUrl()}/work-calendar/seed-brazil-holidays`, {})
      .subscribe({
        next: (response) => {
          this.calendar = response.calendar;
          this.seeding = false;
          this.successMessage = `${response.insertedCount} feriados nacionais inseridos/atualizados.`;
        },
        error: () => {
          this.errorMessage = 'Falha ao aplicar seed de feriados nacionais.';
          this.seeding = false;
        },
      });
  }

  /**
   * Adiciona uma linha de feriado customizado na lista em memória.
   * @returns {void} Não retorna valor.
   */
  addHoliday(): void {
    if (!this.calendar) {
      return;
    }

    this.calendar.holidays = [
      ...this.calendar.holidays,
      {
        date: '',
        name: '',
        type: 'company_custom',
        recurring: false,
      },
    ];
  }

  /**
   * Remove um feriado da lista em memória pelo índice informado.
   * @param {number} index Índice do item a ser removido.
   * @returns {void} Não retorna valor.
   */
  removeHoliday(index: number): void {
    if (!this.calendar) {
      return;
    }

    this.calendar.holidays = this.calendar.holidays.filter((_, itemIndex) => itemIndex !== index);
  }

  /**
   * Resolve o estado de edição de um dia da semana.
   * @param {WorkWeekDayKey} day Chave do dia na jornada semanal.
   * @returns {WorkDaySchedule} Configuração do dia solicitado.
   */
  getDaySchedule(day: WorkWeekDayKey): WorkDaySchedule {
    return this.calendar?.workWeek[day] ?? { enabled: false };
  }

  /**
   * Monta URL base para endpoints do tenant atual.
   * @returns {string} Prefixo das rotas de organização.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}`;
  }
}
