import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Estado mínimo de toggles de gamificação usados na tela.
 */
interface GamificationToggleState {
  enabled: boolean;
  rankingEnabled: boolean;
  badgesEnabled: boolean;
  streaksEnabled: boolean;
}

/**
 * Features relevantes do plano para a seção de gamificação.
 */
interface GamificationPlanFeaturesDto {
  gamification: boolean;
  ranking: boolean;
}

/**
 * Shape de resposta do endpoint de gamificação.
 */
interface GamificationSettingsResponseDto {
  settings: {
    enabled: boolean;
    ranking: { enabled: boolean };
    badges: { enabled: boolean };
    streaks: { enabled: boolean };
  };
  planFeatures: GamificationPlanFeaturesDto;
}

/**
 * Tela de configuração de gamificação por guild.
 */
@Component({
  selector: 'app-gamification-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './gamification-settings.component.html',
})
export class GamificationSettingsComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  guildId = localStorage.getItem('syntra.guildId') ?? '';
  toggles: GamificationToggleState = {
    enabled: false,
    rankingEnabled: false,
    badgesEnabled: false,
    streaksEnabled: false,
  };
  planFeatures: GamificationPlanFeaturesDto = {
    gamification: true,
    ranking: true,
  };
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega configuração atual ao abrir a tela.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    if (this.orgId && this.guildId) {
      this.loadSettings();
    }
  }

  /**
   * Busca settings atuais no backend e atualiza os toggles locais.
   * @returns {void} Não retorna valor.
   */
  loadSettings(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId para carregar as configurações.';
      return;
    }

    localStorage.setItem('syntra.orgId', this.orgId);
    localStorage.setItem('syntra.guildId', this.guildId);
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient.get<GamificationSettingsResponseDto>(this.getBaseUrl()).subscribe({
      next: (response) => {
        this.planFeatures = response.planFeatures;
        this.toggles = {
          enabled: response.settings.enabled,
          rankingEnabled: response.settings.ranking.enabled,
          badgesEnabled: response.settings.badges.enabled,
          streaksEnabled: response.settings.streaks.enabled,
        };
        if (!this.planFeatures.ranking) {
          this.toggles.rankingEnabled = false;
        }
        this.loading = false;
      },
      error: (error: { error?: { error?: string } }) => {
        this.errorMessage = error.error?.error ?? 'Não foi possível carregar as configurações de gamificação.';
        this.loading = false;
      },
    });
  }

  /**
   * Persiste os toggles da tela no backend.
   * @returns {void} Não retorna valor.
   */
  saveSettings(): void {
    if (!this.orgId || !this.guildId) {
      this.errorMessage = 'Preencha organizationId e guildId antes de salvar.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .put<GamificationSettingsResponseDto>(this.getBaseUrl(), {
        enabled: this.toggles.enabled,
        ranking: { enabled: this.toggles.rankingEnabled },
        badges: { enabled: this.toggles.badgesEnabled },
        streaks: { enabled: this.toggles.streaksEnabled },
      })
      .subscribe({
        next: (response) => {
          this.planFeatures = response.planFeatures;
          this.successMessage = 'Configuração de gamificação salva com sucesso.';
          this.saving = false;
        },
        error: (error: { error?: { error?: string } }) => {
          this.errorMessage = error.error?.error ?? 'Não foi possível salvar as configurações de gamificação.';
          this.saving = false;
        },
      });
  }

  /**
   * Verifica se toggle de ranking deve ficar bloqueado pelo plano.
   * @returns {boolean} `true` quando ranking não está habilitado no plano.
   */
  isRankingLockedByPlan(): boolean {
    return !this.planFeatures.ranking;
  }

  /**
   * Monta URL base dos endpoints de gamificação no backend.
   * @returns {string} URL base para requisições da feature.
   */
  private getBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}/gamification`;
  }
}
