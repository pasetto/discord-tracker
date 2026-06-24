import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/** Badge conquistado. */
interface GamificationBadgeDto {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** Membro com insights de gamificação. */
interface MemberInsightsDto {
  discordId: string;
  displayName: string;
  badgesEnabled: boolean;
  streaksEnabled: boolean;
  badges: GamificationBadgeDto[];
  streak: {
    enabled: boolean;
    currentDays: number;
    minHoursPerDay: number;
  };
}

/** Relatório de conquistas da guild. */
interface GuildInsightsDto {
  available: boolean;
  reason?: string;
  presetPack: string;
  generatedAt: string;
  members: MemberInsightsDto[];
}

/**
 * Relatório de badges e streaks do time (gestores e viewers).
 */
@Component({
  selector: 'app-achievements-report',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './achievements-report.component.html',
})
export class AchievementsReportComponent implements OnInit {
  insights: GuildInsightsDto | null = null;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Indica se há servidor selecionado. */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /** Nome do servidor. */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /** Membros com pelo menos um badge ou streak > 0. */
  get activeMembers(): MemberInsightsDto[] {
    if (!this.insights?.members) {
      return [];
    }
    return this.insights.members.filter(
      (member) => member.badges.length > 0 || (member.streaksEnabled && member.streak.currentDays > 0),
    );
  }

  /** Carrega relatório ao iniciar. */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadInsights();
      }
    });
  }

  /** Busca insights da guild. */
  loadInsights(): void {
    if (!this.hasGuild) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient
      .get<{ insights: GuildInsightsDto }>(`${this.tenantContext.getGuildApiBaseUrl()}/gamification/insights`)
      .subscribe({
        next: ({ insights }) => {
          this.insights = insights;
          this.loading = false;
        },
        error: (error: { error?: { error?: string } }) => {
          this.errorMessage = error.error?.error ?? 'Não foi possível carregar conquistas.';
          this.loading = false;
        },
      });
  }
}
