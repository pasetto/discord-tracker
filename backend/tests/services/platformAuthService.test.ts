import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OrganizationModel } from '../../src/db/models/Organization';
import { PlanModel } from '../../src/db/models/Plan';
import { PlatformUserModel } from '../../src/db/models/PlatformUser';
import {
  hashPassword,
  registerPlatformUser,
  slugifyOrganizationName,
  verifyPassword,
} from '../../src/services/platformAuthService';

describe('platformAuthService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      OrganizationModel.syncIndexes(),
      PlanModel.syncIndexes(),
      PlatformUserModel.syncIndexes(),
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
      PlatformUserModel.deleteMany({}),
    ]);
  });

  it('cadastra usuário owner com nova organização (fluxo legado)', async () => {
    const result = await registerPlatformUser({
      email: 'owner@test.com',
      password: 'senha-segura',
      displayName: 'Owner',
      organizationName: 'Minha Empresa',
    });

    expect(result.organization?.name).toBe('Minha Empresa');
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0]?.status).toBe('active');

    const organizations = await OrganizationModel.find({}).exec();
    expect(organizations).toHaveLength(1);
  });

  it('cadastra usuário via convite sem criar organização duplicada', async () => {
    const plan = await PlanModel.create({
      name: 'Starter',
      slug: 'starter-invite',
      description: 'Plano teste',
      priceCents: 7900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: { maxGuilds: 1, maxTrackedMembers: 25, dataRetentionDays: 30 },
      features: {
        gamification: true,
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
      trialDays: 14,
    });

    const hostOrganization = await OrganizationModel.create({
      name: 'Econdos',
      slug: 'econdos',
      inviteCode: 'VB87T6AZ',
      subscription: {
        planId: plan._id,
        stripeCustomerId: 'cus_host',
        stripeSubscriptionId: 'sub_host',
        status: 'active',
        currentPeriodEnd: new Date('2026-12-31T00:00:00.000Z'),
      },
      settings: {
        timezone: 'America/Sao_Paulo',
        memberConsentBannerEnabled: true,
      },
    });

    const result = await registerPlatformUser({
      email: 'convidado@test.com',
      password: 'senha-segura',
      displayName: 'Convidado',
      inviteCode: 'VB87T6AZ',
    });

    expect(result.organization).toBeNull();
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0]).toMatchObject({
      id: String(hostOrganization._id),
      name: 'Econdos',
      status: 'pending',
      role: 'viewer',
    });

    const organizations = await OrganizationModel.find({}).exec();
    expect(organizations).toHaveLength(1);
    expect(organizations[0]?.name).toBe('Econdos');
  });

  it('rejeita cadastro com convite inválido', async () => {
    await expect(
      registerPlatformUser({
        email: 'novo@test.com',
        password: 'senha-segura',
        displayName: 'Novo',
        inviteCode: 'AB',
      }),
    ).rejects.toThrow('Informe um código de convite válido com 8 caracteres');
  });
});

describe('platformAuthService helpers', () => {
  it('normaliza slug de organização', () => {
    expect(slugifyOrganizationName('Minha Empresa!')).toBe('minha-empresa');
    expect(slugifyOrganizationName('   ')).toBe('organizacao');
  });

  it('gera hash e valida senha corretamente', async () => {
    const hash = await hashPassword('senha-segura-123');
    expect(hash).not.toBe('senha-segura-123');
    expect(await verifyPassword('senha-segura-123', hash)).toBe(true);
    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });
});
