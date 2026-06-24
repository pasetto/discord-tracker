import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './text-collaboration-report.component.html',
})
export class TextCollaborationReportComponent implements OnInit {
  report: TextCollaborationReportDto | null = null;
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
      if (this.hasGuild) {
        this.loadReport();
      }
    });
  }

  /**
   * Busca relatório de sinais de texto no backend para os últimos 7 dias.
   */
  loadReport(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor para ver os sinais de texto.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const now = new Date();
    const to = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ));
    const from = new Date(to.getTime() - (6 * 24 * 60 * 60 * 1000));

    const params = new HttpParams()
      .set('from', from.toISOString())
      .set('to', to.toISOString());

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
