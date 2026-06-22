import Router from '@koa/router';
import type { ChannelRuleSet } from '../../db/models/ChannelRule';
import { channelRuleRepository } from '../../repositories/channelRuleRepository';

/** Rotas de configuração de canais por organização e guild. */
export const channelsRouter = new Router();

/**
 * GET /guilds/:guildId/channels - Retorna regras de classificação de canais.
 */
channelsRouter.get('/guilds/:guildId/channels', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  const rules = await channelRuleRepository.getByGuild(organizationId, guildId);
  ctx.body = { rules };
});

/**
 * PUT /guilds/:guildId/channels - Persiste regras de classificação de canais.
 */
channelsRouter.put('/guilds/:guildId/channels', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;
  const payload = ctx.request.body as { rules?: Partial<ChannelRuleSet> } | undefined;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  if (!payload?.rules || typeof payload.rules !== 'object') {
    ctx.status = 400;
    ctx.body = { error: 'Payload inválido. Envie { rules: { ... } }' };
    return;
  }

  const rules = await channelRuleRepository.upsertByGuild(organizationId, guildId, payload.rules);
  ctx.body = { rules };
});
