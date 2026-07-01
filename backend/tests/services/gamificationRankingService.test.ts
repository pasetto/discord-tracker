import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GamificationSettingsModel } from '../../src/db/models/GamificationSettings';
import { OrganizationModel } from '../../src/db/models/Organization';
import { PlanModel } from '../../src/db/models/Plan';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { getGamificationRankingReport } from '../../src/services/gamificationRankingService';

describe('gamificationRankingService', () => {
  let mongod: MongoMemoryServer;
  let organizationId: string;
  let guildId = 'guild-ranking-1';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      OrganizationModel.syncIndexes(),
      PlanModel.syncIndexes(),
      GamificationSettingsModel.syncIndexes(),
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
      OrganizationModel.deleteMany({}),
      PlanModel.deleteMany({}),
      GamificationSettingsModel.deleteMany({}),
      TrackedUserModel.deleteMany({}),
    ]);

    const plan = await PlanModel.create({
      name: 'Team',
      slug: 'team-ranking-test',
      description: 'Teste',
      priceCents: 14900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: { maxGuilds: 1, maxTrackedMembers: 50, dataRetentionDays: 90 },
      features: {
        gamification: true,
        ranking: true,
        exportCsv: true,
        exportPdf: false,
        apiAccess: false,
        webhooks: false,
        customChannelRules: true,
        teamGoals: true,
        advancedReports: true,
      },
      isActive: true,
      isPublic: true,
      sortOrder: 1,
      trialDays: 7,
    });

    const organization = await OrganizationModel.create({
      name: 'Org Ranking',
      slug: 'org-ranking',
      subscription: {
        planId: plan._id,
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_test',
        status: 'active',
        currentPeriodEnd: new Date('2026-12-31'),
      },
      settings: { timezone: 'America/Sao_Paulo', memberConsentBannerEnabled: true },
    });

    organizationId = String(organization._id);

    await GamificationSettingsModel.create({
      organizationId: organization._id,
      guildId,
      enabled: true,
      ranking: {
        enabled: true,
        visibility: 'guild',
        metric: 'productive_hours',
        period: 'weekly',
        topCount: 10,
        showExactHours: true,
        anonymousMode: false,
        excludedRoleIds: [],
        includedChannelIds: [],
        teams: [],
      },
      badges: { enabled: false, presetPack: 'minimal' },
      streaks: { enabled: false, minProductiveHoursPerDay: 1 },
      teamGoals: { enabled: false },
      updatedBy: organization._id,
    });
  });

  it('retorna indisponível quando ranking está desligado nas configs', async () => {
    await GamificationSettingsModel.updateOne(
      { organizationId, guildId },
      { $set: { 'ranking.enabled': false } },
    );

    const report = await getGamificationRankingReport({
      organizationId,
      guildId,
      viewerRole: 'manager',
    });

    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/ranking não está habilitado/i);
  });

  it('retorna ranking vazio quando não há membros rastreados', async () => {
    const report = await getGamificationRankingReport({
      organizationId,
      guildId,
      viewerRole: 'manager',
    });

    expect(report.available).toBe(true);
    expect(report.entries).toEqual([]);
  });

  it('não inclui membros inativos no ranking', async () => {
    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'active-member',
        username: 'active',
        displayName: 'Active Member',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      },
      {
        organizationId,
        guildId,
        discordId: 'inactive-member',
        username: 'inactive',
        displayName: 'Inactive Member',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: false,
        removedAt: new Date(),
        removedReason: 'left_guild',
      },
    ]);

    const report = await getGamificationRankingReport({
      organizationId,
      guildId,
      viewerRole: 'manager',
    });

    expect(report.available).toBe(true);
    expect(report.entries).toHaveLength(1);
    expect(report.entries[0]?.discordId).toBe('active-member');
  });
});
