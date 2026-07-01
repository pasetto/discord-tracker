import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrackedMemberOption, TrackedMembersService } from '../../../core/members/tracked-members.service';
import {
  goalProgressBarClass,
  goalProgressBarWidth,
  resolveGoalProgressStatus,
  type GoalProgressStatus,
} from '../../../core/goals/goal-progress.util';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Categoria de membro disponível para templates de meta.
 */
interface MemberCategoryDto {
  _id: string;
  name: string;
  slug: string;
}

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
  categoryId?: string;
  categoryName?: string;
  weeklyGoalHours: number | null;
  dailyMinimumHours: number | null;
  periodMinimumHours: number | null;
  businessDaysInPeriod: number;
  realizedHours: number;
  progressPercent: number;
  shouldAlertLowProgress: boolean;
}

/**
 * Grupo de colaboradores exibido por categoria.
 */
interface GoalsCategoryGroup {
  categoryId: string | null;
  categoryName: string;
  entries: GoalsReportEntryDto[];
}

/**
 * Resultado da aplicação de metas por categoria.
 */
interface ApplyCategoryGoalsResultDto {
  matchedTrackedUsers: number;
  appliedCount: number;
}

/**
 * Tela de configurações de metas individuais com aplicação de template por categoria.
 */
@Component({
  selector: 'app-goals-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './goals-settings.component.html',
})
export class GoalsSettingsComponent implements OnInit {
  categories: MemberCategoryDto[] = [];
  templates: CategoryGoalTemplateDto[] = [];
  entries: GoalsReportEntryDto[] = [];
  members: TrackedMemberOption[] = [];

  selectedCategoryId = '';
  weeklyGoalHours = 32;
  dailyMinimumHours = 5;

  loading = false;
  saving = false;
  applyingAll = false;
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
   * Nome da categoria selecionada.
   */
  get selectedCategoryName(): string {
    return this.categories.find((category) => category._id === this.selectedCategoryId)?.name ?? '';
  }

  /**
   * Membros atribuídos à categoria selecionada.
   */
  get membersInSelectedCategory(): TrackedMemberOption[] {
    return this.members.filter((member) => member.categoryId === this.selectedCategoryId);
  }

  /**
   * Relatório agrupado por categoria para exibição na tela.
   */
  get entriesByCategory(): GoalsCategoryGroup[] {
    const groups = new Map<string, GoalsCategoryGroup>();

    for (const entry of this.entries) {
      const key = entry.categoryId ?? '__none__';
      if (!groups.has(key)) {
        groups.set(key, {
          categoryId: entry.categoryId ?? null,
          categoryName: entry.categoryName ?? 'Sem categoria',
          entries: [],
        });
      }
      groups.get(key)!.entries.push(entry);
    }

    return Array.from(groups.values()).sort((left, right) => {
      if (left.categoryId === null) {
        return 1;
      }
      if (right.categoryId === null) {
        return -1;
      }
      return left.categoryName.localeCompare(right.categoryName, 'pt-BR');
    });
  }

  /**
   * Carrega templates e relatório ao inicializar tela.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.refreshData();
      }
    });
  }

  /**
   * Atualiza dados da tela consumindo backend de metas e categorias.
   */
  refreshData(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor antes de gerenciar metas.';
      return;
    }

    this.errorMessage = '';
    this.loading = true;
    const baseUrl = this.tenantContext.getGuildApiBaseUrl();

    this.httpClient.get<{ categories: MemberCategoryDto[] }>(`${baseUrl}/categories`).subscribe({
      next: (response) => {
        this.categories = response.categories ?? [];
        if (!this.selectedCategoryId && this.categories.length > 0) {
          this.selectedCategoryId = this.categories[0]._id;
          this.loadTemplateForSelectedCategory();
        }
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar categorias. Crie categorias em Configurações → Categorias.';
      },
    });

