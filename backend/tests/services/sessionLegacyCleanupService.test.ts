import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PresenceSession } from '../../src/db/models/PresenceSession';
import { VoiceSession } from '../../src/db/models/VoiceSession';
import {
  buildSessionGroupKey,
  cleanupDuplicateOpenVoiceSessions,
  eachCalendarDayInRange,
  resolveDuplicateSessionEnd,
} from '../../src/services/sessionLegacyCleanupService';

describe('sessionLegacyCleanupService (helpers)', () => {
  const userId = new mongoose.Types.ObjectId();
  const orgId = new mongoose.Types.ObjectId();

  it('agrupa sessões por usuário + org + guild', () => {
    const key = buildSessionGroupKey(userId, orgId, 'guild-1');
    expect(key).toBe(`${String(userId)}:${String(orgId)}:guild-1`);
  });

  it('usa placeholders quando org/guild estão ausentes (legado)', () => {
    const key = buildSessionGroupKey(userId, null, null);
    expect(key).toBe(`${String(userId)}:_:_`);
  });

  it('fecha a sessão órfã no instante em que a próxima começou', () => {
    const startedAt = new Date('2026-06-10T10:00:00.000Z');
    const nextStartedAt = new Date('2026-06-10T10:05:00.000Z');
    expect(resolveDuplicateSessionEnd(startedAt, nextStartedAt)).toEqual(nextStartedAt);
  });

  it('itera dias civis inclusivos no intervalo', () => {
    const days = [...eachCalendarDayInRange(new Date('2026-06-28T15:00:00.000Z'), new Date('2026-06-30T08:00:00.000Z'))];
    expect(days).toHaveLength(3);
  });
});

describe('sessionLegacyCleanupService (integração)', () => {
  let mongod: MongoMemoryServer;
  const organizationId = new mongoose.Types.ObjectId();
  const guildId = 'guild-legacy';
  const userId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([VoiceSession.syncIndexes(), PresenceSession.syncIndexes()]);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await Promise.all([VoiceSession.deleteMany({}), PresenceSession.deleteMany({})]);
  });

  it('fecha sessões de voz abertas duplicadas mantendo só a mais recente', async () => {
    const t1 = new Date('2026-06-10T10:00:00.000Z');
    const t2 = new Date('2026-06-10T10:05:00.000Z');
    const t3 = new Date('2026-06-10T10:10:00.000Z');

    await VoiceSession.create([
      {
        organizationId,
        guildId,
        userId,
        channelId: 'c1',
        channelName: 'Sala 1',
        startedAt: t1,
        endedAt: null,
        durationSeconds: null,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
      {
        organizationId,
        guildId,
        userId,
        channelId: 'c2',
        channelName: 'Sala 2',
        startedAt: t2,
        endedAt: null,
        durationSeconds: null,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
      {
        organizationId,
        guildId,
        userId,
        channelId: 'c3',
        channelName: 'Sala 3',
        startedAt: t3,
        endedAt: null,
        durationSeconds: null,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
    ]);

    const dryRun = await cleanupDuplicateOpenVoiceSessions({ apply: false });
    expect(dryRun.groupsWithDuplicates).toBe(1);
    expect(dryRun.sessionsClosed).toBe(2);
    expect(dryRun.sessionsKeptOpen).toBe(1);

    await cleanupDuplicateOpenVoiceSessions({ apply: true, organizationId: String(organizationId), guildId });

    const sessions = await VoiceSession.find({ userId }).sort({ startedAt: 1 }).lean().exec();
    expect(sessions).toHaveLength(3);
    expect(sessions[0]?.endedAt).toEqual(t2);
    expect(sessions[0]?.durationSeconds).toBe(300);
    expect(sessions[1]?.endedAt).toEqual(t3);
    expect(sessions[1]?.durationSeconds).toBe(300);
    expect(sessions[2]?.endedAt).toBeNull();
  });
});
