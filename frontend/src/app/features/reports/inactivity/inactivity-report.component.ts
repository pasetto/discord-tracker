import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Status de inatividade exposto pelo relatório semanal.
 */
type InactivityStatus = 'missing' | 'low_voice_collaboration' | 'returned' | 'on_planned_absence' | 'active';

/**
 * Linha de colaborador no relatório de "quem sumiu".
 */
interface InactivityReportEntryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  categoryName?: string;
  inactiveBusinessDays: number;
  status: InactivityStatus;
  lastSeenAt?: string;
  lastTextActivityAt?: string;
  lastPresenceAt?: string;
  lastVoiceCollaborationAt?: string;
}

/**
 * Estrutura do relatório semanal de inatividade.
 */
interface InactivityReportDto {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  entries: InactivityReportEntryDto[];
  plannedAbsenceEntries: InactivityReportEntryDto[];
}

/**
 * Relatório completo de inatividade com tabela desktop, cards mobile e exportação CSV.
 */
@Component({
  selector: 'app-inactivity-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inactivity-report.component.html',
})
export class InactivityReportComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  guildId = localStorage.getItem('syntra.guildId') ?? '';
  report: InactivityReportDto | null = null;
  loading = false;
  exporting = false;
  errorMessage = '';

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega relatório inicial quando IDs já existem no localStorage.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (this.orgId && this.guildId) {
      this.loadReport();
    }
  }

  /**
   * Busca relatório semanal de "quem sumiu" no backend.
   * @returns {void} Não retorna valor.
   */
  loadReport(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId para carregar o relatório.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    localStorage.setItem('syntra.guildId', this.guildId);
    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ report: InactivityReportDto }>(`${this.getBaseUrl()}/reports/inactivity/weekly`).subscribe({
      next: (response) => {
        this.report = response.report;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o relatório semanal de inatividade.';
        this.loading = false;
      },
    });
  }

  /**
   * Dispara exportação de CSV de inatividade.
   * @returns {void} Não retorna valor.
   */
  onExportInactivityCsv(): void {
    this.exportCsv('/export/inactivity', 'inatividade-semanal.csv');
  }

  /**
   * Dispara exportação de CSV de colaboração.
   * @returns {void} Não retorna valor.
   */
  onExportCollaborationCsv(): void {
    this.exportCsv('/export/csv', 'resumo-colaboracao.csv');
  }

  /**
   * Retorna o rótulo amigável para um status técnico do relatório.
   * @param {InactivityStatus} status Status técnico retornado pela API.
   * @returns {string} Texto amigável para renderização.
   */
  getStatusLabel(status: InactivityStatus): string {
    const labels: Record<InactivityStatus, string> = {
      missing: 'Quem sumiu',
      low_voice_collaboration: 'Baixa colaboração em voz',
      returned: 'Retornou',
      on_planned_absence: 'Ausência planejada',
      active: 'Ativo',
    };

    return labels[status];
  }

  /**
   * Exporta CSV de uma rota específica e inicia download no navegador.
   * @param {string} route Sufixo da rota de export dentro de `/guilds/:guildId`.
   * @param {string} fallbackFilename Nome padrão caso o header não informe filename.
   * @returns {void} Não retorna valor.
   */
  private exportCsv(route: string, fallbackFilename: string): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId antes de exportar.';
      return;
    }

    this.exporting = true;
    this.errorMessage = '';

    this.httpClient
      .post(`${this.getBaseUrl()}${route}`, {}, { observe: 'response', responseType: 'blob' })
      .subscribe({
        next: (response) => {
          this.triggerCsvDownload(response, fallbackFilename);
          this.exporting = false;
        },
        error: () => {
          this.errorMessage = 'Falha ao exportar CSV.';
          this.exporting = false;
        },
      });
  }

  /**
   * Cria link temporário para baixar um arquivo CSV retornado pela API.
   * @param {HttpResponse<Blob>} response Resposta HTTP contendo CSV em blob.
   * @param {string} fallbackFilename Nome padrão quando header não possui arquivo.
   * @returns {void} Não retorna valor.
   */
  private triggerCsvDownload(response: HttpResponse<Blob>, fallbackFilename: string): void {
    const blob = response.body;
    if (!blob) {
      this.errorMessage = 'Exportação retornou arquivo vazio.';
      return;
    }

    const filename = this.extractFilename(response.headers.get('content-disposition')) ?? fallbackFilename;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Extrai nome de arquivo do header `Content-Disposition`.
   * @param {string | null} contentDisposition Header bruto da resposta HTTP.
   * @returns {string | null} Nome de arquivo detectado ou `null`.
   */
  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const match = /filename="([^"]+)"/i.exec(contentDisposition);
    return match?.[1] ?? null;
  }

  /**
   * Monta URL base dos endpoints de relatório por tenant/guild.
   * @returns {string} Prefixo das rotas de API.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}`;
  }
}
