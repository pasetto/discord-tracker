import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

/** Servidor Discord disponível para o bot. */
interface DiscordGuildOption {
  guildId: string;
  guildName: string;
  iconUrl?: string;
  memberCount: number;
}

/** Conexão ativa da organização com um guild. */
interface GuildConnectionDto {
  guildId: string;
  guildName: string;
  iconUrl?: string;
  isMonitoringEnabled: boolean;
}

/**
 * Tela tenant para escolher o servidor Discord monitorado pela organização.
 */
@Component({
  selector: 'app-discord-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './discord-settings.component.html',
})
export class DiscordSettingsComponent implements OnInit {
  orgId = localStorage.getItem('syntra.orgId') ?? '';
  loading = false;
  errorMessage = '';
  successMessage = '';
  botConnected = false;
  guilds: DiscordGuildOption[] = [];
  activeConnection: GuildConnectionDto | null = null;

  constructor(private readonly http: HttpClient) {}

  /**
   * Carrega status e guilds disponíveis.
   */
  ngOnInit(): void {
    if (this.orgId) {
      this.refresh();
    }
  }

  /**
   * Atualiza status do bot e lista de servidores.
   */
  refresh(): void {
    if (!this.orgId) {
      this.errorMessage = 'Informe organizationId no localStorage (syntra.orgId).';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const baseUrl = `/api/v1/org/${this.orgId}`;

    this.http.get<{ botConnected: boolean; activeConnection: GuildConnectionDto | null }>(`${baseUrl}/discord/status`).subscribe({
      next: (status) => {
        this.botConnected = status.botConnected;
        this.activeConnection = status.activeConnection;
        this.http.get<{ guilds: DiscordGuildOption[] }>(`${baseUrl}/discord/guilds`).subscribe({
          next: (response) => {
            this.guilds = response.guilds;
            this.loading = false;
          },
          error: (error) => {
            this.loading = false;
            this.errorMessage = error.error?.message ?? error.error?.error ?? 'Não foi possível listar servidores.';
          },
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Falha ao consultar status do bot.';
      },
    });
  }

  /**
   * Seleciona guild monitorado para a organização.
   * @param guildId ID do servidor Discord
   */
  selectGuild(guildId: string): void {
    this.http.post<{ connection: GuildConnectionDto }>(`/api/v1/org/${this.orgId}/discord/guilds/${guildId}/select`, {}).subscribe({
      next: (response) => {
        this.activeConnection = response.connection;
        localStorage.setItem('syntra.guildId', response.connection.guildId);
        this.successMessage = `Servidor ${response.connection.guildName} selecionado para monitoramento.`;
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Falha ao selecionar servidor.';
      },
    });
  }
}
