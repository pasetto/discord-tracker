import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Linha do relatório de metas individuais retornada pelo backend.
 */
interface GoalReportEntryDto {
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
 * Estrutura principal de resposta do relatório semanal de metas.
 */
interface GoalsReportDto {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  entries: GoalReportEntryDto[];
}

/**
 * Tela de relatório de metas com progresso individual por colaborador.
 */
@Component({
  selector: 'app-goals-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './goals-report.component.html',
})
export class GoalsReportComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  guildId = localStorage.getItem('syntra.guildId') ?? '';
  report: GoalsReportDto | null = null;
  loading = false;
  errorMessage = '';

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega o relatório no bootstrap quando IDs já existem em localStorage.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (this.orgId && this.guildId) {
      this.loadReport();
    }
  }

  /**
   * Busca relatório semanal de metas para organização e guild selecionadas.
   * @returns {void} Não retorna valor.
   */
  loadReport(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId para carregar o relatório de metas.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    localStorage.setItem('syntra.guildId', this.guildId);
    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ report: GoalsReportDto }>(`${this.getBaseUrl()}/reports/goals`).subscribe({
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
   * @param {GoalReportEntryDto} entry Linha do relatório.
   * @returns {string} Texto resumido de progresso.
   */
  getProgressText(entry: GoalReportEntryDto): string {
    if (!entry.weeklyGoalHours) {
      return `${entry.realizedHours.toFixed(2)}h realizadas (sem meta aplicada)`;
    }

    return `${entry.realizedHours.toFixed(2)}h / ${entry.weeklyGoalHours.toFixed(2)}h`;
  }

  /**
   * Retorna percentual de progresso limitado ao intervalo visual da barra.
   * @param {GoalReportEntryDto} entry Linha do relatório.
   * @returns {number} Percentual entre 0 e 100.
   */
  getProgressBarWidth(entry: GoalReportEntryDto): number {
    return Math.max(0, Math.min(100, entry.progressPercent ?? 0));
  }

  /**
   * Monta URL base dos endpoints de metas no tenant atual.
   * @returns {string} Prefixo das rotas de organização/guild.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}`;
  }
}
