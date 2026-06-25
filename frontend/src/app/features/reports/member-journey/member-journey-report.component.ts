import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexLegend,
  ApexPlotOptions,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { TrackedMembersService, TrackedMemberOption } from '../../../core/members/tracked-members.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import {
  ReportDateRangeValue,
  resolveReportDateRange,
  toReportDateHttpParams,
} from '../../../core/reports/report-date-range.util';
import { ReportDateFilterComponent } from '../../../shared/components/report-date-filter/report-date-filter.component';

/** Sinal usado para determinar entrada/saída. */
type MemberJourneySignal = 'presence' | 'voice';

/** Jornada de um dia civil. */
interface MemberJourneyDayDto {
  date: string;
  weekday: number;
  hasActivity: boolean;
  entryMinute: number | null;
  exitMinute: number | null;
  entryLabel: string | null;
  exitLabel: string | null;
  spanMinutes: number;
}

/** Padrão agregado por dia da semana. */
interface MemberJourneyWeekdayPatternDto {
  weekday: number;
  label: string;
  sampleDays: number;
  avgEntryMinute: number | null;
  avgExitMinute: number | null;
  avgEntryLabel: string | null;
  avgExitLabel: string | null;
  earliestEntryMinute: number | null;
  latestEntryMinute: number | null;
  entrySpreadMinutes: number | null;
}

/** Resumo geral da jornada. */
interface MemberJourneySummaryDto {
  totalDays: number;
  daysWithActivity: number;
  avgEntryMinute: number | null;
  avgExitMinute: number | null;
  avgEntryLabel: string | null;
  avgExitLabel: string | null;
  avgSpanHours: number;
}

/** Relatório completo de jornada do colaborador. */
interface MemberJourneyReportDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  timezone: string;
  signal: MemberJourneySignal;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  days: MemberJourneyDayDto[];
  weekdayPatterns: MemberJourneyWeekdayPatternDto[];
  summary: MemberJourneySummaryDto;
}

/** Limite considerado alta variabilidade na entrada (em minutos). */
const HIGH_ENTRY_SPREAD_MINUTES = 60;

/**
 * Relatório de padrões de jornada por colaborador: mostra o horário de entrada e
 * saída de cada dia em um gráfico de faixa, ajudando a identificar comportamentos
 * (ex.: entra 09:30, mas às quartas entra 11:00).
 */
@Component({
  selector: 'app-member-journey-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReportDateFilterComponent, NgApexchartsModule],
  templateUrl: './member-journey-report.component.html',
})
export class MemberJourneyReportComponent implements OnInit {
  members: TrackedMemberOption[] = [];
  selectedTrackedUserId = '';
  signal: MemberJourneySignal = 'presence';
  dateRange: ReportDateRangeValue = resolveReportDateRange('last_7_days');
  report: MemberJourneyReportDto | null = null;
  loading = false;
  errorMessage = '';

