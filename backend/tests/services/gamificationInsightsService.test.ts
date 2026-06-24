import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GamificationSettingsModel } from '../../src/db/models/GamificationSettings';
import { OrganizationModel } from '../../src/db/models/Organization';
import { PlanModel } from '../../src/db/models/Plan';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { getGuildGamificationInsights } from '../../src/services/gamificationInsightsService';

describe('gamificationInsightsService', () => {
  let mongod: MongoMemoryServer;
  let organizationId: string;
  const guildId = 'guild-insights-1';

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
      slug: 'team-insights',
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
      name: 'Org Insights',
      slug: 'org-insights',
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
      badges: { enabled: true, presetPack: 'minimal' },
      streaks: { enabled: true, minProductiveHoursPerDay: 1 },
      teamGoals: { enabled: false },
      updatedBy: organization._id,
    });
  });

  it('retorna indisponível quando badges e streaks estão desligados', async () => {
    await GamificationSettingsModel.updateOne(
      { organizationId, guildId },
      { $set: { 'badges.enabled': false, 'streaks.enabled': false } },
    );

    const result = await getGuildGamificationInsights({ organizationId, guildId });
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/desabilitados/i);
  });

  it('retorna membros com estrutura de insights', async () => {
    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'discord-1',
      username: 'ana',
      displayName: 'Ana',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });

    const result = await getGuildGamificationInsights({ organizationId, guildId });
    expect(result.available).toBe(true);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].displayName).toBe('Ana');
    expect(result.members[0].streak.enabled).toBe(true);
  });
});
