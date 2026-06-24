import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Resumo mascarado de aplicativo Discord retornado pela API admin. */
interface DiscordApplicationSummary {
  id: string;
  name: string;
  clientId: string;
  botTokenMasked: string;
  clientSecretMasked: string;
  isPlatformDefault: boolean;
  isActive: boolean;
  botUsername?: string;
  validationError?: string;
}

/**
 * Tela de super admin para cadastro do bot Discord da plataforma.
 */
@Component({
  selector: 'app-discord-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './discord-admin.component.html',
})
export class DiscordAdminComponent implements OnInit {
  applications: DiscordApplicationSummary[] = [];
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  form = {
    name: 'Syntra Platform Bot',
    clientId: '',
    clientSecret: '',
    botToken: '',
    superAdminDiscordId: '',
  };

  constructor(private readonly http: HttpClient) {}

  /**
   * Carrega aplicativos cadastrados ao abrir a tela.
   */
  ngOnInit(): void {
    this.refresh();
  }

  /**
   * Busca lista de aplicativos Discord na API admin.
   */
  refresh(): void {
    this.loading = true;
    this.errorMessage = '';
    this.http.get<{ applications: DiscordApplicationSummary[] }>('/api/v1/admin/discord-applications').subscribe({
      next: (response) => {
        this.applications = response.applications;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message ?? 'Não foi possível carregar aplicativos Discord.';
      },
    });
  }

  /**
   * Cadastra o primeiro bot via bootstrap (dev) ou endpoint admin autenticado.
   */
  submit(): void {
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const endpoint =
      this.applications.length === 0
        ? '/api/v1/admin/discord-applications/bootstrap'
        : '/api/v1/admin/discord-applications';

    this.http.post<{ application: DiscordApplicationSummary; message?: string }>(endpoint, this.form).subscribe({
      next: (response) => {
        this.successMessage = response.message ?? 'Bot cadastrado com sucesso. Remova DISCORD_TOKEN do .env.';
        this.saving = false;
        this.form.clientSecret = '';
        this.form.botToken = '';
        this.refresh();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error.error?.error ?? 'Falha ao cadastrar aplicativo Discord.';
      },
    });
  }

  /**
   * Ativa aplicativo selecionado e reconecta o bot.
   * @param applicationId ID do aplicativo
   */
  activate(applicationId: string): void {
    this.http.post(`/api/v1/admin/discord-applications/${applicationId}/activate`, {}).subscribe({
      next: () => {
        this.successMessage = 'Aplicativo ativado e bot reconectado.';
        this.refresh();
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Falha ao ativar aplicativo.';
      },
    });
  }

  /**
   * Revalida token do bot contra API do Discord.
   * @param applicationId ID do aplicativo
   */
  validate(applicationId: string): void {
    this.http.post(`/api/v1/admin/discord-applications/${applicationId}/validate`, {}).subscribe({
      next: () => {
        this.successMessage = 'Credenciais validadas com sucesso.';
        this.refresh();
      },
      error: (error) => {
        this.errorMessage = error.error?.error ?? 'Falha na validação das credenciais.';
      },
    });
  }
}
