import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} from 'discord.js';
import { config } from '../config/env';
import { createLogger } from '../logger';
import {
  setDiscordConnected,
  setDiscordPing,
} from '../metrics/prometheus';
import { systemLogRepository } from '../repositories/systemLogRepository';

const log = createLogger('discord');

/** Cliente Discord singleton. */
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember, Partials.User, Partials.Channel],
});

/** Indica se o bot está conectado e pronto. */
export let isDiscordReady = false;

const readyHandlers: Array<() => void | Promise<void>> = [];

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
 * Conecta o bot ao Discord e aguarda evento ready.
 * @returns Promise resolvida quando o bot estiver pronto
 */
export async function connectDiscord(): Promise<Client> {
  if (!config.discordToken) {
    throw new Error('DISCORD_TOKEN ausente: não foi possível conectar o bot Discord');
  }

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

  await discordClient.login(config.discordToken);
  return discordClient;
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
