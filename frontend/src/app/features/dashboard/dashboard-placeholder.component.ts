import { CommonModule } from '@angular/common';

import { HttpClient } from '@angular/common/http';

import { Component, OnDestroy, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';

import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

import {

  DashboardLiveSnapshot,

  LiveActivitySocketService,

  LiveMemberSnapshot,

  LiveVoiceTransitionEvent,

} from '../../core/api/live-activity-socket.service';

import { TenantContextService } from '../../core/tenant/tenant-context.service';



/** Item de ausência ativa exibido no widget do dashboard. */

interface ActiveAbsenceDto {

  _id: string;

  discordId: string;

  type: 'vacation' | 'pto' | 'sick_leave' | 'other';

  endDate: string;

  note?: string;

}



/**

 * Dashboard com membros ativos, localização e ranking de tempo online em tempo real.

 */

@Component({

  selector: 'app-dashboard-placeholder',

  standalone: true,

  imports: [CommonModule, RouterLink],

  templateUrl: './dashboard-placeholder.component.html',

})

export class DashboardPlaceholderComponent implements OnInit, OnDestroy {

  activeAbsences: ActiveAbsenceDto[] = [];

  activeMembers: LiveMemberSnapshot[] = [];

  onlineRanking: LiveMemberSnapshot[] = [];

  recentTransitions: LiveVoiceTransitionEvent[] = [];

  loading = false;

  liveLoading = false;

  liveConnected = false;

  errorMessage = '';

  lastUpdatedAt: string | null = null;

  private subscriptions = new Subscription();



  constructor(

    private readonly httpClient: HttpClient,

    private readonly authService: AuthService,

    private readonly tenantContext: TenantContextService,

    private readonly liveActivitySocket: LiveActivitySocketService,

  ) {}



  /**

   * Nome do usuário autenticado.

   */

  get displayName(): string {

    return this.authService.getDisplayName();

  }



  /**

   * Nome da organização ativa.

   */

  get organizationName(): string {

    return this.authService.getOrganization()?.name ?? 'Sua organização';

  }



  /**

   * Nome do servidor Discord monitorado.

   */

  get guildName(): string {

    return this.tenantContext.guildName;

  }



  /**

   * Indica se já há servidor selecionado.

   */

  get hasGuild(): boolean {

    return this.tenantContext.hasGuild;

  }



  /**

   * Carrega contexto, WebSocket ao vivo e ausências.

   */

  ngOnInit(): void {

    this.subscriptions.add(

      this.liveActivitySocket.snapshot$.subscribe((snapshot) => {

        this.applySnapshot(snapshot);

        this.liveLoading = false;

      }),

    );

    this.subscriptions.add(

      this.liveActivitySocket.transition$.subscribe((transition) => {

        this.recentTransitions = [transition, ...this.recentTransitions].slice(0, 30);

      }),

    );

    this.subscriptions.add(

      this.liveActivitySocket.error$.subscribe((message) => {

        this.errorMessage = message;

        this.liveLoading = false;

      }),

    );

    this.subscriptions.add(

      this.liveActivitySocket.connected$.subscribe((connected) => {

        this.liveConnected = connected;

      }),

    );



    this.subscriptions.add(

      this.tenantContext.refresh().subscribe(() => {

        if (this.hasGuild) {

          this.loadDashboardData();

        } else {

          this.liveActivitySocket.disconnect();

        }

      }),

    );

  }



  /**

   * Encerra WebSocket e assinaturas ao sair da tela.

   */

  ngOnDestroy(): void {

    this.subscriptions.unsubscribe();

    this.liveActivitySocket.disconnect();

  }



  /**

   * Recarrega conexão WebSocket e ausências.

   */

  loadDashboardData(): void {

    this.connectLiveSocket();

    this.loadActiveAbsences();

  }



  /**

   * Conecta ao WebSocket de atividade ao vivo do guild monitorado.

   */

  connectLiveSocket(): void {

    if (!this.hasGuild) {

      return;

    }



    const token = this.authService.getToken();

    if (!token) {

      this.errorMessage = 'Sessão expirada. Faça login novamente.';

      return;

    }



    this.liveLoading = true;

    this.errorMessage = '';

    this.liveActivitySocket.connect(this.tenantContext.orgId, this.tenantContext.guildId, token);

  }



  /**

   * Consulta ausências ativas do servidor monitorado.

   */

  loadActiveAbsences(): void {

    if (!this.hasGuild) {

      return;

    }



    this.loading = true;



    this.httpClient

      .get<{ absences: ActiveAbsenceDto[] }>(`${this.tenantContext.getGuildApiBaseUrl()}/absences/active`)

      .subscribe({

        next: (response) => {

          this.activeAbsences = response.absences ?? [];

          this.loading = false;

        },

        error: () => {

          this.loading = false;

        },

      });

  }



  /**

   * Aplica snapshot recebido via WebSocket na UI.

   * @param snapshot Dados ao vivo do guild

   */

  private applySnapshot(snapshot: DashboardLiveSnapshot): void {

    this.activeMembers = snapshot.activeMembers ?? [];

    this.onlineRanking = snapshot.onlineRanking ?? [];

    this.recentTransitions = snapshot.recentTransitions ?? [];

    this.lastUpdatedAt = snapshot.generatedAt;

  }



  /**

   * Traduz status de presença para rótulo amigável.

   * @param status Status retornado pela API

   * @returns Rótulo em português

   */

  formatPresenceStatus(status: LiveMemberSnapshot['status']): string {

    const labels: Record<LiveMemberSnapshot['status'], string> = {

      ONLINE: 'Online',

      IDLE: 'Ausente',

      DND: 'Não perturbe',

      OFFLINE: 'Offline',

      INVISIBLE: 'Invisível',

    };

    return labels[status] ?? status;

  }



  /**

   * Classe CSS do badge de status.

   * @param status Status retornado pela API

   * @returns Classe tailwind para cor do badge

   */

  getStatusBadgeClass(status: LiveMemberSnapshot['status']): string {

    switch (status) {

      case 'ONLINE':

        return 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300';

      case 'IDLE':

        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300';

      case 'DND':

        return 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300';

      default:

        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

    }

  }



  /**

   * Descreve onde o membro está (voz ou Discord).

   * @param member Membro ativo

   * @returns Texto de localização

   */

  getLocationLabel(member: LiveMemberSnapshot): string {

    if (member.voiceChannelName) {

      if (member.inIgnoredChannel) {

        return `Canal ignorado: ${member.voiceChannelName}`;

      }

      return `Canal de voz: ${member.voiceChannelName}`;

    }

    return 'No Discord (sem canal de voz)';

  }



  /**

   * Formata segundos em texto legível.

   * @param totalSeconds Duração em segundos

   * @returns Duração formatada

   */

  formatDuration(totalSeconds: number): string {

    if (totalSeconds <= 0) {

      return '—';

    }



    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor((totalSeconds % 3600) / 60);



    if (hours > 0) {

      return `${hours}h ${minutes}min`;

    }

    if (minutes > 0) {

      return `${minutes}min`;

    }

    return `${totalSeconds}s`;

  }



  /**

   * Descreve evento de transição de canal para o feed ao vivo.

   * @param transition Evento recebido via WebSocket

   * @returns Texto legível da movimentação

   */

  formatTransitionLabel(transition: LiveVoiceTransitionEvent): string {

    switch (transition.eventType) {

      case 'JOIN':

      case 'RECONNECT':

        return `entrou em ${transition.toChannelName ?? 'canal'}`;

      case 'LEAVE':

      case 'DISCONNECT':

        return `saiu de ${transition.fromChannelName ?? 'canal'}`;

      case 'SWITCH':

      case 'MOVED':

      case 'AFK_AUTO':

        return `trocou de ${transition.fromChannelName ?? '?'} → ${transition.toChannelName ?? '?'}`;

      default:

        return transition.eventType;

    }

  }



  /**

   * Traduz tipo técnico de ausência para rótulo amigável.

   * @param type Tipo retornado pela API

   * @returns Rótulo em português

   */

  formatType(type: 'vacation' | 'pto' | 'sick_leave' | 'other'): string {

    const labels = {

      vacation: 'Férias',

      pto: 'PTO',

      sick_leave: 'Licença médica',

      other: 'Outro',

    } as const;

    return labels[type];

  }

}

