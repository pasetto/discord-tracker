import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/**
 * Configurações de inatividade por guild retornadas pela API.
 */
interface InactivitySettingsDto {
  guildId: string;
  inactiveAfterBusinessDays: number;
  zeroVoiceCollaborationDays: number;
  lateStartThresholdPercent: number;
  minCollaborationPercentOfElapsed: number;
  notifyManagerPush: boolean;
  notifyManagerEmail: boolean;
  notifyIntradayPush?: boolean;
  updatedAt?: string;
}

/**
 * Tela de configuração de limiares de inatividade (semanal + intradiário).
 */
@Component({
  selector: 'app-inactivity-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inactivity-settings.component.html',
})
export class InactivitySettingsComponent implements OnInit {
  settings: InactivitySettingsDto | null = null;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Indica se há servidor Discord selecionado.
   */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /**
   * Nome do servidor monitorado.
   */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /**
   * Carrega settings quando o tenant estiver pronto.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadSettings();
      }
    });
  }

  /**
   * Busca configurações de inatividade da guild.
   */
  loadSettings(): void {
    if (!this.hasGuild) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.httpClient
      .get<{ settings: InactivitySettingsDto }>(`${this.tenantContext.getGuildApiBaseUrl()}/inactivity-settings`)
      .subscribe({
        next: (response) => {
          this.settings = response.settings;
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = error.error?.error ?? 'Não foi possível carregar as configurações de inatividade.';
          this.loading = false;
        },
      });
  }

  /**
   * Persiste alterações de limiares na API.
   */
  saveSettings(): void {
    if (!this.hasGuild || !this.settings) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.httpClient
      .put<{ settings: InactivitySettingsDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/inactivity-settings`,
        {
          inactiveAfterBusinessDays: this.settings.inactiveAfterBusinessDays,
          zeroVoiceCollaborationDays: this.settings.zeroVoiceCollaborationDays,
          lateStartThresholdPercent: this.settings.lateStartThresholdPercent,
          minCollaborationPercentOfElapsed: this.settings.minCollaborationPercentOfElapsed,
          notifyManagerPush: this.settings.notifyManagerPush,
          notifyManagerEmail: this.settings.notifyManagerEmail,
          notifyIntradayPush: this.settings.notifyIntradayPush ?? true,
        },
      )
      .subscribe({
        next: (response) => {
          this.settings = response.settings;
          this.saving = false;
          this.successMessage = 'Configurações salvas com sucesso.';
        },
        error: (error) => {
          this.errorMessage = error.error?.error ?? 'Falha ao salvar configurações de inatividade.';
          this.saving = false;
        },
      });
  }
}
