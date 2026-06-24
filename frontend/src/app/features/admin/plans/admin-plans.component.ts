import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, type AdminPlan } from '../../../core/admin/admin-api.service';

const DEFAULT_FEATURES: Record<string, boolean> = {
  gamification: true,
  ranking: false,
  exportCsv: false,
  exportPdf: false,
  apiAccess: false,
  webhooks: false,
  customChannelRules: true,
  teamGoals: false,
  advancedReports: false,
};

/** Rótulos legíveis das features de plano no formulário admin. */
const FEATURE_LABELS: Record<string, string> = {
  gamification: 'Gamificação',
  ranking: 'Ranking',
  exportCsv: 'Exportar CSV',
  exportPdf: 'Exportar PDF',
  apiAccess: 'Acesso API',
  webhooks: 'Webhooks',
  customChannelRules: 'Regras de canal customizadas',
  teamGoals: 'Metas de time',
  advancedReports: 'Relatórios avançados',
};

/**
 * CRUD de planos comerciais no painel super admin.
 */
@Component({
  selector: 'app-admin-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-plans.component.html',
})
export class AdminPlansComponent implements OnInit {
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  plans: AdminPlan[] = [];
  editingId: string | null = null;
  readonly featureLabels = FEATURE_LABELS;
  readonly featureKeys = Object.keys(FEATURE_LABELS);

  form = this.emptyForm();

  constructor(private readonly adminApi: AdminApiService) {}

  /**
   * Carrega catálogo de planos.
   */
  ngOnInit(): void {
    this.reload();
  }

  /**
   * Formata preço em reais.
   * @param cents Valor em centavos
   */
  formatPrice(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * Inicia edição de um plano existente.
   * @param plan Plano selecionado
   */
  startEdit(plan: AdminPlan): void {
    this.editingId = plan.id;
    this.form = {
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      priceCents: plan.priceCents,
      billingInterval: plan.billingInterval,
      limits: { ...plan.limits },
      features: { ...DEFAULT_FEATURES, ...plan.features },
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder,
      trialDays: plan.trialDays,
      stripeProductId: plan.stripeProductId ?? '',
      stripePriceId: plan.stripePriceId ?? '',
    };
    this.clearMessages();
  }

  /**
   * Abre formulário para novo plano.
   */
  startCreate(): void {
    this.editingId = 'new';
    this.form = this.emptyForm();
    this.clearMessages();
  }

  /**
   * Cancela edição/criação.
   */
  cancelEdit(): void {
    this.editingId = null;
    this.form = this.emptyForm();
  }

  /**
   * Persiste plano (criar ou atualizar).
   */
  save(): void {
    this.saving = true;
    this.clearMessages();

    const payload = {
      ...this.form,
      stripeProductId: this.form.stripeProductId || undefined,
      stripePriceId: this.form.stripePriceId || undefined,
    };

    const request$ =
      this.editingId === 'new'
        ? this.adminApi.createPlan(payload)
        : this.adminApi.updatePlan(this.editingId!, payload);

    request$.subscribe({
      next: () => {
        this.successMessage = this.editingId === 'new' ? 'Plano criado.' : 'Plano atualizado.';
        this.editingId = null;
        this.form = this.emptyForm();
        this.reload();
        this.saving = false;
      },
      error: (error: { error?: { message?: string } }) => {
        this.errorMessage = error.error?.message ?? 'Não foi possível salvar o plano.';
        this.saving = false;
      },
    });
  }

  private reload(): void {
    this.loading = true;
    this.adminApi.listPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Falha ao carregar planos.';
        this.loading = false;
      },
    });
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private emptyForm() {
    return {
      name: '',
      slug: '',
      description: '',
      priceCents: 0,
      billingInterval: 'month' as 'month' | 'year',
      limits: { maxGuilds: 1, maxTrackedMembers: 25, dataRetentionDays: 90 },
      features: { ...DEFAULT_FEATURES },
      isActive: true,
      isPublic: true,
      sortOrder: 0,
      trialDays: 14,
      stripeProductId: '',
      stripePriceId: '',
    };
  }
}
