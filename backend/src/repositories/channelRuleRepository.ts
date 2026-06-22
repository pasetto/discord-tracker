import { ChannelRuleModel, type ChannelRuleSet, type ChannelSelection } from '../db/models/ChannelRule';

/**
 * Cria estrutura padrão de regras de canais.
 * @returns Estrutura vazia para classificação de voz e texto
 */
export function createDefaultChannelRules(): ChannelRuleSet {
  return {
    ignored: [],
    afk: [],
    lunch: [],
    productiveVoice: [],
    productiveText: [],
    ignoredText: [],
  };
}

/**
 * Garante regras completas e elimina entradas inválidas/duplicadas.
 * @param rules Regras recebidas da API ou banco
 * @returns Regras normalizadas para persistência e uso em serviços
 */
export function normalizeChannelRules(rules: Partial<ChannelRuleSet> | undefined): ChannelRuleSet {
  const normalized = createDefaultChannelRules();

  normalized.ignored = normalizeSelectionList(rules?.ignored, 'voice');
  normalized.afk = normalizeSelectionList(rules?.afk, 'voice');
  normalized.lunch = normalizeSelectionList(rules?.lunch, 'voice');
  normalized.productiveVoice = normalizeSelectionList(rules?.productiveVoice, 'voice');
  normalized.productiveText = normalizeSelectionList(rules?.productiveText, 'text');
  normalized.ignoredText = normalizeSelectionList(rules?.ignoredText, 'text');

  return normalized;
}

/**
 * Repositório de regras de classificação de canais.
 */
export const channelRuleRepository = {
  /**
   * Retorna regras por organização e guild.
   * @param organizationId Identificador da organização
   * @param guildId Identificador do servidor Discord
   * @returns Regras existentes ou estrutura padrão vazia
   */
  async getByGuild(organizationId: string, guildId: string): Promise<ChannelRuleSet> {
    const doc = await ChannelRuleModel.findOne({ organizationId, guildId }).lean();
    return normalizeChannelRules(doc?.rules);
  },

  /**
   * Retorna regras por guild sem filtro de organização.
   * @param guildId Identificador do servidor Discord
   * @returns Regras existentes ou estrutura padrão vazia
   */
  async getByGuildId(guildId: string): Promise<ChannelRuleSet> {
    const doc = await ChannelRuleModel.findOne({ guildId }).lean();
    return normalizeChannelRules(doc?.rules);
  },

  /**
   * Cria ou atualiza regras de um guild.
   * @param organizationId Identificador da organização
   * @param guildId Identificador do servidor Discord
   * @param rules Regras de canal enviadas pela UI
   * @returns Regras persistidas normalizadas
   */
  async upsertByGuild(organizationId: string, guildId: string, rules: Partial<ChannelRuleSet>): Promise<ChannelRuleSet> {
    const normalizedRules = normalizeChannelRules(rules);
    const doc = await ChannelRuleModel.findOneAndUpdate(
      { organizationId, guildId },
      { $set: { rules: normalizedRules } },
      { upsert: true, new: true },
    ).lean();

    return normalizeChannelRules(doc?.rules ?? normalizedRules);
  },
};

/**
 * Normaliza lista de canais removendo entradas inválidas e duplicadas.
 * @param selections Itens informados na API
 * @param forcedType Tipo esperado para a lista
 * @returns Lista normalizada
 */
function normalizeSelectionList(
  selections: ChannelSelection[] | undefined,
  forcedType: ChannelSelection['channelType'],
): ChannelSelection[] {
  if (!Array.isArray(selections)) {
    return [];
  }

  const dedupe = new Set<string>();
  const normalized: ChannelSelection[] = [];

  for (const selection of selections) {
    const channelId = selection?.channelId?.trim();
    if (!channelId) {
      continue;
    }

    if (dedupe.has(channelId)) {
      continue;
    }

    dedupe.add(channelId);
    normalized.push({
      channelId,
      channelName: selection?.channelName?.trim() || channelId,
      channelType: forcedType,
    });
  }

  return normalized;
}
