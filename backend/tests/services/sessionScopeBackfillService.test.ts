import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PresenceSession } from '../../src/db/models/PresenceSession';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { User } from '../../src/db/models/User';
import { VoiceSession } from '../../src/db/models/VoiceSession';
import {
  backfillSessionScopes,
  resolveUniqueScope,
} from '../../src/services/sessionScopeBackfillService';

describe('sessionScopeBackfillService (resolveUniqueScope)', () => {
  const orgA = new mongoose.Types.ObjectId();
  const orgB = new mongoose.Types.ObjectId();

  it('retorna "none" quando não há vínculo de rastreio', () => {
    expect(resolveUniqueScope([])).toEqual({ reason: 'none' });
  });

  it('retorna escopo único quando há apenas uma guild', () => {
    const decision = resolveUniqueScope([{ organizationId: orgA, guildId: '111' }]);
    expect(decision).toEqual({ reason: 'ok', scope: { organizationId: orgA, guildId: '111' } });
  });

  it('deduplica vínculos repetidos da mesma guild', () => {
    const decision = resolveUniqueScope([
      { organizationId: orgA, guildId: '111' },
      { organizationId: orgA, guildId: '111' },
    ]);
    expect(decision.reason).toBe('ok');
  });

  it('retorna "ambiguous" quando o usuário aparece em guilds diferentes', () => {
    const decision = resolveUniqueScope([
      { organizationId: orgA, guildId: '111' },
      { organizationId: orgB, guildId: '222' },
    ]);
    expect(decision).toEqual({ reason: 'ambiguous' });
  });
});

describe('sessionScopeBackfillService (integração)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      TrackedUserModel.syncIndexes(),
      User.syncIndexes(),
      VoiceSession.syncIndexes(),
      PresenceSession.syncIndexes(),
    ]);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await Promise.all([
      TrackedUserModel.deleteMany({}),
      User.deleteMany({}),
      VoiceSession.deleteMany({}),
      PresenceSession.deleteMany({}),
    ]);
  });

  const organizationId = new mongoose.Types.ObjectId();
  const guildId = '760947968261095435';

  /**
   * Cria usuário core + vínculo de rastreio em uma guild.
   * @param discordId Id Discord do usuário
   * @returns Id do usuário core criado
   */
  async function createTrackedUser(discordId: string): Promise<mongoose.Types.ObjectId> {
    const user = await User.create({
      discordId,
      username: `user-${discordId}`,
      displayName: `User ${discordId}`,
      firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId,
      username: `user-${discordId}`,
      displayName: `User ${discordId}`,
      firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    return user._id as mongoose.Types.ObjectId;
  }

  it('preenche org/guild em sessões legadas de voz e presença', async () => {
    const userId = await createTrackedUser('discord-1');

    await VoiceSession.create({
      userId,
      channelId: 'chan-1',
      channelName: 'Sala',
      startedAt: new Date('2026-06-10T12:00:00.000Z'),
      endedAt: new Date('2026-06-10T13:00:00.000Z'),
      durationSeconds: 3600,
      isIgnoredChannel: false,
      sessionType: 'VOICE',
    });
    await PresenceSession.create({
      userId,
      status: 'ONLINE',
      startedAt: new Date('2026-06-10T12:00:00.000Z'),
      endedAt: new Date('2026-06-10T13:00:00.000Z'),
      durationSeconds: 3600,
    });

    const results = await backfillSessionScopes({ apply: true });

    const voiceResult = results.find((r) => r.collection === 'voicesessions');
    expect(voiceResult?.updated).toBe(1);

    const voice = await VoiceSession.findOne({ userId }).lean().exec();
    expect(String(voice?.organizationId)).toBe(String(organizationId));
    expect(voice?.guildId).toBe(guildId);

    const presence = await PresenceSession.findOne({ userId }).lean().exec();
    expect(String(presence?.organizationId)).toBe(String(organizationId));
    expect(presence?.guildId).toBe(guildId);
  });

  it('não grava nada em dry-run, apenas conta', async () => {
    const userId = await createTrackedUser('discord-1');
    await VoiceSession.create({
      userId,
      channelId: 'chan-1',
      channelName: 'Sala',
      startedAt: new Date('2026-06-10T12:00:00.000Z'),
      endedAt: new Date('2026-06-10T13:00:00.000Z'),
      durationSeconds: 3600,
      isIgnoredChannel: false,
      sessionType: 'VOICE',
    });

    const results = await backfillSessionScopes({ apply: false });
    const voiceResult = results.find((r) => r.collection === 'voicesessions');
    expect(voiceResult?.updated).toBe(1);

    const voice = await VoiceSession.findOne({ userId }).lean().exec();
    expect(voice?.organizationId).toBeUndefined();
    expect(voice?.guildId).toBeUndefined();
  });

  it('é idempotente: não toca sessões que já têm escopo', async () => {
    const userId = await createTrackedUser('discord-1');
    const outraGuild = '999999999999999999';
    await VoiceSession.create({
      organizationId,
      guildId: outraGuild,
      userId,
      channelId: 'chan-1',
      channelName: 'Sala',
      startedAt: new Date('2026-06-10T12:00:00.000Z'),
      endedAt: new Date('2026-06-10T13:00:00.000Z'),
      durationSeconds: 3600,
      isIgnoredChannel: false,
      sessionType: 'VOICE',
    });

    const results = await backfillSessionScopes({ apply: true });
    const voiceResult = results.find((r) => r.collection === 'voicesessions');
    expect(voiceResult?.totalLegacy).toBe(0);
    expect(voiceResult?.updated).toBe(0);

    const voice = await VoiceSession.findOne({ userId }).lean().exec();
    expect(voice?.guildId).toBe(outraGuild);
  });

  it('descarta sessão de usuário sem rastreio (skippedNoTracking)', async () => {
    const user = await User.create({
      discordId: 'sem-tracking',
      username: 'ghost',
      displayName: 'Ghost',
      firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    await PresenceSession.create({
      userId: user._id,
      status: 'ONLINE',
      startedAt: new Date('2026-06-10T12:00:00.000Z'),
      endedAt: new Date('2026-06-10T13:00:00.000Z'),
      durationSeconds: 3600,
    });

    const results = await backfillSessionScopes({ apply: true });
    const presenceResult = results.find((r) => r.collection === 'presencesessions');
    expect(presenceResult?.updated).toBe(0);
    expect(presenceResult?.skippedNoTracking).toBe(1);
  });

  it('descarta sessão ambígua quando usuário está em múltiplas guilds', async () => {
    const userId = await createTrackedUser('discord-multi');
    await TrackedUserModel.create({
      organizationId,
      guildId: '222222222222222222',
      discordId: 'discord-multi',
      username: 'user-multi',
      displayName: 'User Multi',
      firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    await PresenceSession.create({
      userId,
      status: 'ONLINE',
      startedAt: new Date('2026-06-10T12:00:00.000Z'),
      endedAt: new Date('2026-06-10T13:00:00.000Z'),
      durationSeconds: 3600,
    });

    const results = await backfillSessionScopes({ apply: true });
    const presenceResult = results.find((r) => r.collection === 'presencesessions');
    expect(presenceResult?.updated).toBe(0);
    expect(presenceResult?.skippedAmbiguous).toBe(1);
  });
});
