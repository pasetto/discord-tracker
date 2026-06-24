import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { ReportDateRangeValue, resolveReportDateRange, toReportDateHttpParams } from '../../../core/reports/report-date-range.util';
import { ReportDateFilterComponent } from '../../../shared/components/report-date-filter/report-date-filter.component';

/**
 * Linha de colaborador no relatório de sinais de texto.
 */
interface TextCollaborationEntryDto {
  discordId: string;
  displayName: string;
  categoryId: string | null;
  eventsCount: number;
  lastOccurredAt: string;
}

/**
 * Estrutura de resposta do relatório de sinais de texto.
 */
interface TextCollaborationReportDto {
  from: string;
  to: string;
  generatedAt: string;
  entries: TextCollaborationEntryDto[];
}

/**
 * Tela de relatório simples de sinais de texto colaborativo por membro.
 */
@Component({
  selector: 'app-text-collaboration-report',
  standalone: true,
  imports: [CommonModule, RouterLink, ReportDateFilterComponent],
  templateUrl: './text-collaboration-report.component.html',
})
export class TextCollaborationReportComponent implements OnInit {
  report: TextCollaborationReportDto | null = null;
  dateRange: ReportDateRangeValue = resolveReportDateRange('last_7_days');
  loading = false;
  errorMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Indica se há servidor Discord selecionado no tenant atual.
   */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /**
   * Nome do servidor monitorado no contexto.
   */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /**
   * Soma total de eventos textuais no período exibido.
   */
  get totalEvents(): number {
    if (!this.report?.entries.length) {
      return 0;
    }
    return this.report.entries.reduce((accumulator, entry) => accumulator + entry.eventsCount, 0);
  }

  /**
   * Carrega relatório ao iniciar, quando houver guild selecionada.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild && this.dateRange) {
        this.loadReport();
      }
    });
  }

  /**
   * Atualiza intervalo selecionado e recarrega relatório de sinais de texto.
   * @param range Período escolhido no filtro
   */
  onDateRangeChange(range: ReportDateRangeValue): void {
    this.dateRange = range;
    if (this.hasGuild) {
      this.loadReport();
    }
  }

  /**
   * Busca relatório de sinais de texto no backend para os últimos 7 dias.
   */
  loadReport(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor para ver os sinais de texto.';
      return;
    }
    if (!this.dateRange) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const params = toReportDateHttpParams(this.dateRange);

    this.httpClient.get<{ report: TextCollaborationReportDto }>(
      `${this.tenantContext.getGuildApiBaseUrl()}/reports/text-collaboration`,
      { params },
    ).subscribe({
      next: (response) => {
        this.report = response.report;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o relatório de sinais de texto.';
        this.loading = false;
      },
    });
  }
}
