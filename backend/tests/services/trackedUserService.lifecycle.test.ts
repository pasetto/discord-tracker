import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import {
  deactivateTrackedUserByDiscordId,
  findActiveTrackedUsers,
  reactivateTrackedUserByDiscordId,
  syncTrackedUsersFromDiscordGuild,
} from '../../src/services/trackedUserService';

const mockGuildMembers = vi.hoisted(() => new Map<string, { id: string; user: { username: string; bot: boolean; globalName?: string }; displayName: string }>());

vi.mock('../../src/bot/client', () => ({
  discordClient: {
    guilds: {
      cache: {
        get: (guildId: string) => {
          if (guildId !== 'guild-life-1') {
            return undefined;
          }
          return {
            id: guildId,
            members: {
              cache: {
                values: () => mockGuildMembers.values(),
              },
              fetch: vi.fn().mockResolvedValue(undefined),
            },
          };
        },
      },
      fetch: vi.fn(),
    },
  },
}));

const runWithDiscordBotMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/discordClusterProxy', () => ({
  runWithDiscordBot: runWithDiscordBotMock,
}));

describe('trackedUserService lifecycle', () => {
  let mongod: MongoMemoryServer;
  const organizationId = new Types.ObjectId();
  const guildId = 'guild-life-1';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await TrackedUserModel.syncIndexes();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30000);

  beforeEach(async () => {
    await TrackedUserModel.deleteMany({});
    mockGuildMembers.clear();
    runWithDiscordBotMock.mockReset();
  });

  it('deactivateTrackedUserByDiscordId marca isActive=false e removedAt', async () => {
    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'd1',
      username: 'user1',
      displayName: 'User 1',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      isActive: true,
    });

    const result = await deactivateTrackedUserByDiscordId(String(organizationId), guildId, 'd1');
    expect(result).toBe(true);

    const doc = await TrackedUserModel.findOne({ discordId: 'd1' }).lean();
    expect(doc?.isActive).toBe(false);
    expect(doc?.removedAt).toBeInstanceOf(Date);
    expect(doc?.removedReason).toBe('left_guild');
  });

  it('reactivateTrackedUserByDiscordId restaura isActive e limpa removedAt', async () => {
    const categoryId = new Types.ObjectId();
    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'd2',
      username: 'user2',
      displayName: 'User 2',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      isActive: false,
      removedAt: new Date(),
      removedReason: 'left_guild',
      categoryId,
    });

    const result = await reactivateTrackedUserByDiscordId(String(organizationId), guildId, 'd2');
    expect(result).toBe(true);

    const doc = await TrackedUserModel.findOne({ discordId: 'd2' }).lean();
    expect(doc?.isActive).toBe(true);
    expect(doc?.removedAt).toBeUndefined();
    expect(doc?.removedReason).toBeUndefined();
    expect(String(doc?.categoryId)).toBe(String(categoryId));
  });

  it('findActiveTrackedUsers retorna somente isActive=true', async () => {
    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'active',
        username: 'a',
        displayName: 'Active',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      },
      {
        organizationId,
        guildId,
        discordId: 'inactive',
        username: 'i',
        displayName: 'Inactive',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: false,
        removedAt: new Date(),
        removedReason: 'left_guild',
      },
    ]);

    const active = await findActiveTrackedUsers(String(organizationId), guildId);
    expect(active).toHaveLength(1);
    expect(active[0].discordId).toBe('active');
  });

  it('syncTrackedUsersFromDiscordGuild desativa quem saiu e reativa quem voltou', async () => {
    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'member-a',
        username: 'a',
        displayName: 'Member A',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      },
      {
        organizationId,
        guildId,
        discordId: 'member-b',
        username: 'b',
        displayName: 'Member B',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      },
      {
        organizationId,
        guildId,
        discordId: 'member-c',
        username: 'c',
        displayName: 'Member C',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: false,
        removedAt: new Date(),
        removedReason: 'left_guild',
      },
    ]);

    mockGuildMembers.set('member-a', {
      id: 'member-a',
      user: { username: 'a', bot: false },
      displayName: 'Member A',
    });
    mockGuildMembers.set('member-c', {
      id: 'member-c',
      user: { username: 'c', bot: false },
      displayName: 'Member C',
    });

    const result = await syncTrackedUsersFromDiscordGuild(String(organizationId), guildId, {
      skipReadyCheck: true,
    });

    expect(result.syncedCount).toBe(2);
    expect(result.deactivatedCount).toBe(1);
    expect(result.reactivatedCount).toBe(0);

    const memberB = await TrackedUserModel.findOne({ discordId: 'member-b' }).lean();
    const memberC = await TrackedUserModel.findOne({ discordId: 'member-c' }).lean();
    expect(memberB?.isActive).toBe(false);
    expect(memberC?.isActive).toBe(true);
  });

  it('syncTrackedUsersFromDiscordGuild usa proxy interno em workers API-only', async () => {
    runWithDiscordBotMock.mockResolvedValue({
      members: [
        { discordId: 'proxy-member', username: 'proxy', displayName: 'Proxy Member' },
      ],
    });

    const result = await syncTrackedUsersFromDiscordGuild(String(organizationId), guildId);

    expect(runWithDiscordBotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId,
        internalPath: '/internal/discord/guilds/guild-life-1/human-members',
      }),
    );
    expect(result.syncedCount).toBe(1);

    const doc = await TrackedUserModel.findOne({ discordId: 'proxy-member' }).lean();
    expect(doc?.isActive).toBe(true);
  });
});
