import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OrganizationModel } from '../../src/db/models/Organization';
import { PlanModel } from '../../src/db/models/Plan';
import { upsertGamificationSettings } from '../../src/services/gamificationService';

describe('gamificationService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([OrganizationModel.syncIndexes(), PlanModel.syncIndexes()]);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await Promise.all([OrganizationModel.deleteMany({}), PlanModel.deleteMany({})]);
  });

  it('rejeita upsert quando plano não permite gamificação', async () => {
    const plan = await PlanModel.create({
      name: 'Starter',
      slug: 'starter-gamification-off',
      description: 'Plano sem gamificação',
      priceCents: 7900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: {
        maxGuilds: 1,
        maxTrackedMembers: 25,
        dataRetentionDays: 30,
      },
      features: {
        gamification: false,
        ranking: false,
        exportCsv: false,
        exportPdf: false,
        apiAccess: false,
        webhooks: false,
        customChannelRules: true,
        teamGoals: false,
        advancedReports: false,
      },
      isActive: true,
      isPublic: true,
      sortOrder: 1,
      trialDays: 7,
    });

    const organization = await OrganizationModel.create({
      name: 'Org sem gamificação',
      slug: 'org-sem-gamificacao',
      subscription: {
        planId: plan._id,
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_test',
        status: 'active',
        currentPeriodEnd: new Date('2026-12-31T00:00:00.000Z'),
      },
      settings: {
        timezone: 'America/Sao_Paulo',
        memberConsentBannerEnabled: true,
      },
    });

    await expect(
      upsertGamificationSettings({
        organizationId: organization._id.toHexString(),
        guildId: 'guild-1',
        updatedBy: new mongoose.Types.ObjectId().toHexString(),
        patch: {
          enabled: true,
        },
      }),
    ).rejects.toThrow(/gamificação não está disponível para o plano atual/i);
  });
});
