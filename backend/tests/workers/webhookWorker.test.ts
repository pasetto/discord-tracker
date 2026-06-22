import { beforeEach, describe, expect, it, vi } from 'vitest';

const processPendingWebhookDeliveriesMock = vi.hoisted(() => vi.fn());
const loggerInfoMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/webhookService', () => ({
  processPendingWebhookDeliveries: processPendingWebhookDeliveriesMock,
}));

vi.mock('../../src/logger', () => ({
  createLogger: vi.fn(() => ({
    info: loggerInfoMock,
    error: loggerErrorMock,
  })),
}));

import { runWebhookWorkerTick, startWebhookWorker } from '../../src/workers/webhookWorker';

describe('webhookWorker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('processa o tick com batch padrão e data informada', async () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    processPendingWebhookDeliveriesMock.mockResolvedValue(3);

    const processed = await runWebhookWorkerTick(now);

    expect(processed).toBe(3);
    expect(processPendingWebhookDeliveriesMock).toHaveBeenCalledWith(20, now);
    expect(loggerInfoMock).toHaveBeenCalledWith({ processed: 3 }, 'Ciclo do worker de webhooks concluído');
  });

  it('não faz log info quando não processa entregas', async () => {
    processPendingWebhookDeliveriesMock.mockResolvedValue(0);

    const processed = await runWebhookWorkerTick();

    expect(processed).toBe(0);
    expect(loggerInfoMock).not.toHaveBeenCalled();
  });

  it('inicia tick imediato e usa intervalo mínimo de 5 segundos', async () => {
    vi.useFakeTimers();
    processPendingWebhookDeliveriesMock.mockResolvedValue(1);

    const stop = startWebhookWorker(1_000);

    await vi.runOnlyPendingTimersAsync();
    expect(processPendingWebhookDeliveriesMock).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(processPendingWebhookDeliveriesMock).toHaveBeenCalledTimes(2);
  });

  it('faz log de erro quando tick falha', async () => {
    vi.useFakeTimers();
    processPendingWebhookDeliveriesMock.mockRejectedValue(new Error('worker failed'));

    const stop = startWebhookWorker();
    await vi.runOnlyPendingTimersAsync();

    expect(loggerErrorMock).toHaveBeenCalled();
    stop();
  });
});