    this.httpClient.get<{ templates: CategoryGoalTemplateDto[] }>(`${baseUrl}/categories/goal-templates`).subscribe({
      next: (response) => {
        this.templates = response.templates ?? [];
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar templates de categorias.';
      },
    });

    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
    });

    this.httpClient.get<{ report: { entries: GoalsReportEntryDto[] } }>(`${baseUrl}/reports/goals`).subscribe({
      next: (response) => {
        this.entries = response.report?.entries ?? [];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Não foi possível carregar o relatório de metas.';
        this.loading = false;
      },
    });
  }

  /**
   * Carrega template salvo da categoria selecionada.
   */
  loadTemplateForSelectedCategory(): void {
    if (!this.selectedCategoryId) {
      return;
    }

    this.httpClient
      .get<{ template: CategoryGoalTemplateDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/categories/${this.selectedCategoryId}/goal-template`,
      )
      .subscribe({
        next: (response) => {
          this.weeklyGoalHours = response.template.weeklyCollaborationHours;
          this.dailyMinimumHours = response.template.dailyMinimumHours ?? 5;
        },
        error: () => {
          this.weeklyGoalHours = 32;
          this.dailyMinimumHours = 5;
        },
      });
  }

  /**
   * Salva template de meta para a categoria selecionada e aplica aos membros.
   */
  saveCategoryTemplate(): void {
    if (!this.selectedCategoryId) {
      this.errorMessage = 'Selecione uma categoria.';
      return;
    }

    if (this.membersInSelectedCategory.length === 0) {
      this.errorMessage = `Nenhum membro na categoria ${this.selectedCategoryName}. Atribua colaboradores em Configurações → Categorias.`;
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .put<{ template: CategoryGoalTemplateDto; applyResult: ApplyCategoryGoalsResultDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/categories/${this.selectedCategoryId}/goal-template`,
        {
          weeklyCollaborationHours: this.weeklyGoalHours,
          dailyMinimumHours: this.dailyMinimumHours,
        },
      )
      .subscribe({
        next: (response) => {
          this.saving = false;
          this.successMessage = this.buildApplySuccessMessage(
            this.selectedCategoryName,
            response.applyResult,
          );
          this.refreshData();
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = error.error?.error ?? 'Falha ao salvar template da categoria.';
        },
      });
  }

  /**
   * Aplica o template da categoria selecionada para todos os membros da categoria.
   */
  applyCategoryTemplate(): void {
    if (!this.selectedCategoryId) {
      this.errorMessage = 'Selecione uma categoria para aplicar o template.';
      return;
    }

    this.errorMessage = '';
    this.loading = true;

    this.httpClient
      .post<{ result: ApplyCategoryGoalsResultDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/members/apply-category-goals`,
        { categoryId: this.selectedCategoryId },
      )
      .subscribe({
        next: (response) => {
          this.successMessage = this.buildApplySuccessMessage(this.selectedCategoryName, response.result);
          this.refreshData();
        },
        error: (error) => {
          this.errorMessage = error.error?.error ?? 'Falha ao aplicar template para membros da categoria.';
          this.loading = false;
        },
      });
  }

  /**
   * Aplica templates de todas as categorias para os respectivos membros.
   */
  applyAllCategoryTemplates(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.applyingAll = true;

    this.httpClient
      .post<{
        result: {
          totalMatchedTrackedUsers: number;
          totalAppliedCount: number;
        };
      }>(`${this.tenantContext.getGuildApiBaseUrl()}/members/apply-all-category-goals`, {})
      .subscribe({
        next: (response) => {
          this.applyingAll = false;
          const { totalMatchedTrackedUsers, totalAppliedCount } = response.result;
          if (totalMatchedTrackedUsers === 0) {
            this.errorMessage =
              'Nenhum membro com categoria atribuída. Vá em Configurações → Categorias, sincronize e atribua cada colaborador.';
          } else {
            this.successMessage = `Metas aplicadas para ${totalAppliedCount} colaborador(es) em ${totalMatchedTrackedUsers} vínculo(s) de categoria.`;
          }
          this.refreshData();
        },
        error: (error) => {
          this.applyingAll = false;
          this.errorMessage = error.error?.error ?? 'Falha ao aplicar metas de todas as categorias.';
        },
      });
  }

  /**
   * Retorna nome da categoria pelo ID do template.
   * @param categoryId ID da categoria
   */
  getCategoryName(categoryId: string): string {
    return this.categories.find((category) => category._id === categoryId)?.name ?? categoryId;
  }

  /**
   * Conta membros rastreados vinculados a uma categoria.
   * @param categoryId ID da categoria
   */
  countMembersInCategory(categoryId: string): number {
    return this.members.filter((member) => member.categoryId === categoryId).length;
  }

  /**
   * Resolve status visual de progresso da meta.
   * @param entry Linha do relatório
   */
  getGoalStatus(entry: GoalsReportEntryDto): GoalProgressStatus {
    return resolveGoalProgressStatus(entry);
  }

  /**
   * Retorna classe CSS da barra de progresso.
   * @param entry Linha do relatório
   */
  getGoalBarClass(entry: GoalsReportEntryDto): string {
    return goalProgressBarClass(this.getGoalStatus(entry));
  }

  /**
   * Retorna largura percentual da barra de progresso.
   * @param entry Linha do relatório
   */
  getGoalBarWidth(entry: GoalsReportEntryDto): number {
    return goalProgressBarWidth(entry.realizedHours, entry.weeklyGoalHours);
  }

  /**
   * Monta mensagem de sucesso após aplicar metas por categoria.
   * @param categoryName Nome da categoria
   * @param result Resultado da aplicação
   */
  private buildApplySuccessMessage(
    categoryName: string,
    result: ApplyCategoryGoalsResultDto,
  ): string {
    if (result.matchedTrackedUsers === 0) {
      return `Template salvo para ${categoryName}, mas nenhum membro está nessa categoria. Atribua colaboradores em Configurações → Categorias.`;
    }

    return `Metas de ${categoryName} aplicadas para ${result.appliedCount} colaborador(es).`;
  }
}
