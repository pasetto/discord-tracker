import { DiscordApplicationModel } from '../db/models/DiscordApplication';
import { decryptSecret } from './encryptionService';

/**
 * Projeção mínima de credenciais necessárias para inicializar o bot.
 */
export interface DiscordApplicationCredentials {
  botTokenEncrypted: string;
}

/**
 * Erro lançado quando não existe aplicação Discord ativa para a plataforma.
 */
export class PlatformNotConfiguredError extends Error {
  /**
   * Cria o erro de plataforma sem credenciais configuradas.
   * @param message Mensagem detalhada do erro
   */
  constructor(message = 'PlatformNotConfiguredError: registre um DiscordApplication em /admin/discord') {
    super(message);
    this.name = 'PlatformNotConfiguredError';
  }
}

/**
 * Dependências injetáveis do BotManager para facilitar testes.
 */
export interface BotManagerDependencies {
  findPlatformDefault?: () => Promise<DiscordApplicationCredentials | null>;
  decrypt?: (encryptedValue: string) => string;
  onTokenLoaded?: (token: string) => Promise<void>;
  nodeEnv?: string;
}

/**
 * Serviço responsável por carregar credenciais do bot a partir do banco.
 */
export class BotManager {
  private readonly findPlatformDefault: () => Promise<DiscordApplicationCredentials | null>;

  private readonly decrypt: (encryptedValue: string) => string;

  private readonly onTokenLoaded: (token: string) => Promise<void>;

  /**
   * Cria uma instância de gerenciamento do token do bot Discord.
   * @param dependencies Dependências opcionais para customização e testes
   */
  constructor(dependencies: BotManagerDependencies = {}) {
    this.findPlatformDefault =
      dependencies.findPlatformDefault ??
      (async () =>
        DiscordApplicationModel.findOne({
          isPlatformDefault: true,
          isActive: true,
        })
          .lean<DiscordApplicationCredentials>()
          .exec());

    this.decrypt = dependencies.decrypt ?? decryptSecret;
    this.onTokenLoaded = dependencies.onTokenLoaded ?? (async () => {});
  }

  /**
   * Inicializa o bot carregando o token ativo do banco de dados.
   * @returns Promise resolvida após token ser carregado
   * @throws {PlatformNotConfiguredError} Quando não existe app Discord em produção
   */
  async initialize(): Promise<void> {
    await this.loadTokenFromDatabase();
  }

  /**
   * Recarrega credenciais do banco, usado após atualização administrativa.
   * @returns Promise resolvida quando o novo token for aplicado
   * @throws {PlatformNotConfiguredError} Quando não existe app Discord em produção
   */
  async reloadFromDatabase(): Promise<void> {
    await this.loadTokenFromDatabase();
  }

  /**
   * Busca o app default no banco e aplica token de conexão.
   * @returns Promise resolvida após processar token
   */
  private async loadTokenFromDatabase(): Promise<void> {
    const app = await this.findPlatformDefault();

    if (!app) {
      throw new PlatformNotConfiguredError();
    }

    const decryptedToken = this.decrypt(app.botTokenEncrypted);
    await this.onTokenLoaded(decryptedToken);
  }
}
