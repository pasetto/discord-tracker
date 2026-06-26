import { Guild, GuildMember } from 'discord.js';
import { createLogger } from '../../logger';
import { voiceSessionRepository } from '../../repositories/voiceSessionRepository';
import { presenceSessionRepository } from '../../repositories/presenceSessionRepository';
import { userRepository } from '../../repositories/userRepository';
import { voiceService } from '../../services/voiceService';
import { presenceService } from '../../services/presenceService';
import { mapDiscordPresenceStatus } from '../../services/channelClassifier';
import { systemLogRepository } from '../../repositories/systemLogRepository';
import { Types } from 'mongoose';
import { resolveMonitoredGuild, type MonitoredGuildContext } from '../../services/guildMonitoringService';

const log = createLogger('recovery');

/**
 * Recupera sessões abertas após reinício do bot.
 * Fecha sessões órfãs e reabre com base no estado atual do Discord.
 * @param guild Guild monitorado
 */
export async function recoverSessions(guild: Guild): Promise<void> {
  const now = new Date();
  log.info('Iniciando recuperação de sessões...');

  const monitored = await resolveMonitoredGuild(guild.id);
  if (!monitored) {
    log.warn({ guildId: guild.id }, 'Guild não monitorado ignorado na recuperação de sessões');
    return;
  }

  const scope = {
    organizationId: new Types.ObjectId(monitored.organizationId),
    guildId: monitored.guildId,
  };

  const [openVoiceSessions, openPresenceSessions] = await Promise.all([
    voiceSessionRepository.findAllOpen(scope),
    presenceSessionRepository.findAllOpen(scope),
  ]);

  log.info(
    { openVoice: openVoiceSessions.length, openPresence: openPresenceSessions.length },
    'Sessões abertas encontradas',
  );

  // Fecha todas sessões órfãs com timestamp de reinício
  for (const session of openVoiceSessions) {
    await voiceSessionRepository.close(session._id, now);
    log.info({ sessionId: session._id, userId: session.userId }, 'Sessão de voz órfã fechada');
  }

  for (const session of openPresenceSessions) {
    await presenceSessionRepository.close(session._id, now);
    log.info({ sessionId: session._id, userId: session.userId }, 'Sessão de presença órfã fechada');
  }

  // Reabre sessões com base no estado atual do Discord
  await guild.members.fetch();

  for (const [, member] of guild.members.cache) {
    if (member.user.bot) continue;

    await reopenVoiceSession(member, now, monitored);
    await reopenPresenceSession(member, now, monitored);
  }

  await systemLogRepository.create('info', 'Recuperação de sessões concluída', 'recovery', {
    closedVoice: openVoiceSessions.length,
    closedPresence: openPresenceSessions.length,
    membersProcessed: guild.members.cache.size,
  });

  log.info('Recuperação de sessões concluída');
}

/**
 * Reabre sessão de voz se o membro está em canal.
 * @param member Membro do guild
 * @param startedAt Timestamp de início da nova sessão
 * @param monitored Contexto multitenant do guild
 */
async function reopenVoiceSession(
  member: GuildMember,
  startedAt: Date,
  monitored: MonitoredGuildContext,
): Promise<void> {
  const voiceState = member.voice;
  if (!voiceState.channel) {
    return;
  }

  const user = await userRepository.upsert({
    discordId: member.id,
    username: member.user.username,
    displayName: member.displayName,
  });

  await voiceService.startVoiceSession(
    user._id,
    voiceState.channel.id,
    voiceState.channel.name,
    startedAt,
    monitored.organizationId,
    monitored.guildId,
  );

  log.info(
    { discordId: member.id, channel: voiceState.channel.name },
    'Sessão de voz reaberta após recovery',
  );
}

/**
 * Reabre sessão de presença com status atual.
 * @param member Membro do guild
 * @param startedAt Timestamp de início
 * @param monitored Contexto multitenant do guild
 */
async function reopenPresenceSession(
  member: GuildMember,
  startedAt: Date,
  monitored: MonitoredGuildContext,
): Promise<void> {
  const user = await userRepository.upsert({
    discordId: member.id,
    username: member.user.username,
    displayName: member.displayName,
  });

  const status = mapDiscordPresenceStatus(member.presence?.status);
  await presenceService.startSession(user._id as Types.ObjectId, status, startedAt, monitored.organizationId, monitored.guildId);

  log.info({ discordId: member.id, status }, 'Sessão de presença reaberta após recovery');
}
