import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OrganizationModel } from '../../src/db/models/Organization';
import { PlanModel } from '../../src/db/models/Plan';
import { PresenceSession } from '../../src/db/models/PresenceSession';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import { User } from '../../src/db/models/User';
import {
  computeDailyJourney,
  getMemberJourneyReport,
  listCivilDays,
  minutesToLabel,
  summarizeWeekdayPatterns,
  weekdayOfCivilDate,
  type MemberJourneyDay,
} from '../../src/services/memberJourneyService';

const SAO_PAULO = 'America/Sao_Paulo';

describe('memberJourneyService (helpers puros)', () => {
  it('formata minutos como HH:MM', () => {
    expect(minutesToLabel(570)).toBe('09:30');
    expect(minutesToLabel(0)).toBe('00:00');
    expect(minutesToLabel(1439)).toBe('23:59');
    expect(minutesToLabel(1440)).toBe('24:00');
  });

  it('determina o dia da semana de uma data civil', () => {
    expect(weekdayOfCivilDate('2026-06-22')).toBe(1); // segunda
    expect(weekdayOfCivilDate('2026-06-24')).toBe(3); // quarta
  });

  it('lista os dias civis do período na timezone', () => {
    const days = listCivilDays(
      new Date('2026-06-22T03:00:00.000Z'),
      new Date('2026-06-25T02:59:59.999Z'),
      SAO_PAULO,
    );
    expect(days).toEqual(['2026-06-22', '2026-06-23', '2026-06-24']);
  });

  it('calcula entrada e saída por dia (sessão dentro do mesmo dia)', () => {
    // 09:30 → 18:00 em São Paulo (UTC-3) = 12:30 → 21:00 UTC.
    const result = computeDailyJourney(
      [{ startedAt: new Date('2026-06-22T12:30:00.000Z'), endedAt: new Date('2026-06-22T21:00:00.000Z') }],
      new Date('2026-06-22T03:00:00.000Z'),
      new Date('2026-06-23T02:59:59.999Z'),
      SAO_PAULO,
    );

    const day = result.get('2026-06-22');
    expect(day?.entry).toBe(9 * 60 + 30);
    expect(day?.exit).toBe(18 * 60);
  });

  it('divide sessão que cruza a meia-noite local em dois dias', () => {
    // 23:00 dia 22 → 01:00 dia 23 (São Paulo) = 02:00Z dia 23 → 04:00Z dia 23.
    const result = computeDailyJourney(
      [{ startedAt: new Date('2026-06-23T02:00:00.000Z'), endedAt: new Date('2026-06-23T04:00:00.000Z') }],
      new Date('2026-06-22T03:00:00.000Z'),
      new Date('2026-06-24T02:59:59.999Z'),
      SAO_PAULO,
    );

    expect(result.get('2026-06-22')).toEqual({ entry: 23 * 60, exit: 24 * 60 });
    expect(result.get('2026-06-23')).toEqual({ entry: 0, exit: 60 });
  });

  it('usa o primeiro e o último sinal quando há várias sessões no dia', () => {
    const result = computeDailyJourney(
      [
        { startedAt: new Date('2026-06-22T12:30:00.000Z'), endedAt: new Date('2026-06-22T14:00:00.000Z') },
        { startedAt: new Date('2026-06-22T17:00:00.000Z'), endedAt: new Date('2026-06-22T21:00:00.000Z') },
      ],
      new Date('2026-06-22T03:00:00.000Z'),
      new Date('2026-06-23T02:59:59.999Z'),
      SAO_PAULO,
    );

    const day = result.get('2026-06-22');
    expect(day?.entry).toBe(9 * 60 + 30); // primeira entrada
    expect(day?.exit).toBe(18 * 60); // última saída
  });

  it('agrega padrões por dia da semana com média e variabilidade', () => {
    const days: MemberJourneyDay[] = [
      buildDay('2026-06-22', 1, 9 * 60, 18 * 60), // segunda 09:00
      buildDay('2026-06-29', 1, 9 * 60 + 30, 18 * 60), // segunda 09:30
      buildDay('2026-06-24', 3, 11 * 60, 19 * 60), // quarta 11:00
    ];

    const patterns = summarizeWeekdayPatterns(days);
    const monday = patterns.find((pattern) => pattern.weekday === 1);
    const wednesday = patterns.find((pattern) => pattern.weekday === 3);

    expect(monday?.sampleDays).toBe(2);
    expect(monday?.avgEntryMinute).toBe(9 * 60 + 15); // média 09:15
    expect(monday?.entrySpreadMinutes).toBe(30);
    expect(wednesday?.avgEntryLabel).toBe('11:00');
  });
});

/**
 * Cria um dia de jornada para os testes de agregação.
 */
function buildDay(date: string, weekday: number, entry: number, exit: number): MemberJourneyDay {
  return {
    date,
    weekday,
    hasActivity: true,
    entryMinute: entry,
    exitMinute: exit,
    entryLabel: minutesToLabel(entry),
    exitLabel: minutesToLabel(exit),
    spanMinutes: exit - entry,
  };
}

