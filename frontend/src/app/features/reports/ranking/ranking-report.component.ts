import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/** Linha do ranking gamificado. */
interface GamificationRankingEntryDto {
  position: number;
  discordId: string;
  displayName: string;
  isViewer: boolean;
  metricValue: number;
  metricLabel: string;
  productiveHours: number;
  voiceHours: number;
  onlineHours: number;
  collaborationScore: number;
}

/** Relatório de ranking retornado pela API. */
interface GamificationRankingReportDto {
  available: boolean;
  reason?: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  metric: string;
  visibility: string;
  anonymousMode: boolean;
  showExactHours: boolean;
  generatedAt: string;
  entries: GamificationRankingEntryDto[];
  viewerPosition?: number;
}

/**
 * Relatório de ranking gamificado conforme configuração do servidor.
 */
@Component({
  selector: 'app-ranking-report',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ranking-report.component.html',
})
export class RankingReportComponent implements OnInit {
  report: GamificationRankingReportDto | null = null;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Indica se há servidor Discord selecionado. */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /** Nome do servidor monitorado. */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /** Rótulo legível do período configurado. */
  get periodLabel(): string {
    const map: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
      monthly: 'Mensal',
    };
    return map[this.report?.period ?? 'weekly'] ?? 'Semanal';
  }

  /** Rótulo legível da métrica configurada. */
  get metricLabel(): string {
    const map: Record<string, string> = {
      productive_hours: 'Horas colaborativas',
      voice_hours: 'Horas em voz',
      online_hours: 'Horas online',
      collaboration_score: 'Score de colaboração',
    };
    return map[this.report?.metric ?? 'productive_hours'] ?? 'Horas colaborativas';
  }

  /** Carrega ranking ao abrir a tela. */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadReport();
      }
    });
  }

  /**
   * Busca ranking gamificado no backend.
   */
  loadReport(): void {
    if (!this.hasGuild) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient
      .get<{ report: GamificationRankingReportDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/gamification/ranking`,
      )
      .subscribe({
        next: ({ report }) => {
          this.report = report;
          this.loading = false;
        },
        error: (error: { error?: { error?: string } }) => {
          this.errorMessage = error.error?.error ?? 'Não foi possível carregar o ranking.';
          this.loading = false;
        },
      });
  }
}
