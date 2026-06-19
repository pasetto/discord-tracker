import Router from '@koa/router';
import path from 'path';
import ejs from 'ejs';
import { discordClient, checkDiscordHealth } from '../../bot/client';
import { reportService } from '../../services/reportService';
import { voiceSessionRepository } from '../../repositories/voiceSessionRepository';
import { presenceSessionRepository } from '../../repositories/presenceSessionRepository';
import { IUser } from '../../db/models/User';
import { IVoiceSession } from '../../db/models/VoiceSession';
import { IPresenceSession } from '../../db/models/PresenceSession';
import { config } from '../../config/env';
import { formatDateTime } from '../../utils/timezone';

/** Rotas do dashboard web. */
export const dashboardRouter = new Router();

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
  const [dailyReport, dailyRanking, monthlyRanking, openVoice, openPresence] = await Promise.all([
    reportService.getDailyReport(today),
    reportService.getDailyRanking(today, 10),
    reportService.getMonthlyRanking(undefined, undefined, 10),
    voiceSessionRepository.findAllOpen(),
    presenceSessionRepository.findAllOpen(),
  ]);

  const onlineUsers: Array<{ username: string; displayName: string; status: string }> = [];
  const voiceUsers: Array<{ username: string; displayName: string; channelName: string }> = [];

  if (checkDiscordHealth()) {
    for (const [, guild] of discordClient.guilds.cache) {
      for (const [, presence] of guild.presences.cache) {
        const user = presence.user;
        if (!user || user.bot) continue;
        if (presence.status && presence.status !== 'offline') {
          onlineUsers.push({
            username: user.username,
            displayName: presence.member?.displayName ?? user.username,
            status: presence.status,
          });
        }
      }

      for (const [, member] of guild.members.cache) {
        if (member.user.bot || !member.voice.channel) continue;
        voiceUsers.push({
          username: member.user.username,
          displayName: member.displayName,
          channelName: member.voice.channel.name,
        });
      }
    }
  }

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
    onlineUsers,
    voiceUsers,
    dailyReport,
    dailyRanking,
    monthlyRanking,
    openVoiceSessions: openVoice.map(formatSession),
    openPresenceSessions: openPresence.map(formatPresence),
    timestamp: formatDateTime(new Date()),
    timezone: config.timezone,
  });
});
