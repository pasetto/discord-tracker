import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Página inicial do painel super admin com atalhos.
 */
@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="space-y-4">
      <header class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Visão geral</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Gerencie catálogo de planos, usuários da plataforma e organizações (tenants).
        </p>
      </header>

      <div class="grid gap-3 sm:grid-cols-2">
        <a routerLink="/admin/plans" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300 dark:border-gray-800 dark:bg-gray-950">
          <p class="font-semibold text-gray-900 dark:text-white">Planos</p>
          <p class="mt-1 text-sm text-gray-500">Preços, limites e features do catálogo</p>
        </a>
        <a routerLink="/admin/users" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300 dark:border-gray-800 dark:bg-gray-950">
          <p class="font-semibold text-gray-900 dark:text-white">Usuários</p>
          <p class="mt-1 text-sm text-gray-500">Promover super admin, listar contas</p>
        </a>
        <a routerLink="/admin/organizations" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300 dark:border-gray-800 dark:bg-gray-950">
          <p class="font-semibold text-gray-900 dark:text-white">Organizações</p>
          <p class="mt-1 text-sm text-gray-500">Tenants, plano e status de assinatura</p>
        </a>
        <a routerLink="/admin/discord" class="rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300 dark:border-gray-800 dark:bg-gray-950">
          <p class="font-semibold text-gray-900 dark:text-white">Bot Discord</p>
          <p class="mt-1 text-sm text-gray-500">Aplicativo compartilhado da plataforma</p>
        </a>
      </div>
    </section>
  `,
})
export class AdminHomeComponent {}
