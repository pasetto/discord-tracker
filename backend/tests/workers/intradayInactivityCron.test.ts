import { beforeEach, describe, expect, it, vi } from 'vitest';

const organizationFindMock = vi.hoisted(() => vi.fn());
const listTrackedGuildIdsByOrganizationMock = vi.hoisted(() => vi.fn());
const getIntradayInactivityReportMock = vi.hoisted(() => vi.fn());
const getInactivitySettingsMock = vi.hoisted(() => vi.fn());
const notifyManagersAboutIntradayConcernsMock = vi.hoisted(() => vi.fn());
const enqueueWebhookDeliveriesMock = vi.hoisted(() => vi.fn());
const intradayAlertDispatchUpdateOneMock = vi.hoisted(() => vi.fn());
const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());
const getZonedPartsMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/db/models/Organization', () => ({
  OrganizationModel: {
    find: organizationFindMock,
  },
}));

vi.mock('../../src/services/inactivityService', () => ({
  listTrackedGuildIdsByOrganization: listTrackedGuildIdsByOrganizationMock,
}));

vi.mock('../../src/services/intradayInactivityService', () => ({
  getIntradayInactivityReport: getIntradayInactivityReportMock,
}));

vi.mock('../../src/services/inactivitySettingsService', () => ({
  getInactivitySettings: getInactivitySettingsMock,
}));

vi.mock('../../src/services/pushService', () => ({
  notifyManagersAboutIntradayConcerns: notifyManagersAboutIntradayConcernsMock,
}));

vi.mock('../../src/services/webhookService', () => ({
  enqueueWebhookDeliveries: enqueueWebhookDeliveriesMock,
}));

