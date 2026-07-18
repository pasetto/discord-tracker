import { beforeEach, describe, expect, it, vi } from 'vitest';

const organizationFindMock = vi.hoisted(() => vi.fn());
const workCalendarFindOneMock = vi.hoisted(() => vi.fn());
const listTrackedGuildIdsByOrganizationMock = vi.hoisted(() => vi.fn());
const generateWeeklyInactivitySnapshotMock = vi.hoisted(() => vi.fn());
const notifyManagersAboutMissingMembersMock = vi.hoisted(() => vi.fn());
const sendWeeklyInactivityDigestToManagersMock = vi.hoisted(() => vi.fn());
const getInactivitySettingsMock = vi.hoisted(() => vi.fn());
const enqueueWebhookDeliveriesMock = vi.hoisted(() => vi.fn());
const isBusinessDayInTimezoneMock = vi.hoisted(() => vi.fn());
const getZonedPartsMock = vi.hoisted(() => vi.fn());
const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/db/models/Organization', () => ({
  OrganizationModel: {
    find: organizationFindMock,
  },
}));

vi.mock('../../src/db/models/WorkCalendar', async () => {
  const actual = await vi.importActual<typeof import('../../src/db/models/WorkCalendar')>(
    '../../src/db/models/WorkCalendar',
  );

  return {
    ...actual,
    WorkCalendarModel: {
      findOne: workCalendarFindOneMock,
    },
  };
});

vi.mock('../../src/services/inactivityService', () => ({
  listTrackedGuildIdsByOrganization: listTrackedGuildIdsByOrganizationMock,
  generateWeeklyInactivitySnapshot: generateWeeklyInactivitySnapshotMock,
}));

vi.mock('../../src/services/pushService', () => ({
  notifyManagersAboutMissingMembers: notifyManagersAboutMissingMembersMock,
}));

vi.mock('../../src/services/emailDigestService', () => ({
  sendWeeklyInactivityDigestToManagers: sendWeeklyInactivityDigestToManagersMock,
}));

vi.mock('../../src/services/inactivitySettingsService', () => ({
  getInactivitySettings: getInactivitySettingsMock,
}));

vi.mock('../../src/services/webhookService', () => ({
  enqueueWebhookDeliveries: enqueueWebhookDeliveriesMock,
}));

vi.mock('../../src/utils/workWindowUtils', () => ({
  isBusinessDayInTimezone: isBusinessDayInTimezoneMock,
}));

vi.mock('../../src/utils/timezone', () => ({
  getZonedParts: getZonedPartsMock,
}));

vi.mock('../../src/logger', () => ({
  createLogger: vi.fn(() => ({
    info: loggerInfoMock,
    error: loggerErrorMock,
  })),
}));

import { runInactivityCronTick, startInactivityCron } from '../../src/workers/inactivityCron';

