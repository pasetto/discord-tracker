import Router from '@koa/router';
import path from 'path';
import ejs from 'ejs';
import { checkDiscordHealth } from '../../bot/client';
import { reportService } from '../../services/reportService';
import { voiceSessionRepository } from '../../repositories/voiceSessionRepository';
import { presenceSessionRepository } from '../../repositories/presenceSessionRepository';
import { IUser } from '../../db/models/User';
import { IVoiceSession } from '../../db/models/VoiceSession';
import { IPresenceSession } from '../../db/models/PresenceSession';
import { config } from '../../config/env';
import { formatDateTime } from '../../utils/timezone';
import { guildService } from '../../services/guildService';
import { recoverSessions } from '../../bot/recovery/sessionRecovery';
import { collectLiveSnapshot } from '../../services/liveStatsService';
import { createLogger } from '../../logger';

/** Rotas do dashboard web. */
export const dashboardRouter = new Router();

const log = createLogger('dashboard');
const viewsPath = path.join(__dirname, '..', '..', 'dashboard', 'views');

/**
 * Renderiza template EJS.
 * @param template Nome do arquivo sem extensão
 * @param data Dados para o template
 * @returns HTML renderizado
 */
async function render(template: string, data: Record<string, unknown>): Promise<string> {
  const filePath = path.join(viewsPath, `${template}.ejs`);
  return ejs.renderFile(filePath, data);
}

/**
 * GET / - Dashboard principal.
 */
dashboardRouter.get('/', async (ctx) => {
  const today = new Date();
  const [dailyReport, dailyRanking, monthlyRanking, openVoice, openPresence, live] =
    await Promise.all([
      reportService.getDailyReport(today),
      reportService.getDailyRanking(today, 10),
      reportService.getMonthlyRanking(undefined, undefined, 10),
      voiceSessionRepository.findAllOpen(),
      presenceSessionRepository.findAllOpen(),
      collectLiveSnapshot(),
    ]);

  const availableGuilds = guildService.listAvailableGuilds();

  const formatSession = (s: IVoiceSession) => {
    const user = s.userId as unknown as IUser;
    return {
      username: user?.username ?? 'unknown',
      channelName: s.channelName,
      sessionType: s.sessionType,
      startedAt: formatDateTime(s.startedAt),
    };
  };

  const formatPresence = (s: IPresenceSession) => {
    const user = s.userId as unknown as IUser;
    return {
      username: user?.username ?? 'unknown',
      status: s.status,
      startedAt: formatDateTime(s.startedAt),
    };
  };

  ctx.type = 'html';
  ctx.body = await render('dashboard', {
    onlineUsers: live.onlineUsers,
    voiceUsers: live.voiceUsers,
    dailyReport,
    dailyRanking,
    monthlyRanking,
    openVoiceSessions: openVoice.map(formatSession),
    openPresenceSessions: openPresence.map(formatPresence),
    timestamp: live.timestamp,
    timezone: config.timezone,
    availableGuilds,
    selectedGuildId: live.selectedGuildId,
    selectedGuildName: live.selectedGuildName,
    discordConnected: live.discordConnected,
    envGuildLocked: Boolean(config.discordGuildId),
  });
});

/**
 * GET /live - Dados em tempo real para polling do dashboard.
 */
dashboardRouter.get('/live', async (ctx) => {
  ctx.body = await collectLiveSnapshot();
});

/**
 * POST /guild/select - Altera o servidor monitorado via dashboard.
 */
dashboardRouter.post('/guild/select', async (ctx) => {
  const body = ctx.request.body as { guildId?: string };
  const guildId = body.guildId?.trim();

  if (!guildId) {
    ctx.status = 400;
    ctx.body = 'guildId é obrigatório';
    return;
  }

  if (config.discordGuildId) {
    ctx.status = 403;
    ctx.body = 'Servidor fixado por DISCORD_GUILD_ID no ambiente';
    return;
  }

  try {
    const guild = await guildService.setSelectedGuildId(guildId);
    await guild.members.fetch();
    await recoverSessions(guild);
    ctx.redirect('/');
  } catch (error) {
    log.warn({ err: error, guildId }, 'Falha ao selecionar servidor');
    ctx.status = 400;
    ctx.body = error instanceof Error ? error.message : 'Erro ao selecionar servidor';
  }
});

/**
 * GET /guilds - Lista servidores conectados (JSON para integrações).
 */
dashboardRouter.get('/guilds', async (ctx) => {
  await guildService.ensureInitialized();

  ctx.body = {
    connected: checkDiscordHealth(),
    selectedGuildId: guildService.getSelectedGuildId(),
    envGuildLocked: Boolean(config.discordGuildId),
    guilds: guildService.listAvailableGuilds(),
  };
});
