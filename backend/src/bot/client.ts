import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} from 'discord.js';
import { createLogger } from '../logger';
import {
  setDiscordConnected,
  setDiscordPing,
} from '../metrics/prometheus';
import { systemLogRepository } from '../repositories/systemLogRepository';
import { BotManager } from '../services/botManager';
import { registerMessageCreateHandler } from './events/messageCreate';
import { registerMessageReactionAddHandler } from './events/messageReactionAdd';

const log = createLogger('discord');

/** Cliente Discord singleton. */
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.GuildMember, Partials.User, Partials.Channel, Partials.Message, Partials.Reaction],
});

/** Indica se o bot está conectado e pronto. */
export let isDiscordReady = false;

const readyHandlers: Array<() => void | Promise<void>> = [];
let eventHandlersRegistered = false;

/**
 * Erro lançado quando o token do bot é rejeitado pelo Discord.
 */
export class BotTokenInvalidError extends Error {
  /**
   * Cria erro de token inválido retornado pelo gateway Discord.
   * @param message Mensagem detalhada
   */
  constructor(message = 'Token do bot Discord inválido. Atualize em /admin/discord') {
    super(message);
    this.name = 'BotTokenInvalidError';
  }
}

/**
 * Conecta o cliente Discord com o token recebido.
 * @param token Token OAuth do bot
 * @returns Promise resolvida após autenticação no gateway
 * @throws {BotTokenInvalidError} Quando o Discord rejeita o token
 */
async function loginWithToken(token: string): Promise<void> {
  if (discordClient.token === token && discordClient.isReady()) {
    return;
  }

  if (discordClient.token && discordClient.token !== token) {
    discordClient.destroy();
  }

  try {
    await discordClient.login(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao autenticar bot Discord';
    if (message.toLowerCase().includes('invalid token')) {
      throw new BotTokenInvalidError();
    }
    throw error;
  }
}

/** Gerencia carregamento e recarga de token via banco de dados. */
const botManager = new BotManager({
  onTokenLoaded: loginWithToken,
});

/**
 * Registra callback executado após o bot ficar pronto.
 * Se o bot já estiver pronto, executa imediatamente.
 * @param handler Função de inicialização pós-ready
 */
export function registerDiscordReadyHandler(handler: () => void | Promise<void>): void {
  readyHandlers.push(handler);

  if (isDiscordReady && discordClient.isReady()) {
    void Promise.resolve(handler());
  }
}

/**
 * Registra handlers de lifecycle do cliente Discord uma única vez.
 */
function ensureDiscordEventHandlers(): void {
  if (eventHandlersRegistered) {
    return;
  }

  registerMessageCreateHandler();
  registerMessageReactionAddHandler();

  discordClient.on('ready', async () => {
    isDiscordReady = true;
    setDiscordConnected(true);
    setDiscordPing(discordClient.ws.ping);

    log.info(
      { username: discordClient.user?.tag, guilds: discordClient.guilds.cache.size },
      'Bot Discord conectado',
    );

    systemLogRepository.create('info', 'Bot Discord conectado', 'discord', {
      username: discordClient.user?.tag,
    }).catch(() => {});

    discordClient.user?.setActivity('Monitorando presença', { type: ActivityType.Watching });

    for (const handler of readyHandlers) {
      try {
        await handler();
      } catch (error) {
        log.error({ err: error }, 'Erro em handler pós-ready');
      }
    }
  });

  discordClient.on('shardDisconnect', () => {
    isDiscordReady = false;
    setDiscordConnected(false);
    log.warn('Discord desconectado');
    systemLogRepository.create('warn', 'Discord desconectado', 'discord').catch(() => {});
  });

  discordClient.on('shardReconnecting', () => {
    log.info('Discord reconectando...');
    systemLogRepository.create('info', 'Discord reconectando', 'discord').catch(() => {});
  });

  discordClient.on('shardResume', () => {
    isDiscordReady = true;
    setDiscordConnected(true);
    log.info('Discord reconectado');
    systemLogRepository.create('info', 'Discord reconectado', 'discord').catch(() => {});
  });

  discordClient.on('error', (error) => {
    log.error({ err: error }, 'Erro no cliente Discord');
    systemLogRepository.create('error', 'Erro Discord', 'discord', { error: error.message }).catch(() => {});
  });

  eventHandlersRegistered = true;
}

/**
 * Conecta o bot ao Discord e aguarda evento ready.
 * @returns Promise resolvida quando o bot estiver pronto
 */
export async function connectDiscord(): Promise<Client> {
  ensureDiscordEventHandlers();
  await botManager.initialize();
  return discordClient;
}

/**
 * Recarrega credenciais do Discord a partir do banco e reaplica conexão.
 * @returns Promise resolvida após recarga do token
 */
export async function reloadDiscordFromDatabase(): Promise<void> {
  ensureDiscordEventHandlers();
  await botManager.reloadFromDatabase();
}

/**
 * Verifica saúde da conexão Discord.
 * @returns true quando ready e websocket aberto
 */
export function checkDiscordHealth(): boolean {
  return isDiscordReady && discordClient.isReady();
}

/**
 * Retorna ping atual do WebSocket Discord.
 * @returns Ping em ms ou -1 se indisponível
 */
export function getDiscordPing(): number {
  return discordClient.isReady() ? discordClient.ws.ping : -1;
}

/**
 * Desconecta o bot Discord graciosamente.
 */
export async function disconnectDiscord(): Promise<void> {
  isDiscordReady = false;
  setDiscordConnected(false);
  discordClient.destroy();
  log.info('Bot Discord desconectado');
}
