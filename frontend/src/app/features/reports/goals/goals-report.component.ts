import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Linha do relatório de metas individuais retornada pelo backend.
 */
interface GoalReportEntryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  categoryId?: string;
  categoryName?: string;
  weeklyGoalHours: number | null;
  dailyMinimumHours: number | null;
  realizedHours: number;
  progressPercent: number;
  shouldAlertLowProgress: boolean;
}

/**
 * Estrutura principal de resposta do relatório semanal de metas.
 */
interface GoalsReportDto {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  entries: GoalReportEntryDto[];
}

/**
 * Grupo de colaboradores exibido por categoria no relatório.
 */
interface GoalsReportCategoryGroup {
  categoryId: string | null;
  categoryName: string;
  entries: GoalReportEntryDto[];
}

/**
 * Tela de relatório de metas com progresso individual por colaborador.
 */
@Component({
  selector: 'app-goals-report',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './goals-report.component.html',
})
export class GoalsReportComponent implements OnInit {
  report: GoalsReportDto | null = null;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
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
   * Entradas do relatório agrupadas por categoria.
   */
  get entriesByCategory(): GoalsReportCategoryGroup[] {
    if (!this.report?.entries.length) {
      return [];
    }

    const groups = new Map<string, GoalsReportCategoryGroup>();

    for (const entry of this.report.entries) {
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
   * Carrega o relatório quando o tenant já tem servidor configurado.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadReport();
      }
    });
  }

  /**
   * Busca relatório semanal de metas para o servidor monitorado.
   */
  loadReport(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor para ver o relatório de metas.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ report: GoalsReportDto }>(`${this.tenantContext.getGuildApiBaseUrl()}/reports/goals`).subscribe({
      next: (response) => {
        this.report = response.report;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o relatório de metas.';
        this.loading = false;
      },
    });
  }

  /**
   * Gera texto de progresso com meta e realizado para exibição compacta.
   * @param entry Linha do relatório
   * @returns Texto resumido de progresso
   */
  getProgressText(entry: GoalReportEntryDto): string {
    if (!entry.weeklyGoalHours) {
      return `${entry.realizedHours.toFixed(2)}h realizadas (sem meta aplicada)`;
    }

    return `${entry.realizedHours.toFixed(2)}h / ${entry.weeklyGoalHours.toFixed(2)}h`;
  }

  /**
   * Retorna percentual de progresso limitado ao intervalo visual da barra.
   * @param entry Linha do relatório
   * @returns Percentual entre 0 e 100
   */
  getProgressBarWidth(entry: GoalReportEntryDto): number {
    return Math.max(0, Math.min(100, entry.progressPercent ?? 0));
  }
}
