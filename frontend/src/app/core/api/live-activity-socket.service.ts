import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

/** Membro ativo retornado pelo snapshot ao vivo. */
export interface LiveMemberSnapshot {
  discordId: string;
  displayName: string;
  avatarUrl?: string;
  status: 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' | 'INVISIBLE';
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  onlineSeconds: number;
  onlineSince: string | null;
  collaborationActiveSeconds: number;
  inactiveSeconds: number;
  isCollaborationActive: boolean;
  inIgnoredChannel: boolean;
  voiceSessionType: 'VOICE' | 'AFK' | 'LUNCH' | null;
  channelsVisitedToday: string[];
}

/** Evento de transição de canal de voz. */
export interface LiveVoiceTransitionEvent {
  organizationId: string;
  guildId: string;
  discordId: string;
  displayName: string;
  avatarUrl?: string;
  eventType: string;
  fromChannelName?: string;
  toChannelName?: string;
  fromIgnored: boolean;
  toIgnored: boolean;
  countsAsCollaboration: boolean;
  occurredAt: string;
}

/** Snapshot em tempo real do dashboard. */
export interface DashboardLiveSnapshot {
  generatedAt: string;
  dayDate: string;
  timezone: string;
  guildId: string;
  guildName: string;
  activeCount: number;
  activeMembers: LiveMemberSnapshot[];
  onlineRanking: LiveMemberSnapshot[];
  recentTransitions: LiveVoiceTransitionEvent[];
}

/** Mensagens recebidas do WebSocket de atividade ao vivo. */
type LiveActivityServerMessage =
  | { type: 'connected' }
  | { type: 'awaiting_auth' }
  | { type: 'subscribed'; organizationId: string; guildId: string }
  | { type: 'snapshot'; data: DashboardLiveSnapshot }
  | { type: 'transition'; data: LiveVoiceTransitionEvent }
  | { type: 'error'; message: string }
  | { type: 'pong' };

/** Máximo de segundos em um único dia civil (defesa contra snapshots legados/incorretos). */
const MAX_DAILY_SECONDS = 24 * 60 * 60;

/**
 * Valida se o snapshot respeita o dia civil (rejeita respostas de workers legados no cluster).
 * @param snapshot Snapshot recebido via WebSocket
 * @returns true quando o payload é confiável para exibição
 */
