import Router from '@koa/router';
import { checkDiscordHealth } from '../../bot/client';
import { userRepository } from '../../repositories/userRepository';
import { voiceSessionRepository } from '../../repositories/voiceSessionRepository';
import { presenceSessionRepository } from '../../repositories/presenceSessionRepository';
import { guildService } from '../../services/guildService';
/** Rotas de estatísticas em tempo real. */
export const statsRouter = new Router();

/**
 * GET /stats - Estatísticas gerais do sistema.
 */
statsRouter.get('/stats', async (ctx) => {
  const [totalUsers, activeSessions, openPresenceSessions] = await Promise.all([
    userRepository.countAll(),
    voiceSessionRepository.countOpen(),
    presenceSessionRepository.countOpen(),
  ]);

  let onlineUsers = 0;
  let voiceUsers = 0;

  if (checkDiscordHealth()) {
    const guild = guildService.getTargetGuild();
    if (guild) {
      onlineUsers += guild.presences.cache.filter(
        (p) => p.status !== 'offline' && p.status !== 'invisible' && !p.user?.bot,
      ).size;

      voiceUsers += guild.members.cache.filter(
        (m) => m.voice.channelId && !m.user.bot,
      ).size;
    }
  }

  ctx.body = {
    totalUsers,
    onlineUsers,
    voiceUsers,
    activeSessions,
    openPresenceSessions,
  };
});