describe('inactivityCron', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('gera snapshot e notifica gestores quando há membros missing', async () => {
    organizationFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '507f1f77bcf86cd799439001',
              settings: { timezone: 'America/Sao_Paulo' },
            },
          ]),
        }),
      }),
    });

    workCalendarFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      }),
    });

    getZonedPartsMock
      .mockReturnValueOnce({ year: 2026, month: 6, day: 22, hour: 8, minute: 0 })
      .mockReturnValueOnce({ year: 2026, month: 6, day: 22, hour: 8, minute: 0 });
    isBusinessDayInTimezoneMock.mockReturnValue(true);
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    generateWeeklyInactivitySnapshotMock.mockResolvedValue({
      periodStart: new Date('2026-06-15'),
      periodEnd: new Date('2026-06-22'),
      entries: [
        { status: 'missing', discordId: '1', displayName: 'Alice', inactiveBusinessDays: 4 },
        { status: 'active', discordId: '2', displayName: 'Bob', inactiveBusinessDays: 0 },
      ],
    });
    getInactivitySettingsMock.mockResolvedValue({ notifyManagerPush: true, notifyManagerEmail: false });
    notifyManagersAboutMissingMembersMock.mockResolvedValue(undefined);
    sendWeeklyInactivityDigestToManagersMock.mockResolvedValue({ disabled: false, sent: 1, failed: 0, recipients: 1 });
    enqueueWebhookDeliveriesMock.mockResolvedValue(1);

    const generated = await runInactivityCronTick(new Date('2026-06-22T11:00:00.000Z'));

    expect(generated).toBe(1);
    expect(listTrackedGuildIdsByOrganizationMock).toHaveBeenCalledWith('507f1f77bcf86cd799439001');
    expect(notifyManagersAboutMissingMembersMock).toHaveBeenCalledWith({
      organizationId: '507f1f77bcf86cd799439001',
      guildId: 'guild-1',
      missingMembers: [{ discordId: '1', displayName: 'Alice', inactiveBusinessDays: 4 }],
    });
    expect(sendWeeklyInactivityDigestToManagersMock).not.toHaveBeenCalled();
    expect(enqueueWebhookDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '507f1f77bcf86cd799439001',
        event: 'member.inactivity.detected',
      }),
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      { snapshotsGenerated: 1 },
      'Ciclo do cron de inatividade concluído',
    );
  });

  it('envia digest por email quando notifyManagerEmail está habilitado', async () => {
    organizationFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '507f1f77bcf86cd799439001',
              settings: { timezone: 'America/Sao_Paulo' },
            },
          ]),
        }),
      }),
    });

    workCalendarFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      }),
    });

    getZonedPartsMock
      .mockReturnValueOnce({ year: 2026, month: 6, day: 24, hour: 8, minute: 0 })
      .mockReturnValueOnce({ year: 2026, month: 6, day: 24, hour: 8, minute: 0 });
    isBusinessDayInTimezoneMock.mockReturnValue(true);
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    generateWeeklyInactivitySnapshotMock.mockResolvedValue({
      periodStart: new Date('2026-06-17'),
      periodEnd: new Date('2026-06-24'),
      entries: [
        { status: 'missing', discordId: '1', displayName: 'Alice', inactiveBusinessDays: 4 },
      ],
    });
    getInactivitySettingsMock.mockResolvedValue({ notifyManagerPush: false, notifyManagerEmail: true });
    sendWeeklyInactivityDigestToManagersMock.mockResolvedValue({
      disabled: false,
      sent: 1,
      failed: 0,
      recipients: 1,
    });
    enqueueWebhookDeliveriesMock.mockResolvedValue(1);

    await runInactivityCronTick(new Date('2026-06-24T11:00:00.000Z'));

    expect(sendWeeklyInactivityDigestToManagersMock).toHaveBeenCalledWith({
      organizationId: '507f1f77bcf86cd799439001',
      guildId: 'guild-1',
      missingMembers: [{ discordId: '1', displayName: 'Alice', inactiveBusinessDays: 4 }],
      periodEnd: new Date('2026-06-24'),
    });
    expect(notifyManagersAboutMissingMembersMock).not.toHaveBeenCalled();
  });

  it('avalia dia útil na timezone da organização (não em UTC puro)', async () => {
    organizationFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '507f1f77bcf86cd799439001',
              settings: { timezone: 'Asia/Tokyo' },
            },
          ]),
        }),
      }),
    });

    workCalendarFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      }),
    });

    getZonedPartsMock.mockReturnValue({ year: 2026, month: 6, day: 22, hour: 8, minute: 0 });
    isBusinessDayInTimezoneMock.mockReturnValue(true);
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    generateWeeklyInactivitySnapshotMock.mockResolvedValue({ entries: [] });

    const now = new Date('2026-06-21T23:00:00.000Z');
    await runInactivityCronTick(now);

    expect(isBusinessDayInTimezoneMock).toHaveBeenCalledWith(
      expect.objectContaining({ workWeek: expect.any(Object) }),
      now,
      'Asia/Tokyo',
    );
  });

  it('evita reprocessar a mesma organização/guild no mesmo dia local', async () => {
    organizationFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '507f1f77bcf86cd799439001',
              settings: { timezone: 'America/Sao_Paulo' },
            },
          ]),
        }),
      }),
    });

    workCalendarFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      }),
    });

    getZonedPartsMock.mockReturnValue({ year: 2026, month: 6, day: 23, hour: 8, minute: 0 });
    isBusinessDayInTimezoneMock.mockReturnValue(true);
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    generateWeeklyInactivitySnapshotMock.mockResolvedValue({
      entries: [{ status: 'active', discordId: '2', displayName: 'Bob', inactiveBusinessDays: 0 }],
    });

    const first = await runInactivityCronTick(new Date('2026-06-23T11:00:00.000Z'));
    const second = await runInactivityCronTick(new Date('2026-06-23T11:30:00.000Z'));

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(generateWeeklyInactivitySnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('inicia cron em intervalo de 1 minuto e registra erro de execução', async () => {
    vi.useFakeTimers();
    organizationFindMock.mockImplementation(() => {
      throw new Error('cron failed');
    });

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const stop = startInactivityCron();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(loggerErrorMock).toHaveBeenCalled();

    stop();
    setIntervalSpy.mockRestore();
  });
});
