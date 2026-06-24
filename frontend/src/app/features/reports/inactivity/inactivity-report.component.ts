import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrackedMembersService } from '../../../core/members/tracked-members.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { ReportDateRangeValue, resolveReportDateRange, toReportDateHttpParams } from '../../../core/reports/report-date-range.util';
import { ReportDateFilterComponent } from '../../../shared/components/report-date-filter/report-date-filter.component';

/**
 * Status de inatividade exposto pelo relatório semanal.
 */
type InactivityStatus = 'missing' | 'low_voice_collaboration' | 'returned' | 'on_planned_absence' | 'active';

/**
 * Colunas ordenáveis da tabela de inatividade.
 */
type InactivitySortColumn = 'displayName' | 'inactiveBusinessDays' | 'status';

/**
 * Categoria de membro disponível para filtro.
 */
interface MemberCategoryDto {
  _id: string;
  name: string;
  slug: string;
}

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
 * Ponto da timeline de histórico semanal por membro.
 */
interface InactivityHistoryPointDto {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  status: InactivityStatus;
  inactiveBusinessDays: number;
}

/**
 * Histórico de inatividade de um colaborador.
 */
interface InactivityMemberHistoryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  timeline: InactivityHistoryPointDto[];
}

/**
 * Relatório completo de inatividade com tabela desktop, cards mobile e exportação CSV.
 */