export function isValidLiveDashboardSnapshot(snapshot: DashboardLiveSnapshot | null | undefined): boolean {
  if (!snapshot?.dayDate?.trim() || !snapshot.timezone?.trim()) {
    return false;
  }

  const members = [...(snapshot.activeMembers ?? []), ...(snapshot.onlineRanking ?? [])];
  for (const member of members) {
    if (
      member.onlineSeconds > MAX_DAILY_SECONDS ||
      member.collaborationActiveSeconds > MAX_DAILY_SECONDS ||
      member.inactiveSeconds > MAX_DAILY_SECONDS
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Conecta ao WebSocket de atividade ao vivo e expõe snapshots e transições.
 */
@Injectable({ providedIn: 'root' })
export class LiveActivitySocketService implements OnDestroy {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionEpoch = 0;
  private readonly snapshotSubject = new Subject<DashboardLiveSnapshot>();
  private readonly transitionSubject = new Subject<LiveVoiceTransitionEvent>();
  private readonly errorSubject = new Subject<string>();
  private readonly connectedSubject = new Subject<boolean>();
  private currentOrgId = '';
  private currentGuildId = '';
  private currentToken = '';

  /** Emite snapshots completos recebidos em tempo real. */
  readonly snapshot$ = this.snapshotSubject.asObservable();

  /** Emite cada transição de entrada/saída/troca de canal. */
  readonly transition$ = this.transitionSubject.asObservable();

  /** Emite erros de conexão ou mensagens de erro do servidor. */
  readonly error$ = this.errorSubject.asObservable();

  /** Emite true quando conectado e inscrito no guild. */
  readonly connected$ = this.connectedSubject.asObservable();

  constructor(private readonly ngZone: NgZone) {}

  /**
   * Conecta e assina atualizações do guild monitorado.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param token JWT de acesso
   */
  connect(organizationId: string, guildId: string, token: string): void {
    this.clearReconnectTimer();
    const epoch = ++this.connectionEpoch;
    this.teardownSocket(this.socket);
    this.socket = null;

    this.currentOrgId = organizationId;
    this.currentGuildId = guildId;
    this.currentToken = token;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/v1/ws/live`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      if (epoch !== this.connectionEpoch) {
        return;
      }
      socket.send(JSON.stringify({ type: 'auth', token: this.currentToken }));
    };

    socket.onmessage = (event) => {
      this.ngZone.run(() => {
        if (epoch !== this.connectionEpoch) {
          return;
        }
        this.handleMessage(event.data as string);
      });
    };

    socket.onerror = () => {
      this.ngZone.run(() => {
        if (epoch !== this.connectionEpoch) {
          return;
        }
        this.errorSubject.next('Falha na conexão em tempo real.');
        this.connectedSubject.next(false);
      });
    };

    socket.onclose = () => {
      this.ngZone.run(() => {
        if (epoch !== this.connectionEpoch) {
          return;
        }
        this.connectedSubject.next(false);
        this.scheduleReconnect();
      });
    };
  }

  /**
   * Encerra conexão WebSocket e cancela reconexão.
   * @param clearContext Limpa org/guild/token quando true
   */
  disconnect(clearContext = true): void {
    this.connectionEpoch += 1;
    this.clearReconnectTimer();
    this.teardownSocket(this.socket);
    this.socket = null;

    if (clearContext) {
      this.currentOrgId = '';
      this.currentGuildId = '';
      this.currentToken = '';
    }

    this.connectedSubject.next(false);
  }

  /**
   * Libera recursos ao destruir o serviço.
   */
  ngOnDestroy(): void {
    this.disconnect();
    this.snapshotSubject.complete();
    this.transitionSubject.complete();
    this.errorSubject.complete();
    this.connectedSubject.complete();
  }

  /**
   * Remove listeners e fecha socket sem disparar reconexão automática.
   * @param socket Conexão WebSocket ativa ou encerrada
   */
  private teardownSocket(socket: WebSocket | null): void {
    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }

  /**
   * Cancela timer de reconexão automática pendente.
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Envia mensagem de subscribe para o backend.
   */
  private sendSubscribe(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: 'subscribe',
        organizationId: this.currentOrgId,
        guildId: this.currentGuildId,
      }),
    );
  }

  /**
   * Processa mensagem JSON recebida do servidor.
   * @param raw Payload bruto
   */
  private handleMessage(raw: string): void {
    let message: LiveActivityServerMessage;
    try {
      message = JSON.parse(raw) as LiveActivityServerMessage;
    } catch {
      this.errorSubject.next('Resposta inválida do servidor em tempo real.');
      return;
    }

    switch (message.type) {
      case 'connected':
      case 'awaiting_auth':
        this.sendSubscribe();
        break;
      case 'subscribed':
        this.connectedSubject.next(true);
        this.errorSubject.next('');
        break;
      case 'snapshot':
        if (!isValidLiveDashboardSnapshot(message.data)) {
          return;
        }
        this.snapshotSubject.next(message.data);
        break;
      case 'transition':
        this.transitionSubject.next(message.data);
        break;
      case 'error':
        this.errorSubject.next(message.message);
        break;
      default:
        break;
    }
  }

  /**
   * Agenda reconexão automática após desconexão.
   */
  private scheduleReconnect(): void {
    if (!this.currentOrgId || !this.currentGuildId || !this.currentToken) {
      return;
    }

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.currentOrgId, this.currentGuildId, this.currentToken);
    }, 5_000);
  }
}