describe('memberJourneyService (integração)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([
      OrganizationModel.syncIndexes(),
      PlanModel.syncIndexes(),
      TrackedUserModel.syncIndexes(),
      PresenceSession.syncIndexes(),
      User.syncIndexes(),
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
      TrackedUserModel.deleteMany({}),
      PresenceSession.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  /**
   * Cria organização mínima com timezone configurada.
   */
  async function createOrganization(timezone: string): Promise<mongoose.Types.ObjectId> {
    const plan = await PlanModel.create({
      name: 'Starter',
      slug: `starter-${new mongoose.Types.ObjectId().toHexString()}`,
      description: 'Plano teste',
      priceCents: 0,
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

    const organization = await OrganizationModel.create({
      name: 'Org Journey',
      slug: `org-journey-${new mongoose.Types.ObjectId().toHexString()}`,
      subscription: {
        planId: plan._id,
        stripeCustomerId: 'cus_journey',
        stripeSubscriptionId: 'sub_journey',
        status: 'active',
        currentPeriodEnd: new Date('2026-12-31T00:00:00.000Z'),
      },
      settings: { timezone, memberConsentBannerEnabled: true },
    });

    return organization._id as mongoose.Types.ObjectId;
  }

  it('monta relatório de jornada por presença na timezone da organização', async () => {
    const organizationId = await createOrganization(SAO_PAULO);
    const guildId = 'guild-journey';

    const [trackedUser] = await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-journey',
        username: 'journey',
        displayName: 'Journey',
        firstSeenAt: new Date('2026-06-22T00:00:00.000Z'),
        lastSeenAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ]);

    const coreUser = await User.create({
      discordId: 'd-journey',
      username: 'journey',
      displayName: 'Journey',
      firstSeenAt: new Date('2026-06-22T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-24T00:00:00.000Z'),
    });

    await PresenceSession.create([
      // Segunda: 09:30 → 18:00 local (UTC-3)
      {
        organizationId,
        guildId,
        userId: coreUser._id,
        status: 'ONLINE',
        startedAt: new Date('2026-06-22T12:30:00.000Z'),
        endedAt: new Date('2026-06-22T21:00:00.000Z'),
        durationSeconds: 8.5 * 3600,
      },
      // Quarta: 11:00 → 19:00 local
      {
        organizationId,
        guildId,
        userId: coreUser._id,
        status: 'ONLINE',
        startedAt: new Date('2026-06-24T14:00:00.000Z'),
        endedAt: new Date('2026-06-24T22:00:00.000Z'),
        durationSeconds: 8 * 3600,
      },
    ]);

    const report = await getMemberJourneyReport({
      organizationId: organizationId.toHexString(),
      guildId,
      trackedUserId: String(trackedUser._id),
      signal: 'presence',
      from: new Date('2026-06-22T00:00:00.000Z'),
      to: new Date('2026-06-24T23:59:59.999Z'),
      now: new Date('2026-06-25T12:00:00.000Z'),
    });

    expect(report.timezone).toBe(SAO_PAULO);
    expect(report.days).toHaveLength(3);

    const monday = report.days.find((day) => day.date === '2026-06-22');
    const tuesday = report.days.find((day) => day.date === '2026-06-23');
    const wednesday = report.days.find((day) => day.date === '2026-06-24');

    expect(monday?.entryLabel).toBe('09:30');
    expect(monday?.exitLabel).toBe('18:00');
    expect(tuesday?.hasActivity).toBe(false);
    expect(wednesday?.entryLabel).toBe('11:00');

    expect(report.summary.daysWithActivity).toBe(2);
  });

  it('isola jornada por organização e guild, ignorando sessões legadas sem escopo', async () => {
    const organizationId = await createOrganization(SAO_PAULO);
    const otherOrganizationId = await createOrganization(SAO_PAULO);
    const guildId = 'guild-target';
    const otherGuildId = 'guild-other';

    const [trackedUser] = await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'd-same-user',
        username: 'same-user',
        displayName: 'Same User',
        firstSeenAt: new Date('2026-06-22T00:00:00.000Z'),
        lastSeenAt: new Date('2026-06-22T00:00:00.000Z'),
      },
    ]);

    const coreUser = await User.create({
      discordId: 'd-same-user',
      username: 'same-user',
      displayName: 'Same User',
      firstSeenAt: new Date('2026-06-22T00:00:00.000Z'),
      lastSeenAt: new Date('2026-06-22T00:00:00.000Z'),
    });

    await PresenceSession.collection.insertMany([
      {
        organizationId,
        guildId,
        userId: coreUser._id,
        status: 'ONLINE',
        startedAt: new Date('2026-06-22T12:00:00.000Z'), // 09:00 local
        endedAt: new Date('2026-06-22T13:00:00.000Z'), // 10:00 local
        durationSeconds: 3600,
      },
      {
        organizationId: otherOrganizationId,
        guildId: otherGuildId,
        userId: coreUser._id,
        status: 'ONLINE',
        startedAt: new Date('2026-06-22T18:00:00.000Z'), // 15:00 local
        endedAt: new Date('2026-06-22T21:00:00.000Z'), // 18:00 local
        durationSeconds: 10800,
      },
      {
        userId: coreUser._id,
        status: 'ONLINE',
        startedAt: new Date('2026-06-22T22:00:00.000Z'), // 19:00 local
        endedAt: new Date('2026-06-22T23:00:00.000Z'), // 20:00 local
        durationSeconds: 3600,
      },
    ]);

    const report = await getMemberJourneyReport({
      organizationId: organizationId.toHexString(),
      guildId,
      trackedUserId: String(trackedUser._id),
      signal: 'presence',
      from: new Date('2026-06-22T00:00:00.000Z'),
      to: new Date('2026-06-22T23:59:59.999Z'),
      now: new Date('2026-06-23T12:00:00.000Z'),
    });

    expect(report.days[0]?.entryLabel).toBe('09:00');
    expect(report.days[0]?.exitLabel).toBe('10:00');
  });

  it('lança erro quando o colaborador não pertence à organização', async () => {
    const organizationId = await createOrganization(SAO_PAULO);
    await expect(
      getMemberJourneyReport({
        organizationId: organizationId.toHexString(),
        guildId: 'guild-x',
        trackedUserId: new mongoose.Types.ObjectId().toHexString(),
      }),
    ).rejects.toThrow('Colaborador não encontrado');
  });
});
