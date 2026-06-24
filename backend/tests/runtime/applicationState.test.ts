import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markApplicationReady,
  markApplicationStarting,
  markApplicationUnhealthy,
  markApplicationShuttingDown,
  isReadyForTraffic,
  isProcessLive,
  recoverApplicationReadiness,
} from '../../src/runtime/applicationState';

describe('applicationState', () => {
  afterEach(() => {
    markApplicationStarting();
  });

  it('inicia em starting e não aceita tráfego', () => {
    markApplicationStarting();
    expect(isReadyForTraffic()).toBe(false);
    expect(isProcessLive()).toBe(true);
  });

  it('marca ready após bootstrap', () => {
    markApplicationReady();
    expect(isReadyForTraffic()).toBe(true);
  });

  it('marca unhealthy e bloqueia tráfego', () => {
    markApplicationReady();
    markApplicationUnhealthy('MongoDB desconectado');
    expect(isReadyForTraffic()).toBe(false);
  });

  it('recupera readiness após unhealthy', () => {
    markApplicationUnhealthy('MongoDB desconectado');
    recoverApplicationReadiness();
    expect(isReadyForTraffic()).toBe(true);
  });

  it('shutting_down não é live', () => {
    markApplicationShuttingDown();
    expect(isProcessLive()).toBe(false);
  });
});
