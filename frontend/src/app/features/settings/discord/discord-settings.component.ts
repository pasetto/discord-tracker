import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';

/** Servidor Discord disponível para o bot. */
interface DiscordGuildOption {
  guildId: string;
  guildName: string;
  iconUrl?: string;
  memberCount: number;
}

/** Resumo do aplicativo Discord da organização. */
interface DiscordApplicationSummary {
  id: string;
  name: string;
  clientId: string;
  botUsername?: string;
  isActive: boolean;
}

/**
 * Configuração Discord do tenant: cadastro do bot, instalação e escolha do servidor.
 */
@Component({
  selector: 'app-discord-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './discord-settings.component.html',
})
export class DiscordSettingsComponent implements OnInit {
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  botConnected = false;
  guilds: DiscordGuildOption[] = [];
  application: DiscordApplicationSummary | null = null;
  installUrl = '';

  form = {
    name: 'Meu bot Syntra',
    clientId: '',
    clientSecret: '',
    botToken: '',
  };

  constructor(
    private readonly http: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Carrega aplicativo, status e servidores disponíveis.
   */
  ngOnInit(): void {
    this.refreshAll();
  }

  /**
   * Recarrega contexto completo da conexão Discord.
   */
  refreshAll(): void {
    if (!this.tenantContext.orgId) {
      this.errorMessage = 'Organização não encontrada. Faça login novamente.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const orgBaseUrl = this.tenantContext.getOrgApiBaseUrl();

    this.http
      .get<{ application: DiscordApplicationSummary | null }>(`${orgBaseUrl}/discord/application`)
      .pipe(
        switchMap((response) => {
          this.application = response.application;
          if (this.application) {
            this.form.name = this.application.name;
            this.form.clientId = this.application.clientId;
          }

          return this.tenantContext.refresh();
        }),
      )
      .subscribe({
        next: (state) => {
          this.botConnected = state.botConnected;
          this.loadInstallUrl();

          if (!this.botConnected) {
            this.guilds = [];
            this.loading = false;
            return;
          }

          this.loadGuilds();
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage =
            error.error?.message ?? error.error?.error ?? 'Não foi possível carregar configuração do Discord.';
        },
      });
  }

  /**
   * Cadastra ou atualiza credenciais do bot criado no Discord Developer Portal.
   */
  saveApplication(): void {
    const validationError = this.validateFormLocally();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http
      .post<{ application: DiscordApplicationSummary; message?: string }>(
        `${this.tenantContext.getOrgApiBaseUrl()}/discord/application`,
        this.form,
      )
      .subscribe({
        next: (response) => {
          this.application = response.application;
          this.saving = false;
          this.successMessage = response.message ?? 'Bot cadastrado com sucesso.';
          this.form.clientSecret = '';
          this.form.botToken = '';
          this.loadInstallUrl();
          this.tenantContext.refresh().subscribe((state) => {
            this.botConnected = state.botConnected;
            if (this.botConnected) {
              this.loadGuilds();
            }
          });
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = error.error?.error ?? 'Falha ao cadastrar bot.';
        },
      });
  }

  /**
   * Abre URL de instalação do bot no Discord.
   */
  openInstallUrl(): void {
    if (!this.installUrl) {
      this.errorMessage = 'Cadastre o bot antes de adicioná-lo ao servidor.';
      return;
    }
    window.open(this.installUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Seleciona servidor monitorado pela organização.
   * @param guildId ID do servidor Discord
   */
  selectGuild(guildId: string): void {
    this.http
      .post<{ connection: { guildId: string; guildName: string; iconUrl?: string; isMonitoringEnabled: boolean } }>(
        `${this.tenantContext.getOrgApiBaseUrl()}/discord/guilds/${guildId}/select`,
        {},
      )
      .subscribe({
        next: (response) => {
          this.tenantContext.setActiveGuild(response.connection);
          this.successMessage = `Servidor "${response.connection.guildName}" selecionado.`;
          this.errorMessage = '';
        },
        error: (error) => {
          this.errorMessage = error.error?.error ?? 'Falha ao selecionar servidor.';
        },
      });
  }

  /**
   * Nome do servidor ativo no contexto do tenant.
   */
  get activeGuildName(): string {
    return this.tenantContext.guildName;
  }

  /**
   * Valida formato básico antes de enviar ao backend.
   * @returns Mensagem de erro ou null quando válido
   */
  private validateFormLocally(): string | null {
    const clientId = this.form.clientId.trim();
    const clientSecret = this.form.clientSecret.trim();
    const botToken = this.form.botToken.trim();

    if (!/^\d{17,20}$/.test(clientId)) {
      return 'Client ID inválido. Copie o número do OAuth2 no Developer Portal (não use email).';
    }
    if (clientSecret.length < 20) {
      return 'Client Secret inválido. Copie o valor completo em OAuth2 → Client Secret.';
    }
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(botToken) || botToken.length < 50) {
      return 'Bot Token inválido. Copie em Bot → Token (formato com pontos). Não use Client Secret.';
    }
    return null;
  }

  /**
   * Carrega URL OAuth para instalar o bot em um servidor.
   */
  private loadInstallUrl(): void {
    this.http
      .get<{ installUrl: string }>(`${this.tenantContext.getOrgApiBaseUrl()}/discord/install-url`)
      .subscribe({
        next: (response) => {
          this.installUrl = response.installUrl;
        },
        error: () => {
          this.installUrl = '';
        },
      });
  }

  /**
   * Lista servidores onde o bot já foi adicionado.
   */
  private loadGuilds(): void {
    this.http
      .get<{ guilds: DiscordGuildOption[] }>(`${this.tenantContext.getOrgApiBaseUrl()}/discord/guilds`)
      .subscribe({
        next: (response) => {
          this.guilds = response.guilds;
          this.loading = false;
          this.errorMessage = '';
        },
        error: (error) => {
          this.loading = false;
          if (error.status === 503) {
            this.errorMessage =
              error.error?.message ?? 'Bot Discord não conectado. Cadastre o bot e tente novamente.';
            return;
          }

          this.errorMessage =
            error.error?.message ?? error.error?.error ?? 'Não foi possível listar servidores do Discord.';
        },
      });
  }
}
