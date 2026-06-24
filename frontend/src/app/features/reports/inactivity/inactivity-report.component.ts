import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrackedMembersService } from '../../../core/members/tracked-members.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inactivity-report.component.html',
})
export class InactivityReportComponent implements OnInit {
  report: InactivityReportDto | null = null;
  trackedMembersCount = 0;
  loading = false;
  exporting = false;
  syncing = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
    private readonly trackedMembersService: TrackedMembersService,
  ) {}

  /**
   * Indica se o tenant já tem servidor selecionado.
   */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /**
   * Entradas com foco em quem sumiu ou baixa colaboração.
   */
  get concernEntries(): InactivityReportEntryDto[] {
    if (!this.report) {
      return [];
    }

    return this.report.entries.filter((entry) => entry.status === 'missing' || entry.status === 'low_voice_collaboration');
  }

  /**
   * Total de colaboradores monitorados no relatório.
   */
  get totalTrackedInReport(): number {
    if (!this.report) {
      return 0;
    }

    return this.report.entries.length + this.report.plannedAbsenceEntries.length;
  }

  /**
   * Carrega relatório quando o contexto do tenant estiver pronto.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadMembersCount();
        this.loadReport();
      }
    });
  }

  /**
   * Sincroniza membros do Discord e recarrega relatório.
   */
  syncMembersAndReload(): void {
    this.syncing = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.trackedMembersService.syncMembers().subscribe({
      next: (response) => {
        this.trackedMembersCount = response.members.length;
        this.syncing = false;
        this.successMessage = `${response.syncedCount} colaboradores sincronizados.`;
        this.loadReport();
      },
      error: (error) => {
        this.syncing = false;
        this.errorMessage = error.error?.error ?? 'Falha ao sincronizar membros do Discord.';
      },
    });
  }

  /**
   * Carrega quantidade de membros rastreados.
   */
  private loadMembersCount(): void {
    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.trackedMembersCount = members.length;
      },
    });
  }

  /**
   * Busca relatório semanal de "quem sumiu" no backend.
   */
  loadReport(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor antes de carregar o relatório.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';

    this.httpClient.get<{ report: InactivityReportDto }>(`${this.getBaseUrl()}/reports/inactivity/weekly`).subscribe({
      next: (response) => {
        this.report = response.report;
        this.loading = false;
        this.loadMembersCount();
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Não foi possível carregar o relatório semanal de inatividade.';
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
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord antes de exportar.';
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
          this.successMessage = 'Exportação concluída.';
        },
        error: async (error) => {
          this.exporting = false;
          this.errorMessage = await this.resolveExportError(error);
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
    return this.tenantContext.getGuildApiBaseUrl();
  }

  /**
   * Extrai mensagem de erro quando export retorna JSON em blob.
   * @param error Erro HTTP da exportação
   */
  private async resolveExportError(error: { error?: Blob }): Promise<string> {
    const blob = error.error;
    if (blob instanceof Blob) {
      try {
        const payload = JSON.parse(await blob.text()) as { error?: string };
        if (payload.error) {
          return payload.error;
        }
      } catch {
        // ignora parse inválido
      }
    }

    return 'Falha ao exportar CSV.';
  }
}
