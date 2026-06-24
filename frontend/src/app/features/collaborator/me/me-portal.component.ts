import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { TrackedMemberOption, TrackedMembersService } from '../../../core/members/tracked-members.service';
import { MemberSelectComponent } from '../../../shared/components/member-select/member-select.component';
import { MeAbsenceSummary, MeCollaborationSummary, MeDataService, MeGamificationInsights } from './me-data.service';

/**
 * Item de transparência LGPD sobre quais sinais são monitorados.
 */
interface MeasurementTransparencyItem {
  title: string;
  details: string;
}

/**
 * Estado de carregamento de um painel de dados do portal.
 */
interface MeDataPanelState {
  loading: boolean;
  errorMessage: string;
  collaboration: MeCollaborationSummary | null;
  absences: MeAbsenceSummary[] | null;
  gamification: MeGamificationInsights | null;
  exportPreview: Record<string, unknown> | null;
}

/**
 * Portal do colaborador para transparência e acesso aos dados próprios em `/me`.
 */
@Component({
  selector: 'app-me-portal',
  standalone: true,
  imports: [CommonModule, MemberSelectComponent],
  templateUrl: './me-portal.component.html',
})
export class MePortalComponent implements OnInit {
  /**
   * Lista de sinais monitorados pela plataforma sem conteúdo sensível.
   */
  readonly measuredSignals: MeasurementTransparencyItem[] = [
    {
      title: 'Sinais de voz',
      details: 'Tempo agregado de colaboração em voz por sessão/canal (sem gravação de áudio).',
    },
    {
      title: 'Sinais de presença',
      details: 'Status e duração de presença (online/idle/dnd/offline) para cálculo de colaboração.',
    },
    {
      title: 'Texto (metadados)',
      details: 'Eventos de mensagem/reação por canal e horário, sem conteúdo textual armazenado.',
    },
  ];

  panel: MeDataPanelState = {
    loading: false,
    errorMessage: '',
    collaboration: null,
    absences: null,
    gamification: null,
    exportPreview: null,
  };

  members: TrackedMemberOption[] = [];
  selectedMember: TrackedMemberOption | null = null;
  linkLoading = false;
  linkMessage = '';
  showDiscordLink = false;

  constructor(
    private readonly meDataService: MeDataService,
    private readonly trackedMembersService: TrackedMembersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Carrega membros rastreados para vincular perfil Discord quando necessário.
   */
  ngOnInit(): void {
    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: () => {
        this.members = [];
      },
    });
  }

  /**
   * Atualiza membro selecionado para vínculo Discord.
   * @param member Membro rastreado escolhido
   */
  onMemberSelected(member: TrackedMemberOption | null): void {
    this.selectedMember = member;
    this.linkMessage = '';
  }

  /**
   * Vincula o usuário da plataforma ao perfil Discord selecionado.
   */
  linkDiscordProfile(): void {
    if (!this.selectedMember?.discordId) {
      this.linkMessage = 'Selecione seu perfil Discord na lista.';
      return;
    }

    this.linkLoading = true;
    this.linkMessage = '';

    this.meDataService.linkDiscordProfile(this.selectedMember.discordId).subscribe({
      next: (response) => {
        this.authService.saveToken(response.accessToken);
        this.linkLoading = false;
        this.showDiscordLink = false;
        this.linkMessage = `Perfil vinculado com sucesso: ${response.displayName}.`;
        this.panel.errorMessage = '';
      },
      error: (error) => {
        this.linkLoading = false;
        this.linkMessage = this.resolveErrorMessage(error);
      },
    });
  }

  /**
   * Carrega resumo de colaboração e exibe na interface.
   * @returns {void} Não retorna valor
   */
  loadCollaboration(): void {
    this.panel.loading = true;
    this.panel.errorMessage = '';

    this.meDataService.loadCollaborationSummary().subscribe({
      next: (response) => {
        this.panel.collaboration = response.summary;
        this.panel.loading = false;
      },
      error: (error) => {
        this.panel.loading = false;
        this.panel.errorMessage = this.resolveErrorMessage(error);
        if (error.status === 422) {
          this.showDiscordLink = true;
        }
      },
    });
  }

  /**
   * Carrega badges e streak do colaborador.
   */
  loadGamification(): void {
    this.panel.loading = true;
    this.panel.errorMessage = '';

    this.meDataService.loadGamification().subscribe({
      next: (response) => {
        this.panel.gamification = response.insights;
        this.panel.loading = false;
      },
      error: (error) => {
        this.panel.loading = false;
        this.panel.errorMessage = this.resolveErrorMessage(error);
        if (error.status === 422) {
          this.showDiscordLink = true;
        }
      },
    });
  }

  /**
   * Carrega ausências planejadas do colaborador autenticado.
   * @returns {void} Não retorna valor
   */
  loadAbsences(): void {
    this.panel.loading = true;
    this.panel.errorMessage = '';

    this.meDataService.loadAbsences().subscribe({
      next: (response) => {
        this.panel.absences = response.absences;
        this.panel.loading = false;
      },
      error: (error) => {
        this.panel.loading = false;
        this.panel.errorMessage = this.resolveErrorMessage(error);
        if (error.status === 422) {
          this.showDiscordLink = true;
        }
      },
    });
  }

  /**
   * Baixa export LGPD em JSON para o dispositivo do colaborador.
   * @returns {void} Não retorna valor
   */
  downloadDataExport(): void {
    this.panel.loading = true;
    this.panel.errorMessage = '';

    this.meDataService.loadDataExport().subscribe({
      next: (response) => {
        this.panel.exportPreview = response.exportData;
        this.triggerJsonDownload(response.exportData, `syntra-meus-dados-${new Date().toISOString().slice(0, 10)}.json`);
        this.panel.loading = false;
      },
      error: (error) => {
        this.panel.loading = false;
        this.panel.errorMessage = this.resolveErrorMessage(error);
        if (error.status === 422) {
          this.showDiscordLink = true;
        }
      },
    });
  }

  /**
   * Formata data ISO para exibição amigável.
   * @param value Data em string ISO ou null
   * @returns Texto formatado ou traço quando ausente
   */
  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('pt-BR');
  }

  /**
   * Traduz mensagens técnicas da API para orientação de uso.
   * @param error Erro retornado pelo HttpClient
   * @returns Mensagem amigável para o colaborador
   */
  private resolveErrorMessage(error: { error?: { error?: string }; status?: number }): string {
    const apiMessage = error.error?.error ?? '';

    if (apiMessage.includes('discordId') || apiMessage.includes('Usuário autenticado inválido') || error.status === 422) {
      return 'Sua conta ainda não está vinculada a um perfil Discord rastreado. Selecione seu nome abaixo ou peça ao gestor para sincronizar os membros.';
    }

    if (error.status === 403) {
      return 'Você não tem permissão para acessar estes dados nesta organização.';
    }

    return apiMessage || 'Não foi possível carregar seus dados agora. Tente novamente em instantes.';
  }

  /**
   * Dispara download de arquivo JSON no navegador.
   * @param payload Dados exportados
   * @param filename Nome do arquivo gerado
   * @returns {void} Não retorna valor
   */
  private triggerJsonDownload(payload: Record<string, unknown>, filename: string): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
