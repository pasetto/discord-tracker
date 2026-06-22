import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Item de ausência ativa exibido no widget do dashboard.
 */
interface ActiveAbsenceDto {
  _id: string;
  discordId: string;
  type: 'vacation' | 'pto' | 'sick_leave' | 'other';
  endDate: string;
  note?: string;
}

/**
 * Dashboard inicial com widget de ausências ativas para gestores.
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="space-y-6">
      <header class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Visão rápida de ausências ativas para apoiar leitura de colaboração semanal.
        </p>
      </header>

      <section class="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-2 dark:border-gray-800 dark:bg-white/[0.03]">
        <label class="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
          organizationId
          <input
            class="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            [(ngModel)]="orgId"
            placeholder="organizationId"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
          guildId
          <input
            class="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            [(ngModel)]="guildId"
            placeholder="guildId"
          />
        </label>
        <div class="md:col-span-2">
          <button
            type="button"
            class="min-h-11 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60 sm:w-auto"
            (click)="loadActiveAbsences()"
            [disabled]="loading"
          >
            {{ loading ? 'Atualizando...' : 'Atualizar widget de ausências' }}
          </button>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-white/90">Ausências ativas</h2>
          <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {{ activeAbsences.length }} ativas
          </span>
        </div>

        <p *ngIf="activeAbsences.length === 0" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Nenhuma ausência ativa encontrada.
        </p>

        <div *ngIf="activeAbsences.length > 0" class="mt-4 space-y-3">
          <article
            *ngFor="let absence of activeAbsences"
            class="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-gray-800 dark:text-white/90">{{ absence.discordId }}</p>
              <span class="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{{ formatType(absence.type) }}</span>
            </div>
            <p class="mt-2 text-gray-600 dark:text-gray-300">
              Retorno previsto: <strong>{{ absence.endDate | date: 'dd/MM/yyyy' }}</strong>
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ absence.note || 'Sem observação.' }}</p>
          </article>
        </div>
      </section>

      <p *ngIf="errorMessage" class="rounded-lg border border-error-300 bg-error-50 px-3 py-2 text-sm text-error-600">
        {{ errorMessage }}
      </p>
    </section>
  `,
})
export class DashboardPlaceholderComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  guildId = localStorage.getItem('syntra.guildId') ?? '';
  activeAbsences: ActiveAbsenceDto[] = [];
  loading = false;
  errorMessage = '';

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega ausências ativas ao inicializar quando IDs já existem localmente.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (this.orgId && this.guildId) {
      this.loadActiveAbsences();
    }
  }

  /**
   * Consulta endpoint de ausências ativas para preencher widget do dashboard.
   * @returns {void} Não retorna valor.
   */
  loadActiveAbsences(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId para carregar ausências ativas.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    localStorage.setItem('syntra.guildId', this.guildId);
    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ absences: ActiveAbsenceDto[] }>(`${this.getBaseUrl()}/absences/active`).subscribe({
      next: (response) => {
        this.activeAbsences = response.absences ?? [];
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Falha ao carregar ausências ativas.';
        this.loading = false;
      },
    });
  }

  /**
   * Traduz tipo técnico de ausência para rótulo amigável.
   * @param {'vacation' | 'pto' | 'sick_leave' | 'other'} type Tipo técnico retornado pela API.
   * @returns {string} Texto amigável para exibição.
   */
  formatType(type: 'vacation' | 'pto' | 'sick_leave' | 'other'): string {
    const labels = {
      vacation: 'Férias',
      pto: 'PTO',
      sick_leave: 'Licença médica',
      other: 'Outro',
    } as const;

    return labels[type];
  }

  /**
   * Monta URL base dos endpoints de ausências por tenant/guild.
   * @returns {string} Prefixo de rota para chamadas HTTP.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}`;
  }
}