  chartSeries: ApexAxisChartSeries = [];
  readonly chart: ApexChart = {
    type: 'rangeBar',
    height: 360,
    fontFamily: 'Outfit, sans-serif',
    toolbar: { show: false },
  };
  readonly plotOptions: ApexPlotOptions = {
    bar: {
      horizontal: true,
      borderRadius: 4,
      barHeight: '60%',
    },
  };
  readonly dataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (_value, opts): string => {
      const point = opts?.w?.config?.series?.[opts.seriesIndex]?.data?.[opts.dataPointIndex] as
        | { meta?: { label?: string } }
        | undefined;
      return point?.meta?.label ?? '';
    },
    style: { fontSize: '11px', colors: ['#fff'] },
  };
  readonly fill: ApexFill = { type: 'solid', opacity: 0.85 };
  readonly legend: ApexLegend = { show: false };
  readonly xaxis: ApexXAxis = {
    type: 'numeric',
    min: 0,
    max: 24 * 60,
    tickAmount: 12,
    labels: {
      formatter: (value: string): string => this.minutesToLabel(Number(value)),
    },
    title: { text: 'Hora do dia' },
  };
  readonly yaxis: ApexYAxis = {
    labels: { style: { fontSize: '12px' } },
  };
  readonly tooltip: ApexTooltip = {
    custom: ({ seriesIndex, dataPointIndex, w }): string => {
      const point = w?.config?.series?.[seriesIndex]?.data?.[dataPointIndex] as
        | { x?: string; meta?: { label?: string } }
        | undefined;
      const day = point?.x ?? '';
      const label = point?.meta?.label ?? 'Sem atividade';
      return `<div class="px-3 py-2 text-xs"><strong>${day}</strong><br/>${label}</div>`;
    },
  };

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
   * Dias com atividade no período (para listagem detalhada).
   */
  get activeDays(): MemberJourneyDayDto[] {
    return this.report?.days.filter((day) => day.hasActivity) ?? [];
  }

  /**
   * Dias da semana destacados por alta variabilidade de entrada.
   */
  get patternsWithVariability(): MemberJourneyWeekdayPatternDto[] {
    return this.report?.weekdayPatterns ?? [];
  }

  /**
   * Carrega membros quando o tenant estiver pronto.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadMembers();
      }
    });
  }

  /**
   * Carrega a lista de colaboradores rastreados para seleção.
   */
  loadMembers(): void {
    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.members = members;
        if (!this.selectedTrackedUserId && members.length > 0) {
          this.selectedTrackedUserId = members[0].id;
          this.loadReport();
        }
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar os colaboradores.';
      },
    });
  }

  /**
   * Recarrega ao trocar o colaborador selecionado.
   */
  onMemberChange(): void {
    this.loadReport();
  }

  /**
   * Recarrega ao trocar o sinal (presença/voz).
   * @param signal Sinal escolhido
   */
  onSignalChange(signal: MemberJourneySignal): void {
    this.signal = signal;
    this.loadReport();
  }

  /**
   * Atualiza intervalo e recarrega.
   * @param range Período escolhido
   */
  onDateRangeChange(range: ReportDateRangeValue): void {
    this.dateRange = range;
    this.loadReport();
  }

  /**
   * Busca o relatório de jornada do colaborador selecionado.
   */
  loadReport(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor para ver os padrões por pessoa.';
      return;
    }
    if (!this.selectedTrackedUserId) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const params = toReportDateHttpParams(this.dateRange)
      .set('trackedUserId', this.selectedTrackedUserId)
      .set('signal', this.signal);

    this.httpClient
      .get<{ report: MemberJourneyReportDto }>(`${this.tenantContext.getGuildApiBaseUrl()}/reports/member-journey`, {
        params,
      })
      .subscribe({
        next: (response) => {
          this.report = response.report;
          this.chartSeries = this.buildChartSeries(response.report);
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Não foi possível carregar os padrões deste colaborador.';
          this.loading = false;
        },
      });
  }

  /**
   * Converte os dias do relatório em série do gráfico de faixa (entrada→saída).
   * @param report Relatório recebido
   * @returns Série pronta para o ApexCharts
   */
  private buildChartSeries(report: MemberJourneyReportDto): ApexAxisChartSeries {
    const data = report.days
      .filter((day) => day.hasActivity && day.entryMinute !== null && day.exitMinute !== null)
      .map((day) => ({
        x: this.formatDayLabel(day),
        y: [day.entryMinute as number, day.exitMinute as number],
        fillColor: this.isOutlierDay(report, day) ? '#f59e0b' : '#465fff',
        meta: { label: `${day.entryLabel} → ${day.exitLabel}` },
      }));

    return [{ name: 'Jornada', data }];
  }

  /**
   * Indica se o dia foge da média de entrada do seu dia da semana.
   * @param report Relatório com padrões
   * @param day Dia avaliado
   * @returns `true` quando a entrada destoa do padrão do dia da semana
   */
  private isOutlierDay(report: MemberJourneyReportDto, day: MemberJourneyDayDto): boolean {
    if (day.entryMinute === null) {
      return false;
    }
    const pattern = report.weekdayPatterns.find((item) => item.weekday === day.weekday);
    if (!pattern || pattern.avgEntryMinute === null || pattern.sampleDays < 2) {
      return false;
    }
    return Math.abs(day.entryMinute - pattern.avgEntryMinute) >= HIGH_ENTRY_SPREAD_MINUTES;
  }

  /**
   * Rótulo curto de um dia (ex.: "Seg 22/06").
   * @param day Dia da jornada
   * @returns Texto para o eixo do gráfico
   */
  formatDayLabel(day: MemberJourneyDayDto): string {
    const short = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day.weekday] ?? '';
    const [, month, dayOfMonth] = day.date.split('-');
    return `${short} ${dayOfMonth}/${month}`;
  }

  /**
   * Formata minutos desde a meia-noite como HH:MM.
   * @param minutes Minutos no dia
   * @returns Texto HH:MM
   */
  minutesToLabel(minutes: number): string {
    const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
    const hour = Math.floor(clamped / 60);
    const minute = clamped % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  /**
   * Indica se um padrão tem alta variabilidade de entrada.
   * @param pattern Padrão do dia da semana
   * @returns `true` quando a dispersão é relevante
   */
  isHighVariability(pattern: MemberJourneyWeekdayPatternDto): boolean {
    return (pattern.entrySpreadMinutes ?? 0) >= HIGH_ENTRY_SPREAD_MINUTES;
  }
}
