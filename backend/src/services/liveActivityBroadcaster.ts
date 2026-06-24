import type { VoiceEventType } from '../config/env';
import type { DashboardLiveSnapshot } from './dashboardLiveService';

/** Evento de transição de voz enviado em tempo real. */
export interface LiveVoiceTransitionEvent {
  organizationId: string;
  guildId: string;
  discordId: string;
  displayName: string;
  eventType: VoiceEventType;
  fromChannelName?: string;
  toChannelName?: string;
  fromIgnored: boolean;
  toIgnored: boolean;
  countsAsCollaboration: boolean;
  occurredAt: string;
}

/** Mensagens enviadas pelo WebSocket de atividade ao vivo. */
export type LiveActivityServerMessage =
  | { type: 'connected' }
  | { type: 'awaiting_auth' }
  | { type: 'subscribed'; organizationId: string; guildId: string }
  | { type: 'snapshot'; data: DashboardLiveSnapshot }
  | { type: 'transition'; data: LiveVoiceTransitionEvent }
  | { type: 'error'; message: string };

/** Mensagens recebidas do cliente WebSocket. */
export type LiveActivityClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'subscribe'; organizationId: string; guildId: string }
  | { type: 'ping' };

/**
 * Publica atualizações de atividade ao vivo para assinantes WebSocket.
 */
export class LiveActivityBroadcaster {
  private readonly subscribers = new Map<string, Set<(message: LiveActivityServerMessage) => void>>();

  /**
   * Monta chave de assinatura org/guild.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @returns Chave única de canal
   */
  private buildKey(organizationId: string, guildId: string): string {
    return `${organizationId}:${guildId}`;
  }

  /**
   * Registra callback de assinatura para um tenant/guild.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param listener Função de envio de mensagem
   * @returns Função para cancelar assinatura
   */
  subscribe(
    organizationId: string,
    guildId: string,
    listener: (message: LiveActivityServerMessage) => void,
  ): () => void {
    const key = this.buildKey(organizationId, guildId);
    const bucket = this.subscribers.get(key) ?? new Set();
    bucket.add(listener);
    this.subscribers.set(key, bucket);

    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) {
        this.subscribers.delete(key);
      }
    };
  }

  /**
   * Envia snapshot completo para assinantes do guild.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param snapshot Snapshot atualizado
   */
  publishSnapshot(organizationId: string, guildId: string, snapshot: DashboardLiveSnapshot): void {
    this.emit(organizationId, guildId, { type: 'snapshot', data: snapshot });
  }

  /**
   * Envia evento de transição de voz para assinantes do guild.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param transition Evento de entrada/saída/troca
   */
  publishTransition(organizationId: string, guildId: string, transition: LiveVoiceTransitionEvent): void {
    this.emit(organizationId, guildId, { type: 'transition', data: transition });
  }

  /**
   * Dispara mensagem para todos os listeners de um guild.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param message Payload WebSocket
   */
  private emit(organizationId: string, guildId: string, message: LiveActivityServerMessage): void {
    const key = this.buildKey(organizationId, guildId);
    const bucket = this.subscribers.get(key);
    if (!bucket) {
      return;
    }

    for (const listener of bucket) {
      listener(message);
    }
  }
}

/** Instância singleton do broadcaster de atividade ao vivo. */
export const liveActivityBroadcaster = new LiveActivityBroadcaster();

/**
 * Publica snapshot reconstruído após mudança de presença ou voz.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 */
export async function publishLiveGuildSnapshot(organizationId: string, guildId: string): Promise<void> {
  const { getGuildLiveDashboard } = await import('./dashboardLiveService');
  const snapshot = await getGuildLiveDashboard(guildId, organizationId);
  liveActivityBroadcaster.publishSnapshot(organizationId, guildId, snapshot);
}
