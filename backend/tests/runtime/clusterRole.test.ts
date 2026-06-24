import { afterEach, describe, expect, it } from 'vitest';
import {
  getClusterInstanceId,
  isPm2ClusterWorker,
  shouldRunBackgroundJobs,
} from '../../src/runtime/clusterRole';

describe('clusterRole', () => {
  const originalInstance = process.env.NODE_APP_INSTANCE;
  const originalJobs = process.env.SYNTA_ENABLE_BACKGROUND_JOBS;

  afterEach(() => {
    if (originalInstance === undefined) {
      delete process.env.NODE_APP_INSTANCE;
    } else {
      process.env.NODE_APP_INSTANCE = originalInstance;
    }

    if (originalJobs === undefined) {
      delete process.env.SYNTA_ENABLE_BACKGROUND_JOBS;
    } else {
      process.env.SYNTA_ENABLE_BACKGROUND_JOBS = originalJobs;
    }
  });

  it('executa background jobs fora do cluster PM2', () => {
    delete process.env.NODE_APP_INSTANCE;
    expect(isPm2ClusterWorker()).toBe(false);
    expect(shouldRunBackgroundJobs()).toBe(true);
  });

  it('executa background jobs apenas na instância 0 do cluster', () => {
    process.env.NODE_APP_INSTANCE = '0';
    expect(shouldRunBackgroundJobs()).toBe(true);

    process.env.NODE_APP_INSTANCE = '2';
    expect(shouldRunBackgroundJobs()).toBe(false);
  });

  it('respeita override SYNTA_ENABLE_BACKGROUND_JOBS', () => {
    process.env.NODE_APP_INSTANCE = '3';
    process.env.SYNTA_ENABLE_BACKGROUND_JOBS = 'true';
    expect(shouldRunBackgroundJobs()).toBe(true);

    process.env.SYNTA_ENABLE_BACKGROUND_JOBS = 'false';
    process.env.NODE_APP_INSTANCE = '0';
    expect(shouldRunBackgroundJobs()).toBe(false);
  });

  it('parseia NODE_APP_INSTANCE como número', () => {
    process.env.NODE_APP_INSTANCE = '1';
    expect(getClusterInstanceId()).toBe(1);
  });
});
