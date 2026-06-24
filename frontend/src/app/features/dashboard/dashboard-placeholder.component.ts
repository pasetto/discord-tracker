import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

/** Status intradiário de alerta no dashboard. */
type IntradayConcernStatus = 'not_started' | 'low_collaboration_today';

/** Entrada do alerta intradiário "quem sumiu hoje". */
interface IntradayConcernEntryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  status: IntradayConcernStatus;
  elapsedWorkPercent: number;
  collaborationPercentOfElapsed: number;
  collaborationSecondsInWorkWindow: number;
  elapsedWorkSeconds: number;
  hasAppearedToday: boolean;
}

/** Status semanal de inatividade para contagem no dashboard. */
type WeeklyInactivityStatus = 'missing' | 'low_voice_collaboration' | 'returned' | 'on_planned_absence' | 'active';

/** Entrada resumida do relatório semanal de inatividade. */
interface WeeklyInactivityEntryDto {
  displayName: string;
  status: WeeklyInactivityStatus;
  inactiveBusinessDays?: number;
}

/** Relatório semanal resumido para widget do dashboard. */
interface WeeklyInactivityReportDto {
  entries: WeeklyInactivityEntryDto[];
}

/** Relatório intradiário consumido pelo widget do dashboard. */
interface IntradayInactivityReportDto {
  generatedAt: string;
  timezone: string;
  elapsedWorkPercent: number;
  elapsedWorkSeconds: number;
  totalWorkSeconds: number;
  isBusinessDay: boolean;
  isWithinWorkHours: boolean;
  settings: {
    lateStartThresholdPercent: number;
    minCollaborationPercentOfElapsed: number;
  };
  concernEntries: IntradayConcernEntryDto[];
}

/**
 * Página inicial focada em alertas de inatividade (hoje e semana).
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-placeholder.component.html',
})
export class DashboardPlaceholderComponent implements OnInit, OnDestroy {
  weeklyReport: WeeklyInactivityReportDto | null = null;
  weeklyLoading = false;
  intradayReport: IntradayInactivityReportDto | null = null;
  intradayLoading = false;
  errorMessage = '';
  private subscriptions = new Subscription();

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Nome da organização ativa. */
  get organizationName(): string {
    return this.authService.getOrganization()?.name ?? 'Sua organização';
  }

  /** Nome do servidor Discord monitorado. */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /** Indica se já há servidor selecionado. */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /** Colaboradores em alerta intradiário ("quem sumiu hoje"). */
  get intradayConcernEntries(): IntradayConcernEntryDto[] {
    return this.intradayReport?.concernEntries ?? [];
  }

  /** Entradas em alerta no relatório semanal. */
  get weeklyConcernEntries(): WeeklyInactivityEntryDto[] {
    if (!this.weeklyReport) {
      return [];
    }

    return this.weeklyReport.entries.filter(
      (entry) => entry.status === 'missing' || entry.status === 'low_voice_collaboration',
    );
  }

  /** Quantidade de colaboradores em alerta no relatório semanal. */
  get weeklyConcernCount(): number {
    return this.weeklyConcernEntries.length;
  }

  /** Carrega alertas quando o guild estiver disponível. */
  ngOnInit(): void {
    this.subscriptions.add(
      this.tenantContext.refresh().subscribe(() => {
        if (this.hasGuild) {
          this.loadReports();
        }
      }),
    );

    this.subscriptions.add(
      interval(5 * 60 * 1000).subscribe(() => {
        if (this.hasGuild) {
          this.loadIntradayReport();
        }
      }),
    );
  }

  /** Cancela polling ao sair da tela. */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Recarrega alertas intradiário e semanal. */
  loadReports(): void {
    this.loadWeeklyReport();
    this.loadIntradayReport();
  }

  /** Consulta relatório semanal resumido. */
  loadWeeklyReport(): void {
    if (!this.hasGuild) {
      return;
    }

    this.weeklyLoading = true;

    this.httpClient
      .get<{ report: WeeklyInactivityReportDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/reports/inactivity/weekly`,
      )
      .subscribe({
        next: (response) => {
          this.weeklyReport = response.report;
          this.weeklyLoading = false;
        },
        error: () => {
          this.weeklyLoading = false;
        },
      });
  }

  /** Consulta alerta intradiário de quem sumiu hoje. */
  loadIntradayReport(): void {
    if (!this.hasGuild) {
      return;
    }

    this.intradayLoading = true;

    this.httpClient
      .get<{ report: IntradayInactivityReportDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/reports/inactivity/intraday`,
      )
      .subscribe({
        next: (response) => {
          this.intradayReport = response.report;
          this.intradayLoading = false;
        },
        error: () => {
          this.intradayLoading = false;
        },
      });
  }

  /**
   * Traduz status intradiário para rótulo amigável.
   * @param status Status retornado pela API
   * @returns Texto em português
   */
  formatIntradayStatus(status: IntradayConcernStatus): string {
    const labels: Record<IntradayConcernStatus, string> = {
      not_started: 'Ainda não apareceu',
      low_collaboration_today: 'Colaboração baixa hoje',
    };
    return labels[status];
  }

  /**
   * Traduz status semanal para rótulo amigável.
   * @param status Status retornado pela API
   * @returns Texto em português
   */
  formatWeeklyStatus(status: WeeklyInactivityStatus): string {
    const labels: Partial<Record<WeeklyInactivityStatus, string>> = {
      missing: 'Sumiu',
      low_voice_collaboration: 'Baixa colaboração em voz',
    };
    return labels[status] ?? status;
  }

  /**
   * Classe CSS do badge de severidade intradiária.
   * @param status Status retornado pela API intradiária
   * @returns Classe tailwind para cor do badge
   */
  getIntradayStatusBadgeClass(status: IntradayConcernStatus): string {
    switch (status) {
      case 'not_started':
        return 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300';
      case 'low_collaboration_today':
        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  /**
   * Classe CSS do badge de severidade semanal.
   * @param status Status retornado pela API semanal
   * @returns Classe tailwind para cor do badge
   */
  getWeeklyStatusBadgeClass(status: WeeklyInactivityStatus): string {
    switch (status) {
      case 'missing':
        return 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300';
      case 'low_voice_collaboration':
        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  }
}
