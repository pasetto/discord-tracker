import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TextActivityEventModel } from '../../src/db/models/TextActivityEvent';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { getTextCollaborationReport } from '../../src/services/textCollaborationReportService';

describe('textCollaborationReportService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      TextActivityEventModel.syncIndexes(),
      TrackedUserModel.syncIndexes(),
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
      TextActivityEventModel.deleteMany({}),
      TrackedUserModel.deleteMany({}),
    ]);
  });

  it('agrega eventos por discordId com count e último sinal', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();
    const guildId = 'guild-1';

    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'u-1',
        username: 'ana',
        displayName: 'Ana',
        categoryId,
        firstSeenAt: new Date('2026-06-20T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-24T10:00:00.000Z'),
      },
      {
        organizationId,
        guildId,
        discordId: 'u-2',
        username: 'bruno',
        displayName: 'Bruno',
        firstSeenAt: new Date('2026-06-20T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-24T10:00:00.000Z'),
      },
    ]);

    await TextActivityEventModel.create([
      {
        organizationId,
        guildId,
        discordId: 'u-1',
        channelId: 'c-1',
        eventType: 'message',
        occurredAt: new Date('2026-06-24T08:00:00.000Z'),
      },
      {
        organizationId,
        guildId,
        discordId: 'u-1',
        channelId: 'c-1',
        eventType: 'reaction',
        occurredAt: new Date('2026-06-24T10:00:00.000Z'),
      },
      {
        organizationId,
        guildId,
        discordId: 'u-2',
        channelId: 'c-2',
        eventType: 'thread_reply',
        occurredAt: new Date('2026-06-24T11:00:00.000Z'),
      },
    ]);

    const report = await getTextCollaborationReport({
      organizationId: organizationId.toHexString(),
      guildId,
      from: new Date('2026-06-24T00:00:00.000Z'),
      to: new Date('2026-06-24T23:59:59.999Z'),
    });

    expect(report.entries).toHaveLength(2);
    expect(report.entries[0]).toMatchObject({
      discordId: 'u-1',
      displayName: 'Ana',
      categoryId: categoryId.toHexString(),
      eventsCount: 2,
    });
    expect(report.entries[0]?.lastOccurredAt.toISOString()).toBe('2026-06-24T10:00:00.000Z');
    expect(report.entries[1]).toMatchObject({
      discordId: 'u-2',
      displayName: 'Bruno',
      eventsCount: 1,
    });
    expect(report.entries[1]?.lastOccurredAt.toISOString()).toBe('2026-06-24T11:00:00.000Z');
    expect('content' in (report.entries[0] as object)).toBe(false);
  });

  it('não inclui eventos fora do intervalo informado', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const guildId = 'guild-2';

    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'u-1',
      username: 'ana',
      displayName: 'Ana',
      firstSeenAt: new Date('2026-06-20T10:00:00.000Z'),
      lastSeenAt: new Date('2026-06-24T10:00:00.000Z'),
    });

    await TextActivityEventModel.create([
      {
        organizationId,
        guildId,
        discordId: 'u-1',
        channelId: 'c-1',
        eventType: 'message',
        occurredAt: new Date('2026-06-23T23:59:59.000Z'),
      },
      {
        organizationId,
        guildId,
        discordId: 'u-1',
        channelId: 'c-1',
        eventType: 'reaction',
        occurredAt: new Date('2026-06-24T09:00:00.000Z'),
      },
    ]);

    const report = await getTextCollaborationReport({
      organizationId: organizationId.toHexString(),
      guildId,
      from: new Date('2026-06-24T00:00:00.000Z'),
      to: new Date('2026-06-24T23:59:59.999Z'),
    });

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.eventsCount).toBe(1);
    expect(report.entries[0]?.lastOccurredAt.toISOString()).toBe('2026-06-24T09:00:00.000Z');
  });
});
