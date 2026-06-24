import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/** Canal retornado pela API do Discord. */
interface DiscordGuildChannelOption {
  channelId: string;
  channelName: string;
  channelType: 'voice' | 'text';
  parentName?: string;
}

/** Regras de classificação de canais retornadas pela API. */
interface ChannelRuleSet {
  ignored: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  afk: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  lunch: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  productiveVoice: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  productiveText: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
  ignoredText: Array<{ channelId: string; channelName: string; channelType: 'voice' | 'text' }>;
}

/** Estado de seleção por canal na UI. */
interface ChannelSelectionState {
  ignored: boolean;
  afk: boolean;
  lunch: boolean;
  productiveVoice: boolean;
  ignoredText: boolean;
  productiveText: boolean;
}

/**
 * Tela de configuração de canais colaborativos com checkboxes por canal.
 */
@Component({
  selector: 'app-channels-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './channels-settings.component.html',
})
export class ChannelsSettingsComponent implements OnInit {
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  voiceChannels: DiscordGuildChannelOption[] = [];
  textChannels: DiscordGuildChannelOption[] = [];
  selections: Record<string, ChannelSelectionState> = {};

  constructor(
    private readonly http: HttpClient,
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
   * Carrega canais e regras quando o tenant já tem servidor.
   */
  ngOnInit(): void {
    this.tenantContext.refresh().subscribe(() => {
      if (this.hasGuild) {
        this.loadChannelData();
      }
    });
  }

  /**
   * Busca canais do Discord e regras salvas, sincronizando checkboxes.
   */
  loadChannelData(): void {
    if (!this.hasGuild) {
      this.errorMessage = 'Configure o Discord e selecione um servidor antes de editar canais.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const baseUrl = this.tenantContext.getGuildApiBaseUrl();

    forkJoin({
      channels: this.http.get<{ channels: DiscordGuildChannelOption[] }>(`${baseUrl}/channels/discord`),
      rules: this.http.get<{ rules: ChannelRuleSet }>(`${baseUrl}/channels`),
    }).subscribe({
      next: ({ channels, rules }) => {
        this.voiceChannels = channels.channels.filter((channel) => channel.channelType === 'voice');
        this.textChannels = channels.channels.filter((channel) => channel.channelType === 'text');
        this.applyRulesToSelections(rules.rules);
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Não foi possível carregar os canais do servidor.';
        this.loading = false;
      },
    });
  }

  /**
   * Persiste regras montadas a partir dos checkboxes.
   */
  saveRules(): void {
    if (!this.hasGuild) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http
      .put(`${this.tenantContext.getGuildApiBaseUrl()}/channels`, { rules: this.buildRulesFromSelections() })
      .subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Regras de canais salvas com sucesso.';
        },
        error: () => {
          this.errorMessage = 'Falha ao salvar regras de canais.';
          this.saving = false;
        },
      });
  }

  /**
   * Retorna estado de seleção de um canal, criando padrão quando ausente.
   * @param channelId ID do canal Discord
   * @returns Estado atual dos checkboxes
   */
  getSelection(channelId: string): ChannelSelectionState {
    if (!this.selections[channelId]) {
      this.selections[channelId] = this.createEmptySelection();
    }
    return this.selections[channelId];
  }

  /**
   * Alterna categoria de um canal de voz.
   * @param channel Canal de voz
   * @param field Campo da regra
   * @param checked Novo valor do checkbox
   */
  toggleVoice(channel: DiscordGuildChannelOption, field: keyof ChannelSelectionState, checked: boolean): void {
    const selection = this.getSelection(channel.channelId);
    selection[field] = checked;
  }

  /**
   * Alterna categoria de um canal de texto.
   * @param channel Canal de texto
   * @param field Campo da regra
   * @param checked Novo valor do checkbox
   */
  toggleText(channel: DiscordGuildChannelOption, field: 'ignoredText' | 'productiveText', checked: boolean): void {
    const selection = this.getSelection(channel.channelId);
    selection[field] = checked;
  }

  /**
   * Monta payload de regras a partir dos checkboxes marcados.
   * @returns Conjunto de regras para a API
   */
  private buildRulesFromSelections(): ChannelRuleSet {
    const rules: ChannelRuleSet = {
      ignored: [],
      afk: [],
      lunch: [],
      productiveVoice: [],
      productiveText: [],
      ignoredText: [],
    };

    for (const channel of this.voiceChannels) {
      const selection = this.getSelection(channel.channelId);
      if (selection.ignored) {
        rules.ignored.push(this.toSelection(channel));
      }
      if (selection.afk) {
        rules.afk.push(this.toSelection(channel));
      }
      if (selection.lunch) {
        rules.lunch.push(this.toSelection(channel));
      }
      if (selection.productiveVoice) {
        rules.productiveVoice.push(this.toSelection(channel));
      }
    }

    for (const channel of this.textChannels) {
      const selection = this.getSelection(channel.channelId);
      if (selection.ignoredText) {
        rules.ignoredText.push(this.toSelection(channel));
      }
      if (selection.productiveText) {
        rules.productiveText.push(this.toSelection(channel));
      }
    }

    return rules;
  }

  /**
   * Preenche checkboxes com regras já salvas no banco.
   * @param rules Regras persistidas
   */
  private applyRulesToSelections(rules: ChannelRuleSet): void {
    this.selections = {};

    const allChannels = [...this.voiceChannels, ...this.textChannels];
    for (const channel of allChannels) {
      this.selections[channel.channelId] = this.createEmptySelection();
    }

    const applyList = (
      list: Array<{ channelId: string }>,
      field: keyof ChannelSelectionState,
    ): void => {
      for (const item of list) {
        const selection = this.getSelection(item.channelId);
        selection[field] = true;
      }
    };

    applyList(rules.ignored, 'ignored');
    applyList(rules.afk, 'afk');
    applyList(rules.lunch, 'lunch');
    applyList(rules.productiveVoice, 'productiveVoice');
    applyList(rules.ignoredText, 'ignoredText');
    applyList(rules.productiveText, 'productiveText');
  }

  /**
   * Converte canal da UI para item de regra da API.
   * @param channel Canal selecionado
   * @returns Snapshot persistível
   */
  private toSelection(channel: DiscordGuildChannelOption): {
    channelId: string;
    channelName: string;
    channelType: 'voice' | 'text';
  } {
    return {
      channelId: channel.channelId,
      channelName: channel.channelName,
      channelType: channel.channelType,
    };
  }

  /**
   * Cria estado inicial sem nenhuma categoria marcada.
   * @returns Seleção vazia
   */
  private createEmptySelection(): ChannelSelectionState {
    return {
      ignored: false,
      afk: false,
      lunch: false,
      productiveVoice: false,
      ignoredText: false,
      productiveText: false,
    };
  }
}
