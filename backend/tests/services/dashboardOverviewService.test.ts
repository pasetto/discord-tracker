import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DailyReport } from '../../src/db/models/DailyReport';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { User } from '../../src/db/models/User';
import { VoiceSession } from '../../src/db/models/VoiceSession';
import { VoiceChannelTransitionModel } from '../../src/db/models/VoiceChannelTransition';
import { WorkCalendarModel, createDefaultWorkWeek } from '../../src/db/models/WorkCalendar';
import { getGuildDashboardOverview } from '../../src/services/dashboardOverviewService';
import { zonedDateTimeToUtc } from '../../src/utils/timezone';

describe('dashboardOverviewService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      DailyReport.syncIndexes(),
      TrackedUserModel.syncIndexes(),
      User.syncIndexes(),
      VoiceSession.syncIndexes(),
      VoiceChannelTransitionModel.syncIndexes(),
      WorkCalendarModel.syncIndexes(),
    ]);
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await Promise.all([
      DailyReport.deleteMany({}),
      TrackedUserModel.deleteMany({}),
      User.deleteMany({}),
      VoiceSession.deleteMany({}),
      VoiceChannelTransitionModel.deleteMany({}),
      WorkCalendarModel.deleteMany({}),
    ]);
  });

  it('agrega DailyReport dos membros rastreados nos últimos 7 dias', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const guildId = 'guild-overview-1';
    const now = new Date('2026-07-02T15:00:00.000Z');

    const updatedBy = new mongoose.Types.ObjectId();

    await WorkCalendarModel.create({
      organizationId,
      guildId,
      timezone: 'America/Sao_Paulo',
      workWeek: createDefaultWorkWeek(),
      updatedBy,
    });

    const coreUser = await User.create({
      discordId: 'discord-1',
      username: 'alpha',
      displayName: 'Alpha',
      firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
      lastSeenAt: now,
    });

    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'discord-1',
      username: 'alpha',
      displayName: 'Alpha',
      firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
      lastSeenAt: now,
      isActive: true,
    });

    await DailyReport.create({
      userId: coreUser._id,
      date: zonedDateTimeToUtc(2026, 7, 1, 0, 0, 0, 'America/Sao_Paulo'),
      productiveSeconds: 7200,
      voiceSeconds: 9000,
      idleSeconds: 0,
      offlineSeconds: 0,
      afkSeconds: 0,
      lunchSeconds: 0,
    });

    await VoiceChannelTransitionModel.create({
      organizationId,
      guildId,
      userId: coreUser._id,
      discordId: 'discord-1',
      displayName: 'Alpha',
      eventType: 'JOIN',
      toChannelName: 'Squad',
      fromIgnored: false,
      toIgnored: false,
      countsAsCollaboration: true,
      occurredAt: new Date('2026-07-02T14:00:00.000Z'),
    });

    const overview = await getGuildDashboardOverview(String(organizationId), guildId, now);

    expect(overview.trackedMembersCount).toBe(1);
    expect(overview.dailyCollaboration).toHaveLength(7);
    expect(overview.dailyCollaboration.some((point) => point.collaborationHours === 2)).toBe(true);
    expect(overview.weeklyAverageHours).toBeGreaterThan(0);
    expect(overview.heatmap.some((cell) => cell.eventCount > 0)).toBe(true);
    expect(overview.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(overview.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('usa VoiceSession como fallback quando DailyReport do dia não existe', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const guildId = 'guild-overview-2';
    const now = new Date('2026-07-02T16:00:00.000Z');

    const updatedBy = new mongoose.Types.ObjectId();

    await WorkCalendarModel.create({
      organizationId,
      guildId,
      timezone: 'America/Sao_Paulo',
      workWeek: createDefaultWorkWeek(),
      updatedBy,
    });

    const coreUser = await User.create({
      discordId: 'discord-2',
      username: 'beta',
      displayName: 'Beta',
      firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
      lastSeenAt: now,
    });

    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'discord-2',
      username: 'beta',
      displayName: 'Beta',
      firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
      lastSeenAt: now,
      isActive: true,
    });

    await VoiceSession.create({
      organizationId,
      guildId,
      userId: coreUser._id,
      channelId: 'ch-1',
      channelName: 'Dev',
      startedAt: new Date('2026-07-02T13:00:00.000Z'),
      endedAt: new Date('2026-07-02T15:00:00.000Z'),
      durationSeconds: 7200,
      isIgnoredChannel: false,
      sessionType: 'VOICE',
    });

    const overview = await getGuildDashboardOverview(String(organizationId), guildId, now);
    const today = overview.dailyCollaboration[overview.dailyCollaboration.length - 1];

    expect(today.collaborationHours).toBe(2);
  });
});
