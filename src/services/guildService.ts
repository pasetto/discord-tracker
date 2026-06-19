import { Guild } from 'discord.js';
import { config } from '../config/env';
import { discordClient } from '../bot/client';
import { appSettingRepository } from '../repositories/appSettingRepository';
import { createLogger } from '../logger';

const log = createLogger('guild');
const SELECTED_GUILD_KEY = 'selectedGuildId';

/** Resumo de um servidor Discord disponível para o bot. */
export interface GuildSummary {
  id: string;
  name: string;
  memberCount: number;
  iconUrl: string | null;
}

let selectedGuildId: string | null = null;
let initialized = false;

/**
 * Resolve o ID efetivo do guild monitorado com base em env, banco e cache do bot.
 * @returns ID do guild selecionado ou null quando indisponível
 */
function resolveEffectiveGuildId(storedId: string | null): string | null {
  if (config.discordGuildId && discordClient.guilds.cache.has(config.discordGuildId)) {
    return config.discordGuildId;
  }

  if (storedId && discordClient.guilds.cache.has(storedId)) {
    return storedId;
  }

  return discordClient.guilds.cache.first()?.id ?? null;
}

/**
 * Serviço central de seleção e consulta do servidor Discord monitorado.
 */
export const guildService = {
  /**
   * Carrega a seleção persistida e define o guild ativo após o bot conectar.
   * @returns Promise resolvida após inicialização
   */
  async initialize(): Promise<void> {
    if (!discordClient.isReady()) {
      return;
    }

    const storedId = await appSettingRepository.get(SELECTED_GUILD_KEY);
    const effectiveId = resolveEffectiveGuildId(storedId);

    if (!effectiveId) {
      log.warn('Nenhum servidor Discord disponível para monitoramento');
      initialized = true;
      return;
    }

    selectedGuildId = effectiveId;

    if (storedId !== effectiveId) {
      await appSettingRepository.set(SELECTED_GUILD_KEY, effectiveId);
    }

    const guild = discordClient.guilds.cache.get(effectiveId);
    log.info(
      { guildId: effectiveId, guildName: guild?.name, source: config.discordGuildId ? 'env' : 'dashboard' },
      'Servidor monitorado definido',
    );

    initialized = true;
  },

  /**
   * Lista servidores aos quais o bot está conectado.
   * @returns Lista de resumos ordenados por nome
   */
  listAvailableGuilds(): GuildSummary[] {
    if (!discordClient.isReady()) {
      return [];
    }

    return [...discordClient.guilds.cache.values()]
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        iconUrl: guild.iconURL({ size: 64 }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },

  /**
   * Retorna o ID do servidor atualmente monitorado.
   * @returns ID do guild ou null
   */
  getSelectedGuildId(): string | null {
    return selectedGuildId;
  },

  /**
   * Retorna o objeto Guild monitorado no cache do Discord.js.
   * @returns Guild ativo ou undefined
   */
  getTargetGuild(): Guild | undefined {
    if (!selectedGuildId) {
      return undefined;
    }
    return discordClient.guilds.cache.get(selectedGuildId);
  },

  /**
   * Verifica se um guild deve ser monitorado pelos handlers de evento.
   * @param guildId ID do servidor Discord
   * @returns true quando corresponde ao guild selecionado
   */
  isMonitoredGuild(guildId: string | null | undefined): boolean {
    if (!guildId || !selectedGuildId) {
      return false;
    }
    return guildId === selectedGuildId;
  },

  /**
   * Altera o servidor monitorado via dashboard e persiste a escolha.
   * @param guildId ID do servidor escolhido
   * @returns Guild selecionado
   * @throws {Error} Quando o ID é inválido ou o bot não está conectado
   */
  async setSelectedGuildId(guildId: string): Promise<Guild> {
    if (!discordClient.isReady()) {
      throw new Error('Bot Discord não está conectado');
    }

    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error('Servidor não encontrado entre as conexões do bot');
    }

    selectedGuildId = guildId;
    await appSettingRepository.set(SELECTED_GUILD_KEY, guildId);

    log.info({ guildId, guildName: guild.name }, 'Servidor monitorado alterado pelo dashboard');

    return guild;
  },

  /**
   * Indica se a seleção de guild já foi inicializada.
   * @returns true após initialize()
   */
  isInitialized(): boolean {
    return initialized;
  },

  /**
   * Garante que a seleção de guild foi carregada (retry lazy após ready).
   * @returns Promise resolvida após tentativa de inicialização
   */
  async ensureInitialized(): Promise<void> {
    if (initialized && selectedGuildId) {
      return;
    }

    if (discordClient.isReady()) {
      await this.initialize();
    }
  },
};
