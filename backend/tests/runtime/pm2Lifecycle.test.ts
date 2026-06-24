import { afterEach, describe, expect, it, vi } from 'vitest';
import { markApplicationStarting } from '../../src/runtime/applicationState';
import {
  PM2_HEALTH_TOPIC,
  PM2_READY_MESSAGE,
  isPm2ManagedProcess,
  signalPm2Ready,
  signalPm2Unhealthy,
} from '../../src/runtime/pm2Lifecycle';

describe('pm2Lifecycle', () => {
  const originalSend = process.send;

  afterEach(() => {
    markApplicationStarting();
    process.send = originalSend;
  });

  it('detecta processo gerenciado pelo PM2 quando process.send existe', () => {
    process.send = vi.fn() as typeof process.send;
    expect(isPm2ManagedProcess()).toBe(true);
  });

  it('envia ready ao PM2 após marcar aplicação pronta', () => {
    const send = vi.fn();
    process.send = send as typeof process.send;

    signalPm2Ready();

    expect(send).toHaveBeenCalledWith(PM2_READY_MESSAGE);
  });

  it('envia evento unhealthy com tópico customizado', () => {
    const send = vi.fn();
    process.send = send as typeof process.send;

    signalPm2Unhealthy('MongoDB desconectado');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: PM2_HEALTH_TOPIC,
        data: expect.objectContaining({
          status: 'unhealthy',
          reason: 'MongoDB desconectado',
        }),
      }),
    );
  });
});
