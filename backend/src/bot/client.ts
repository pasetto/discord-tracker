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

/** Promise compartilhada para evitar múltiplas esperas concorrentes pelo gateway. */
let gatewayReadyWait: Promise<void> | null = null;

/**
 * Conecta o cliente Discord com o token recebido.
 * @param token Token OAuth do bot
 * @returns Promise resolvida após autenticação no gateway
 * @throws {BotTokenInvalidError} Quando o Discord rejeita o token
 */
async function loginWithToken(token: string): Promise<void> {
  if (discordClient.token === token) {
    return;
  }

  if (discordClient.token) {
    discordClient.destroy();
  }

  try {
    await discordClient.login(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao autenticar bot Discord';
    if (message.toLowerCase().includes('invalid token')) {
      throw new BotTokenInvalidError();
    }
    if (message.toLowerCase().includes('already logged in')) {
      return;
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

/** Tempo máximo aguardando o evento `ready` do gateway Discord. */
const DISCORD_READY_TIMEOUT_MS = 15_000;

/**
 * Aguarda o gateway Discord ficar pronto sem repetir login com o mesmo token.
 * @param timeoutMs Tempo máximo de espera
 * @returns Promise resolvida quando o cliente estiver operacional
 * @throws {Error} Quando o timeout expirar
 */
function waitForDiscordGatewayReady(timeoutMs: number): Promise<void> {
  if (discordClient.isReady() || isDiscordReady) {
    isDiscordReady = true;
    return Promise.resolve();
  }

  if (gatewayReadyWait) {
    return gatewayReadyWait;
  }

  gatewayReadyWait = new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();

    const tryResolve = (): void => {
      if (discordClient.isReady() || isDiscordReady) {
        isDiscordReady = true;
        cleanup();
        resolve();
      }
    };

    const onTimeout = (): void => {
      cleanup();
      reject(new Error('Timeout aguardando conexão do bot Discord'));
    };

    const timer = setTimeout(onTimeout, timeoutMs);
    const poller = setInterval(() => {
      tryResolve();
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(poller);
      }
    }, 250);

    const onGatewayReady = (): void => {
      tryResolve();
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      clearInterval(poller);
      discordClient.off('ready', onGatewayReady);
      discordClient.off('shardResume', onGatewayReady);
      gatewayReadyWait = null;
    };

    discordClient.on('ready', onGatewayReady);
    discordClient.on('shardResume', onGatewayReady);
    tryResolve();
  });

  return gatewayReadyWait;
}

/**
 * Conecta o bot ao Discord e aguarda evento ready.
 * @returns Promise resolvida quando o bot estiver pronto
 */
export async function connectDiscord(): Promise<Client> {
  ensureDiscordEventHandlers();
  await botManager.initialize();

  if (!discordClient.isReady() && !isDiscordReady) {
    await waitForDiscordGatewayReady(DISCORD_READY_TIMEOUT_MS);
  }

  return discordClient;
}

/**
 * Garante que o cliente Discord está autenticado e pronto para operações de guild.
 * @param timeoutMs Tempo máximo de espera pelo evento `ready`
 * @returns Promise resolvida quando o bot estiver pronto
 * @throws {Error} Quando a conexão não ficar pronta dentro do timeout
 */
export async function ensureDiscordClientReady(timeoutMs = DISCORD_READY_TIMEOUT_MS): Promise<void> {
  if (discordClient.isReady() || isDiscordReady) {
    isDiscordReady = true;
    return;
  }

  ensureDiscordEventHandlers();

  if (!discordClient.token) {
    await botManager.initialize();
  }

  if (discordClient.isReady() || isDiscordReady) {
    isDiscordReady = true;
    return;
  }

  await waitForDiscordGatewayReady(timeoutMs);
}

/**
 * Indica se o bot pode acessar APIs de guild (cache ou gateway pronto).
 * @param guildId ID opcional do servidor para validar presença no cache
 * @returns `true` quando há token e guild no cache ou gateway pronto
 */
export function canAccessDiscordGuild(guildId?: string): boolean {
  if (!discordClient.token) {
    return false;
  }

  if (guildId && discordClient.guilds.cache.has(guildId)) {
    return true;
  }

  return discordClient.isReady() || isDiscordReady;
}

/**
 * Garante acesso a um guild com retry/fallback: se o bot ainda não estiver
 * acessível, aguarda o gateway ficar pronto antes de desistir.
 *
 * Resolve o caso comum em que a flag `isDiscordReady` está temporariamente
 * dessincronizada (ex.: após um `shardDisconnect` transitório) enquanto o
 * cliente já está, de fato, conectado — evitando o falso "Bot não conectado".
 * @param guildId ID opcional do servidor para validar presença no cache
 * @param timeoutMs Tempo máximo de espera pela conexão do gateway
 * @returns `true` quando o bot pode acessar o guild; `false` caso contrário
 */
export async function ensureDiscordGuildAccessible(
  guildId?: string,
  timeoutMs = DISCORD_READY_TIMEOUT_MS,
): Promise<boolean> {
  if (canAccessDiscordGuild(guildId)) {
    return true;
  }

  try {
    await ensureDiscordClientReady(timeoutMs);
  } catch {
    return false;
  }

  return canAccessDiscordGuild(guildId);
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
  const ready = discordClient.isReady() || isDiscordReady;
  if (ready) {
    isDiscordReady = true;
  }
  return ready;
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
