import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MemberCategoryModel } from '../../src/db/models/MemberCategory';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { User } from '../../src/db/models/User';
import { VoiceSession } from '../../src/db/models/VoiceSession';
import { CategoryGoalTemplateModel } from '../../src/db/models/CategoryGoalTemplate';
import { UserCollaborationGoalModel } from '../../src/db/models/UserCollaborationGoal';
import {
  applyAllCategoryGoalsToTrackedUsers,
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
      User.deleteMany({}),
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

  it('aplica templates de todas as categorias com membros vinculados', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const devCategoryId = new mongoose.Types.ObjectId();
    const supportCategoryId = new mongoose.Types.ObjectId();
    const setBy = new mongoose.Types.ObjectId();
    const guildId = 'guild-all';

    await CategoryGoalTemplateModel.create([
      {
        organizationId,
        guildId,
        categoryId: devCategoryId,
        weeklyCollaborationHours: 32,
        dailyMinimumHours: 5,
        setBy,
      },
      {
        organizationId,
        guildId,
        categoryId: supportCategoryId,
        weeklyCollaborationHours: 24,
        dailyMinimumHours: 4,
        setBy,
      },
    ]);

    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-dev',
        username: 'dev-user',
        displayName: 'Dev User',
        categoryId: devCategoryId,
        firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
      },
      {
        organizationId,
        guildId,
        discordId: 'd-support',
        username: 'support-user',
        displayName: 'Support User',
        categoryId: supportCategoryId,
        firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
      },
    ]);

    const result = await applyAllCategoryGoalsToTrackedUsers({
      organizationId: organizationId.toHexString(),
      guildId,
      setBy: setBy.toHexString(),
    });

    expect(result.totalMatchedTrackedUsers).toBe(2);
    expect(result.totalAppliedCount).toBe(2);
    expect(result.categories).toHaveLength(2);
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

    const coreUser = await User.create({
      discordId: 'd-3',
      username: 'gamma',
      displayName: 'Gamma',
      firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
      lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
    });

    await UserCollaborationGoalModel.create({
      organizationId,
      guildId,
      trackedUserId: trackedUser._id,
      weeklyCollaborationHours: 8,
      source: 'manual',
      setBy,
    });
    await VoiceSession.create({
      organizationId,
      guildId,
      userId: coreUser._id,
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
    expect(report.entries[0]?.weeklyGoalHours).toBeCloseTo(4.57, 2);
    expect(report.entries[0]?.categoryName).toBe('Suporte');
    expect(report.entries[0]?.realizedHours).toBe(2);
    expect(report.entries[0]?.progressPercent).toBeCloseTo(43.76, 1);
  });

  it('soma horas apenas dentro do intervalo customizado', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const guildId = 'guild-range';

    const [trackedUser] = await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-range',
        username: 'range',
        displayName: 'Range',
        firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
      },
    ]);

    const coreUser = await User.create({
      discordId: 'd-range',
      username: 'range',
      displayName: 'Range',
      firstSeenAt: new Date('2026-06-01T10:00:00.000Z'),
      lastSeenAt: new Date('2026-06-10T10:00:00.000Z'),
    });

    await UserCollaborationGoalModel.create({
      organizationId,
      guildId,
      trackedUserId: trackedUser._id,
      weeklyCollaborationHours: 7,
      source: 'manual',
      setBy: new mongoose.Types.ObjectId(),
    });

    await VoiceSession.create([
      {
        organizationId,
        guildId,
        userId: coreUser._id,
        channelId: '10',
        channelName: 'Colaboração',
        startedAt: new Date('2026-06-10T09:00:00.000Z'),
        endedAt: new Date('2026-06-10T10:00:00.000Z'),
        durationSeconds: 3600,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
      {
        organizationId,
        guildId,
        userId: coreUser._id,
        channelId: '10',
        channelName: 'Colaboração',
        startedAt: new Date('2026-06-20T09:00:00.000Z'),
        endedAt: new Date('2026-06-20T11:00:00.000Z'),
        durationSeconds: 7200,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
    ]);

    const report = await getGoalsWeeklyReport({
      organizationId: organizationId.toHexString(),
      guildId,
      from: new Date('2026-06-10T00:00:00.000Z'),
      to: new Date('2026-06-10T23:59:59.999Z'),
      referenceDate: new Date('2026-06-10T23:59:59.999Z'),
    });

    expect(report.entries[0]?.realizedHours).toBe(1);
    expect(report.entries[0]?.weeklyGoalHours).toBe(1);
  });

  it('limita sessão de voz ainda aberta ao instante atual (não soma até o fim do dia)', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const guildId = 'guild-open-session';

    const [trackedUser] = await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-open',
        username: 'open',
        displayName: 'Open',
        firstSeenAt: new Date('2026-06-10T08:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T08:00:00.000Z'),
      },
    ]);

    const coreUser = await User.create({
      discordId: 'd-open',
      username: 'open',
      displayName: 'Open',
      firstSeenAt: new Date('2026-06-10T08:00:00.000Z'),
      lastSeenAt: new Date('2026-06-10T08:00:00.000Z'),
    });

    await UserCollaborationGoalModel.create({
      organizationId,
      guildId,
      trackedUserId: trackedUser._id,
      weeklyCollaborationHours: 40,
      source: 'manual',
      setBy: new mongoose.Types.ObjectId(),
    });

    // Sessão iniciada às 09:00 e ainda aberta (endedAt null).
    await VoiceSession.create({
      organizationId,
      guildId,
      userId: coreUser._id,
      channelId: '10',
      channelName: 'Colaboração',
      startedAt: new Date('2026-06-10T09:00:00.000Z'),
      endedAt: null,
      durationSeconds: null,
      isIgnoredChannel: false,
      sessionType: 'VOICE',
    });

    const report = await getGoalsWeeklyReport({
      organizationId: organizationId.toHexString(),
      guildId,
      from: new Date('2026-06-10T00:00:00.000Z'),
      to: new Date('2026-06-10T23:59:59.999Z'),
      referenceDate: new Date('2026-06-10T23:59:59.999Z'),
      now: new Date('2026-06-10T12:00:00.000Z'),
    });

    // Deve contar apenas 09:00 → 12:00 (3h), e não até 23:59 (~15h).
    expect(report.entries[0]?.realizedHours).toBe(3);
  });

  it('isola horas realizadas por organização e guild, ignorando sessões legadas sem escopo', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const otherOrganizationId = new mongoose.Types.ObjectId();
    const guildId = 'guild-target';
    const otherGuildId = 'guild-other';

    const [trackedUser] = await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-multiguild',
        username: 'multiguild',
        displayName: 'Multi Guild',
        firstSeenAt: new Date('2026-06-10T08:00:00.000Z'),
        lastSeenAt: new Date('2026-06-10T08:00:00.000Z'),
      },
    ]);

    const coreUser = await User.create({
      discordId: 'd-multiguild',
      username: 'multiguild',
      displayName: 'Multi Guild',
      firstSeenAt: new Date('2026-06-10T08:00:00.000Z'),
      lastSeenAt: new Date('2026-06-10T08:00:00.000Z'),
    });

    await UserCollaborationGoalModel.create({
      organizationId,
      guildId,
      trackedUserId: trackedUser._id,
      weeklyCollaborationHours: 7,
      source: 'manual',
      setBy: new mongoose.Types.ObjectId(),
    });

    await VoiceSession.collection.insertMany([
      {
        organizationId,
        guildId,
        userId: coreUser._id,
        channelId: '10',
        channelName: 'Colaboração',
        startedAt: new Date('2026-06-10T09:00:00.000Z'),
        endedAt: new Date('2026-06-10T11:00:00.000Z'),
        durationSeconds: 7200,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
      {
        organizationId: otherOrganizationId,
        guildId: otherGuildId,
        userId: coreUser._id,
        channelId: '20',
        channelName: 'Outro servidor',
        startedAt: new Date('2026-06-10T12:00:00.000Z'),
        endedAt: new Date('2026-06-10T15:00:00.000Z'),
        durationSeconds: 10800,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
      {
        userId: coreUser._id,
        channelId: 'legacy',
        channelName: 'Sessão legada',
        startedAt: new Date('2026-06-10T16:00:00.000Z'),
        endedAt: new Date('2026-06-10T18:00:00.000Z'),
        durationSeconds: 7200,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
    ]);

    const report = await getGoalsWeeklyReport({
      organizationId: organizationId.toHexString(),
      guildId,
      from: new Date('2026-06-10T00:00:00.000Z'),
      to: new Date('2026-06-10T23:59:59.999Z'),
      referenceDate: new Date('2026-06-10T23:59:59.999Z'),
      now: new Date('2026-06-10T23:59:59.999Z'),
    });

    expect(report.entries[0]?.realizedHours).toBe(2);
  });
});