vi.mock('../../src/db/models/IntradayAlertDispatch', () => ({
  IntradayAlertDispatchModel: {
    updateOne: intradayAlertDispatchUpdateOneMock,
  },
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

import { runIntradayInactivityCronTick, startIntradayInactivityCron } from '../../src/workers/intradayInactivityCron';

describe('intradayInactivityCron', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('dispara push/webhook para alertas intradiários inéditos', async () => {
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
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    getZonedPartsMock.mockReturnValue({ year: 2026, month: 6, day: 24, hour: 10, minute: 30 });
    getIntradayInactivityReportMock.mockResolvedValue({
      generatedAt: new Date('2026-06-24T13:30:00.000Z'),
      isBusinessDay: true,
      isWithinWorkHours: true,
      concernEntries: [
        {
          trackedUserId: '665f9312eb6f3a663b6f0010',
          discordId: 'discord-1',
          displayName: 'Ana',
          status: 'not_started',
          elapsedWorkPercent: 50,
          collaborationPercentOfElapsed: 0,
        },
        {
          trackedUserId: '665f9312eb6f3a663b6f0011',
          discordId: 'discord-2',
          displayName: 'Bruno',
          status: 'low_collaboration_today',
          elapsedWorkPercent: 50,
          collaborationPercentOfElapsed: 5,
        },
        {
          trackedUserId: '665f9312eb6f3a663b6f0012',
          discordId: 'discord-3',
          displayName: 'Carla',
          status: 'ok',
          elapsedWorkPercent: 50,
          collaborationPercentOfElapsed: 30,
        },
      ],
    });
    intradayAlertDispatchUpdateOneMock
      .mockResolvedValueOnce({ upsertedCount: 1 })
      .mockResolvedValueOnce({ upsertedCount: 1 });
    getInactivitySettingsMock.mockResolvedValue({
      notifyManagerPush: true,
      notifyIntradayPush: true,
    });
    notifyManagersAboutIntradayConcernsMock.mockResolvedValue({
      disabled: false,
      managers: 1,
      subscriptions: 1,
      sent: 1,
      failed: 0,
    });
    enqueueWebhookDeliveriesMock.mockResolvedValue(1);

    const dispatched = await runIntradayInactivityCronTick(new Date('2026-06-24T13:30:00.000Z'));

    expect(dispatched).toBe(2);
    expect(intradayAlertDispatchUpdateOneMock).toHaveBeenCalledTimes(2);
    expect(notifyManagersAboutIntradayConcernsMock).toHaveBeenCalledWith({
      organizationId: '507f1f77bcf86cd799439001',
      guildId: 'guild-1',
      concerns: expect.arrayContaining([
        expect.objectContaining({ status: 'not_started' }),
        expect.objectContaining({ status: 'low_collaboration_today' }),
      ]),
    });
    expect(enqueueWebhookDeliveriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '507f1f77bcf86cd799439001',
        event: 'member.intraday_concern.detected',
      }),
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      { dispatchedConcerns: 2 },
      'Ciclo do cron intradiário concluído',
    );
  });

  it('não reenvia alerta já despachado no mesmo dia local', async () => {
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
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    getZonedPartsMock.mockReturnValue({ year: 2026, month: 6, day: 24, hour: 11, minute: 0 });
    getIntradayInactivityReportMock.mockResolvedValue({
      generatedAt: new Date('2026-06-24T14:00:00.000Z'),
      isBusinessDay: true,
      isWithinWorkHours: true,
      concernEntries: [
        {
          trackedUserId: '665f9312eb6f3a663b6f0010',
          discordId: 'discord-1',
          displayName: 'Ana',
          status: 'not_started',
          elapsedWorkPercent: 60,
          collaborationPercentOfElapsed: 0,
        },
      ],
    });
    intradayAlertDispatchUpdateOneMock
      .mockResolvedValueOnce({ upsertedCount: 1 })
      .mockResolvedValueOnce({ upsertedCount: 0 });
    getInactivitySettingsMock.mockResolvedValue({
      notifyManagerPush: true,
      notifyIntradayPush: true,
    });
    notifyManagersAboutIntradayConcernsMock.mockResolvedValue({
      disabled: false,
      managers: 1,
      subscriptions: 1,
      sent: 1,
      failed: 0,
    });
    enqueueWebhookDeliveriesMock.mockResolvedValue(1);

    const firstRun = await runIntradayInactivityCronTick(new Date('2026-06-24T14:00:00.000Z'));
    const secondRun = await runIntradayInactivityCronTick(new Date('2026-06-24T14:15:00.000Z'));

    expect(firstRun).toBe(1);
    expect(secondRun).toBe(0);
    expect(notifyManagersAboutIntradayConcernsMock).toHaveBeenCalledTimes(1);
    expect(enqueueWebhookDeliveriesMock).toHaveBeenCalledTimes(1);
  });

  it('ignora guild fora de dia útil ou fora do horário de trabalho', async () => {
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
    listTrackedGuildIdsByOrganizationMock.mockResolvedValue(['guild-1']);
    getZonedPartsMock.mockReturnValue({ year: 2026, month: 6, day: 28, hour: 9, minute: 0 });
    getIntradayInactivityReportMock.mockResolvedValue({
      generatedAt: new Date('2026-06-28T12:00:00.000Z'),
      isBusinessDay: false,
      isWithinWorkHours: false,
      concernEntries: [
        {
          trackedUserId: '665f9312eb6f3a663b6f0010',
          discordId: 'discord-1',
          displayName: 'Ana',
          status: 'not_started',
          elapsedWorkPercent: 10,
          collaborationPercentOfElapsed: 0,
        },
      ],
    });

    const dispatched = await runIntradayInactivityCronTick(new Date('2026-06-28T12:00:00.000Z'));

    expect(dispatched).toBe(0);
    expect(intradayAlertDispatchUpdateOneMock).not.toHaveBeenCalled();
    expect(notifyManagersAboutIntradayConcernsMock).not.toHaveBeenCalled();
    expect(enqueueWebhookDeliveriesMock).not.toHaveBeenCalled();
  });

  it('inicia cron em intervalo de 15 minutos e registra erro de execução', async () => {
    vi.useFakeTimers();
    organizationFindMock.mockImplementation(() => {
      throw new Error('intraday failed');
    });

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const stop = startIntradayInactivityCron();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 900_000);

    await vi.advanceTimersByTimeAsync(900_000);
    expect(loggerErrorMock).toHaveBeenCalled();

    stop();
    setIntervalSpy.mockRestore();
  });
});
