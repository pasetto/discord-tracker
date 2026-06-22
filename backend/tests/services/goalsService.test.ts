import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MemberCategoryModel } from '../../src/db/models/MemberCategory';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { VoiceSession } from '../../src/db/models/VoiceSession';
import { CategoryGoalTemplateModel } from '../../src/db/models/CategoryGoalTemplate';
import { UserCollaborationGoalModel } from '../../src/db/models/UserCollaborationGoal';
import {
  applyCategoryGoalsToTrackedUsers,
  getGoalsWeeklyReport,
  shouldTriggerLowProgressThursdayAlert,
} from '../../src/services/goalsService';

describe('goalsService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      MemberCategoryModel.syncIndexes(),
      TrackedUserModel.syncIndexes(),
      VoiceSession.syncIndexes(),
      CategoryGoalTemplateModel.syncIndexes(),
      UserCollaborationGoalModel.syncIndexes(),
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
      MemberCategoryModel.deleteMany({}),
      TrackedUserModel.deleteMany({}),
      VoiceSession.deleteMany({}),
      CategoryGoalTemplateModel.deleteMany({}),
      UserCollaborationGoalModel.deleteMany({}),
    ]);
  });

  it('retorna true para alerta quando quinta e progresso abaixo de 50%', () => {
    const referenceDate = new Date('2026-06-18T13:00:00.000Z');
    expect(shouldTriggerLowProgressThursdayAlert(referenceDate, 49.99)).toBe(true);
  });

  it('retorna false para alerta quando não é quinta ou progresso >= 50%', () => {
    const friday = new Date('2026-06-19T13:00:00.000Z');
    const thursday = new Date('2026-06-18T13:00:00.000Z');

    expect(shouldTriggerLowProgressThursdayAlert(friday, 10)).toBe(false);
    expect(shouldTriggerLowProgressThursdayAlert(thursday, 50)).toBe(false);
  });

  it('aplica template de categoria para todos os membros da categoria', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();
    const setBy = new mongoose.Types.ObjectId();
    const guildId = 'guild-1';

    await MemberCategoryModel.create({
      _id: categoryId,
      organizationId,
      guildId,
      name: 'Dev',
      slug: 'dev',
    });
    await CategoryGoalTemplateModel.create({
      organizationId,
      guildId,
      categoryId,
      weeklyCollaborationHours: 32,
      dailyMinimumHours: 5,
      setBy,
    });
    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-1',
        username: 'alpha',
        displayName: 'Alpha',
        categoryId,
        firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
      },
      {
        organizationId,
        guildId,
        discordId: 'd-2',
        username: 'beta',
        displayName: 'Beta',
        categoryId,
        firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
      },
    ]);

    const result = await applyCategoryGoalsToTrackedUsers({
      organizationId: organizationId.toHexString(),
      guildId,
      categoryId: categoryId.toHexString(),
      setBy: setBy.toHexString(),
    });

    expect(result.appliedCount).toBe(2);
    const persistedGoals = await UserCollaborationGoalModel.find({ organizationId, guildId }).lean();
    expect(persistedGoals).toHaveLength(2);
    expect(persistedGoals[0]?.source).toBe('from_category_template');
    expect(persistedGoals[0]?.weeklyCollaborationHours).toBe(32);
  });

  it('retorna relatório semanal com meta, realizado e progresso', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId();
    const setBy = new mongoose.Types.ObjectId();
    const guildId = 'guild-2';

    await MemberCategoryModel.create({
      _id: categoryId,
      organizationId,
      guildId,
      name: 'Suporte',
      slug: 'suporte',
    });
    const [trackedUser] = await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-3',
        username: 'gamma',
        displayName: 'Gamma',
        categoryId,
        firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
      },
    ]);

    await UserCollaborationGoalModel.create({
      organizationId,
      guildId,
      trackedUserId: trackedUser._id,
      weeklyCollaborationHours: 8,
      source: 'manual',
      setBy,
    });
    await VoiceSession.create({
      userId: trackedUser._id,
      channelId: '10',
      channelName: 'Colaboração',
      startedAt: new Date('2026-06-16T10:00:00.000Z'),
      endedAt: new Date('2026-06-16T12:00:00.000Z'),
      durationSeconds: 2 * 60 * 60,
      isIgnoredChannel: false,
      sessionType: 'VOICE',
    });

    const report = await getGoalsWeeklyReport({
      organizationId: organizationId.toHexString(),
      guildId,
      referenceDate: new Date('2026-06-18T12:00:00.000Z'),
    });

    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.weeklyGoalHours).toBe(8);
    expect(report.entries[0]?.realizedHours).toBe(2);
    expect(report.entries[0]?.progressPercent).toBe(25);
  });
});
