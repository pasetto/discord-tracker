import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Template de meta semanal configurado por categoria.
 */
interface CategoryGoalTemplateDto {
  _id: string;
  categoryId: string;
  weeklyCollaborationHours: number;
  dailyMinimumHours?: number;
}

/**
 * Entrada de relatório semanal de metas individuais.
 */
interface GoalsReportEntryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  weeklyGoalHours: number | null;
  dailyMinimumHours: number | null;
  realizedHours: number;
  progressPercent: number;
  shouldAlertLowProgress: boolean;
}

/**
 * Tela de configurações de metas individuais com aplicação de template por categoria.
 */
@Component({
  selector: 'app-goals-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './goals-settings.component.html',
})
export class GoalsSettingsComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  guildId = localStorage.getItem('syntra.guildId') ?? '';
  templates: CategoryGoalTemplateDto[] = [];
  entries: GoalsReportEntryDto[] = [];
  categoryIdToApply = '';
  loading = false;
  errorMessage = '';

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega templates e relatório ao inicializar tela.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (this.orgId && this.guildId) {
      this.refreshData();
    }
  }

  /**
   * Atualiza dados da tela consumindo backend de metas.
   * @returns {void} Não retorna valor.
   */
  refreshData(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId para carregar os dados.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    localStorage.setItem('syntra.guildId', this.guildId);
    this.errorMessage = '';
    this.loading = true;

    const baseUrl = this.getBaseUrl();
    this.httpClient.get<{ templates: CategoryGoalTemplateDto[] }>(`${baseUrl}/categories/goal-templates`).subscribe({
      next: (response) => {
        this.templates = response.templates ?? [];
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar templates de categorias.';
      },
    });

    this.httpClient.get<{ report: { entries: GoalsReportEntryDto[] } }>(`${baseUrl}/reports/goals`).subscribe({
      next: (response) => {
        this.entries = response.report?.entries ?? [];
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o relatório de metas.';
        this.loading = false;
      },
    });
  }

  /**
   * Aplica o template da categoria selecionada para todos os membros da categoria.
   * @returns {void} Não retorna valor.
   */
  applyCategoryTemplate(): void {
    if (!this.categoryIdToApply) {
      this.errorMessage = 'Informe o categoryId para aplicar o template.';
      return;
    }

    this.errorMessage = '';
    this.loading = true;

    this.httpClient
      .post(`${this.getBaseUrl()}/members/apply-category-goals`, {
        categoryId: this.categoryIdToApply,
      })
      .subscribe({
        next: () => {
          this.refreshData();
        },
        error: () => {
          this.errorMessage = 'Falha ao aplicar template para membros da categoria.';
          this.loading = false;
        },
      });
  }

  /**
   * Monta URL base dos endpoints de metas no backend.
   * @returns {string} URL base para requisições da feature.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}`;
  }
}
