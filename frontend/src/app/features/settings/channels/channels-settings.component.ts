import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Regras de classificação de canais retornadas pela API. */
interface ChannelRuleSet {
  ignored: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  afk: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  lunch: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  productiveText: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  ignoredText: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
}

/**
 * Tela de configuração de canais colaborativos (voz e texto) por guild.
 */
@Component({
  selector: 'app-channels-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channels-settings.component.html',
})
export class ChannelsSettingsComponent implements OnInit {
  orgId = '';
  guildId = '';
  loading = false;
  errorMessage = '';
  rulesJson = '';

  constructor(private readonly http: HttpClient) {}

  /**
   * Carrega org/guild do storage local e busca regras atuais.
   */
  ngOnInit(): void {
    this.orgId = localStorage.getItem('syntra.orgId') ?? '';
    this.guildId = localStorage.getItem('syntra.guildId') ?? '';
    if (this.orgId && this.guildId) {
      this.refreshRules();
    }
  }

  /**
   * Busca regras de canais na API multitenant.
   */
  refreshRules(): void {
    this.loading = true;
    this.errorMessage = '';
    this.http
      .get<{ rules: ChannelRuleSet }>(
        `/api/v1/org/${this.orgId}/guilds/${this.guildId}/channels`,
      )
      .subscribe({
        next: (response) => {
          this.rulesJson = JSON.stringify(response.rules, null, 2);
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Não foi possível carregar as regras de canais.';
          this.loading = false;
        },
      });
  }

  /**
   * Persiste regras editadas no JSON.
   */
  saveRules(): void {
    try {
      const rules = JSON.parse(this.rulesJson) as ChannelRuleSet;
      this.loading = true;
      this.http
        .put(`/api/v1/org/${this.orgId}/guilds/${this.guildId}/channels`, { rules })
        .subscribe({
          next: () => {
            this.loading = false;
          },
          error: () => {
            this.errorMessage = 'Falha ao salvar regras de canais.';
            this.loading = false;
          },
        });
    } catch {
      this.errorMessage = 'JSON inválido. Verifique o formato das regras.';
    }
  }
}
