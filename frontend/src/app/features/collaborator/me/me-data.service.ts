import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Resumo de colaboração retornado por `/api/v1/me/collaboration`.
 */
export interface MeCollaborationSummary {
  organizationId: string;
  discordId: string;
  trackedProfilesCount: number;
  guildIds: string[];
  lastPresenceAt: string | null;
  lastTextMetadataAt: string | null;
  signals: {
    voiceSessions: {
      totalCollaborationSeconds: number;
      totalCollaborationHours: number;
    };
    presence: {
      totalTrackedSeconds: number;
      totalTrackedHours: number;
    };
    text: {
      totalMetadataEvents: number;
      contentStored: boolean;
    };
  };
}

/**
 * Ausência planejada do colaborador autenticado.
 */
export interface MeAbsenceSummary {
  id: string;
  guildId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  note?: string;
}

/**
 * Badge conquistado pelo colaborador.
 */
export interface MeGamificationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedInPeriod: string;
}

/**
 * Streak do colaborador no portal /me.
 */
export interface MeGamificationStreak {
  enabled: boolean;
  currentDays: number;
  minHoursPerDay: number;
  lastQualifiedDate: string | null;
}

/**
 * Insights de gamificação do colaborador autenticado.
 */
export interface MeGamificationInsights {
  discordId: string;
  displayName: string;
  badgesEnabled: boolean;
  streaksEnabled: boolean;
  badges: MeGamificationBadge[];
  streak: MeGamificationStreak;
}

/**
 * Serviço de autoatendimento do portal colaborador (`/me`).
 */
@Injectable({ providedIn: 'root' })
export class MeDataService {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega resumo consolidado de sinais de colaboração do usuário autenticado.
   * @returns Observable com resumo de voz, presença e metadados de texto
   */
  loadCollaborationSummary(): Observable<{ summary: MeCollaborationSummary }> {
    return this.httpClient.get<{ summary: MeCollaborationSummary }>('/api/v1/me/collaboration');
  }

  /**
   * Lista ausências planejadas vinculadas ao perfil rastreado do colaborador.
   * @returns Observable com ausências do titular
   */
  loadAbsences(): Observable<{ absences: MeAbsenceSummary[] }> {
    return this.httpClient.get<{ absences: MeAbsenceSummary[] }>('/api/v1/me/absences');
  }

  /**
   * Baixa export LGPD em JSON dos dados rastreados do colaborador.
   * @returns Observable com payload completo de exportação
   */
  loadDataExport(): Observable<{ exportData: Record<string, unknown> }> {
    return this.httpClient.get<{ exportData: Record<string, unknown> }>('/api/v1/me/data-export');
  }

  /**
   * Carrega badges e streak do colaborador autenticado.
   * @param guildId Servidor Discord (opcional)
   * @returns Observable com conquistas e streak
   */
  loadGamification(guildId?: string): Observable<{ insights: MeGamificationInsights }> {
    const params = guildId ? `?guildId=${encodeURIComponent(guildId)}` : '';
    return this.httpClient.get<{ insights: MeGamificationInsights }>(`/api/v1/me/gamification${params}`);
  }

  /**
   * Vincula o usuário autenticado a um perfil Discord rastreado na organização.
   * @param discordId Identificador Discord do membro sincronizado
   * @returns Observable com novo access token e dados do perfil vinculado
   */
  linkDiscordProfile(discordId: string): Observable<{ accessToken: string; discordId: string; displayName: string }> {
    return this.httpClient.put<{ accessToken: string; discordId: string; displayName: string }>(
      '/api/v1/me/discord-link',
      { discordId },
    );
  }
}