@Component({
  selector: 'app-inactivity-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReportDateFilterComponent],
  templateUrl: './inactivity-report.component.html',
})
export class InactivityReportComponent implements OnInit {
  report: InactivityReportDto | null = null;
  categories: MemberCategoryDto[] = [];
  selectedCategoryId = '';
  dateRange: ReportDateRangeValue = resolveReportDateRange('this_week');
  sortColumn: InactivitySortColumn = 'inactiveBusinessDays';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedTrackedUserId: string | null = null;
  memberHistory: InactivityMemberHistoryDto | null = null;
  historyLoading = false;

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
   * Entradas de alerta ordenadas conforme coluna selecionada.
   */
  get sortedConcernEntries(): InactivityReportEntryDto[] {
    const entries = [...this.concernEntries];
    const direction = this.sortDirection === 'asc' ? 1 : -1;

    entries.sort((left, right) => {
      if (this.sortColumn === 'displayName') {
        return left.displayName.localeCompare(right.displayName, 'pt-BR') * direction;
      }

      if (this.sortColumn === 'inactiveBusinessDays') {
        return (left.inactiveBusinessDays - right.inactiveBusinessDays) * direction;
      }

      return left.status.localeCompare(right.status, 'pt-BR') * direction;
    });

    return entries;
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
        this.loadCategories();
        this.loadMembersCount();
        if (this.dateRange) {
          this.loadReport();
        }
      }
    });
  }

  /**
   * Atualiza intervalo selecionado e recarrega relatório.
   * @param range Período escolhido no filtro
   */
  onDateRangeChange(range: ReportDateRangeValue): void {
    this.dateRange = range;
    this.clearHistorySelection();
    if (this.hasGuild) {
      this.loadReport();
    }
  }

  /**
   * Recarrega relatório ao alterar filtro de categoria.
   */
  onCategoryFilterChange(): void {
    this.clearHistorySelection();
    this.loadReport();
  }

  /**
   * Alterna ordenação ao clicar no cabeçalho da coluna.
   * @param column Coluna selecionada
   */
  toggleSort(column: InactivitySortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortColumn = column;
    this.sortDirection = column === 'displayName' ? 'asc' : 'desc';
  }

  /**
   * Retorna indicador visual de ordenação para o cabeçalho.
   * @param column Coluna avaliada
   */
  getSortIndicator(column: InactivitySortColumn): string {
    if (this.sortColumn !== column) {
      return '';
    }

    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  /**
   * Seleciona membro e carrega histórico semanal de inatividade.
   * @param entry Linha selecionada na tabela
   */
  selectMember(entry: InactivityReportEntryDto): void {
    if (this.selectedTrackedUserId === entry.trackedUserId) {
      this.clearHistorySelection();
      return;
    }

    this.selectedTrackedUserId = entry.trackedUserId;
    this.loadMemberHistory(entry.trackedUserId);
  }

  /**
   * Indica se a linha está selecionada para exibir histórico.
   * @param entry Linha da tabela
   */
  isSelected(entry: InactivityReportEntryDto): boolean {
    return this.selectedTrackedUserId === entry.trackedUserId;
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
   * Carrega categorias disponíveis para filtro do relatório.
   */
  private loadCategories(): void {
    this.httpClient.get<{ categories: MemberCategoryDto[] }>(`${this.getBaseUrl()}/categories`).subscribe({
      next: (response) => {
        this.categories = response.categories ?? [];
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
    if (!this.dateRange) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    let params = toReportDateHttpParams(this.dateRange);
    if (this.selectedCategoryId) {
      params = params.set('categoryId', this.selectedCategoryId);
    }

    this.httpClient
      .get<{ report: InactivityReportDto }>(`${this.getBaseUrl()}/reports/inactivity/weekly`, { params })
      .subscribe({
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
   * Carrega histórico semanal de um colaborador selecionado.
   * @param trackedUserId ID do membro rastreado
   */
  private loadMemberHistory(trackedUserId: string): void {
    this.historyLoading = true;
    this.memberHistory = null;

    const params = new HttpParams().set('trackedUserId', trackedUserId);

    this.httpClient
      .get<{ history: InactivityMemberHistoryDto }>(`${this.getBaseUrl()}/reports/inactivity/history`, { params })
      .subscribe({
        next: (response) => {
          this.memberHistory = response.history;
          this.historyLoading = false;
        },
        error: (error) => {
          this.historyLoading = false;
          this.errorMessage = error.error?.error ?? 'Não foi possível carregar o histórico do colaborador.';
        },
      });
  }

  /**
   * Limpa seleção e painel de histórico.
   */
  closeHistoryPanel(): void {
    this.clearHistorySelection();
  }

  /**
   * Limpa seleção e painel de histórico.
   */
  private clearHistorySelection(): void {
    this.selectedTrackedUserId = null;
    this.memberHistory = null;
  }

  /**
   * Dispara exportação de CSV de inatividade.
   */
  onExportInactivityCsv(): void {
    this.exportCsv('/export/inactivity', 'inatividade-semanal.csv');
  }

  /**
   * Dispara exportação de CSV de colaboração.
   */
  onExportCollaborationCsv(): void {
    this.exportCsv('/export/csv', 'resumo-colaboracao.csv');
  }

  /**
   * Retorna o rótulo amigável para um status técnico do relatório.
   * @param status Status técnico retornado pela API
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
   * Classe CSS do badge de severidade por status de inatividade.
   * @param status Status técnico retornado pela API
   */
  getStatusBadgeClass(status: InactivityStatus): string {
    switch (status) {
      case 'missing':
        return 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300';
      case 'low_voice_collaboration':
        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300';
      case 'returned':
        return 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300';
      case 'on_planned_absence':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300';
    }
  }

  /**
   * Exporta CSV de uma rota específica e inicia download no navegador.
   * @param route Sufixo da rota de export dentro de `/guilds/:guildId`
   * @param fallbackFilename Nome padrão caso o header não informe filename
   */
  private exportCsv(route: string, fallbackFilename: string): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord antes de exportar.';
      return;
    }

    this.exporting = true;
    this.errorMessage = '';

    let params = this.dateRange ? toReportDateHttpParams(this.dateRange) : new HttpParams();
    if (this.selectedCategoryId) {
      params = params.set('categoryId', this.selectedCategoryId);
    }

    this.httpClient
      .post(`${this.getBaseUrl()}${route}`, {}, { observe: 'response', responseType: 'blob', params })
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
   * @param response Resposta HTTP contendo CSV em blob
   * @param fallbackFilename Nome padrão quando header não possui arquivo
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
   * @param contentDisposition Header bruto da resposta HTTP
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
