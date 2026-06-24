import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';

describe('TrackedUser indexes', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await TrackedUserModel.syncIndexes();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  it('rejeita duplicate organizationId+guildId+discordId', async () => {
    const base = {
      organizationId: new mongoose.Types.ObjectId(),
      guildId: 'g1',
      discordId: 'd1',
      username: 'u',
      displayName: 'U',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    };

    await TrackedUserModel.create(base);
    await expect(TrackedUserModel.create(base)).rejects.toThrow();
  });
});
