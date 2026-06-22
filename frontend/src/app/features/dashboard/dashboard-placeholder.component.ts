import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

/**
 * Exibe placeholder do dashboard enquanto os cards analíticos são finalizados.
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Estamos preparando os widgets de colaboração e inatividade para esta área.
      </p>
    </section>
  `,
})
export class DashboardPlaceholderComponent {}
