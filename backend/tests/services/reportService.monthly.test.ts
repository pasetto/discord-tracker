import { beforeEach, describe, expect, it, vi } from 'vitest';

const dailyReportMocks = vi.hoisted(() => ({
  aggregateMonthly: vi.fn(),
  rankingMonthly: vi.fn(),
  upsert: vi.fn(),
}));

const voiceSessionMocks = vi.hoisted(() => ({
  aggregateByPeriod: vi.fn(),
}));

const presenceSessionMocks = vi.hoisted(() => ({
  aggregateByPeriod: vi.fn(),
}));

const userMocks = vi.hoisted(() => ({
  findAll: vi.fn(),
}));

vi.mock('../../src/repositories/dailyReportRepository', () => ({
  dailyReportRepository: dailyReportMocks,
}));

vi.mock('../../src/repositories/voiceSessionRepository', () => ({
  voiceSessionRepository: voiceSessionMocks,
}));

vi.mock('../../src/repositories/presenceSessionRepository', () => ({
  presenceSessionRepository: presenceSessionMocks,
}));

vi.mock('../../src/repositories/userRepository', () => ({
  userRepository: userMocks,
}));

import { reportService } from '../../src/services/reportService';

describe('reportService mensal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dailyReportMocks.aggregateMonthly.mockResolvedValue({
      productiveSeconds: 0,
      voiceSeconds: 0,
      idleSeconds: 0,
      offlineSeconds: 0,
      afkSeconds: 0,
      lunchSeconds: 0,
    });
    dailyReportMocks.rankingMonthly.mockResolvedValue([]);
    voiceSessionMocks.aggregateByPeriod.mockResolvedValue([]);
    presenceSessionMocks.aggregateByPeriod.mockResolvedValue([]);
    userMocks.findAll.mockResolvedValue([]);
  });

  it('regenera todos os relatórios diários do mês antes de agregar o total mensal', async () => {
    await reportService.getMonthlyReport(2026, 6);

    expect(voiceSessionMocks.aggregateByPeriod).toHaveBeenCalledTimes(30);
    expect(presenceSessionMocks.aggregateByPeriod).toHaveBeenCalledTimes(30);
    expect(dailyReportMocks.aggregateMonthly).toHaveBeenCalledWith(2026, 6);
  });

  it('regenera todos os relatórios diários do mês antes de montar o ranking mensal', async () => {
    await reportService.getMonthlyRanking(2026, 6);

    expect(voiceSessionMocks.aggregateByPeriod).toHaveBeenCalledTimes(30);
    expect(presenceSessionMocks.aggregateByPeriod).toHaveBeenCalledTimes(30);
    expect(dailyReportMocks.rankingMonthly).toHaveBeenCalledWith(2026, 6, 50);
  });
});
