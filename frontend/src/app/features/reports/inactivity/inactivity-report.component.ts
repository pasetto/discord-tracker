import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

/**
 * Renderiza área mínima do relatório de inatividade com ações de exportação CSV.
 */
@Component({
  selector: 'app-inactivity-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <header>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Relatório de inatividade</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Quem sumiu esta semana e resumo de colaboração.
        </p>
      </header>

      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-white/5 sm:w-auto"
          (click)="onExportInactivityCsv()"
        >
          Exportar CSV inatividade
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-white/5 sm:w-auto"
          (click)="onExportCollaborationCsv()"
        >
          Exportar CSV colaboração
        </button>
      </div>
    </section>
  `,
})
export class InactivityReportComponent {
  /**
   * Dispara exportação de CSV de inatividade.
   * @returns {void} Não retorna valor.
   */
  onExportInactivityCsv(): void {
    // Stub intencional para integrar com API de export na próxima etapa da UI.
  }

  /**
   * Dispara exportação de CSV de colaboração.
   * @returns {void} Não retorna valor.
   */
  onExportCollaborationCsv(): void {
    // Stub intencional para integrar com API de export na próxima etapa da UI.
  }
}
