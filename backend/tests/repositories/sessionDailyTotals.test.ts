import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const presenceModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
  aggregate: vi.fn(),
}));

const voiceModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock('../../src/db/models/PresenceSession', () => ({
  PresenceSession: presenceModelMocks,
}));

vi.mock('../../src/db/models/VoiceSession', () => ({
  VoiceSession: voiceModelMocks,
}));

import { presenceSessionRepository } from '../../src/repositories/presenceSessionRepository';
import { voiceSessionRepository } from '../../src/repositories/voiceSessionRepository';

const HOUR = 3600_000;

/**
 * Simula a cadeia find().select().lean().exec() do Mongoose.
 * @param docs Documentos retornados
 */
function mockFindChain(docs: unknown[]): { select: () => { lean: () => { exec: () => Promise<unknown[]> } } } {
  return {
    select: () => ({
      lean: () => ({
        exec: async () => docs,
      }),
    }),
  };
}

describe('totais diários de sessão (união de intervalos)', () => {
  const orgId = new Types.ObjectId();
  const guildId = 'guild-1';
  const userId = new Types.ObjectId();
  const userKey = String(userId);
  // Janela: 10h até 17h do dia (7h de relógio).
  const dayStart = new Date(10 * HOUR);
  const now = new Date(17 * HOUR);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('presença: conta o tempo de relógio (união), não a soma de sessões abertas sobrepostas', async () => {
    // 5 sessões ONLINE órfãs sobrepostas, todas abrangendo a janela inteira.
    const overlapping = Array.from({ length: 5 }, () => ({
      userId,
      status: 'ONLINE',
      startedAt: dayStart,
      endedAt: null,
    }));
    presenceModelMocks.find.mockReturnValue(mockFindChain(overlapping));

    const totals = await presenceSessionRepository.sumTodayOnlineByUserIds(
      [userId],
      orgId,
      guildId,
      dayStart,
      now,
    );

    // União = 7h (não 5 * 7h = 35h).
    expect(totals.get(userKey)).toBe(7 * 3600);
  });

  it('presença: soma intervalos disjuntos normalmente', async () => {
    presenceModelMocks.find.mockReturnValue(
      mockFindChain([
        { userId, status: 'ONLINE', startedAt: new Date(10 * HOUR), endedAt: new Date(12 * HOUR) },
        { userId, status: 'IDLE', startedAt: new Date(14 * HOUR), endedAt: new Date(15 * HOUR) },
      ]),
    );

    const totals = await presenceSessionRepository.sumTodayOnlineByUserIds(
      [userId],
      orgId,
      guildId,
      dayStart,
      now,
    );

    expect(totals.get(userKey)).toBe(3 * 3600);
  });

  it('voz: une intervalos sobrepostos por bucket (colaboração) sem estourar o relógio', async () => {
    // 4 sessões VOICE colaborativas sobrepostas + 1 AFK disjunta.
    const docs = [
      ...Array.from({ length: 4 }, () => ({
        userId,
        startedAt: dayStart,
        endedAt: null,
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      })),
      {
        userId,
        startedAt: new Date(10 * HOUR),
        endedAt: new Date(11 * HOUR),
        isIgnoredChannel: true,
        sessionType: 'AFK',
      },
    ];
    voiceModelMocks.find.mockReturnValue(mockFindChain(docs));

    const totals = await voiceSessionRepository.sumTodayByUserIds(
      [userId],
      orgId,
      guildId,
      dayStart,
      now,
    );

    const bucket = totals.get(userKey);
    expect(bucket?.collaborationSeconds).toBe(7 * 3600);
    expect(bucket?.inactiveSeconds).toBe(1 * 3600);
  });
});

describe('aggregateByPeriod (relatórios históricos com união de intervalos)', () => {
  const orgId = new Types.ObjectId();
  const guildId = 'guild-1';
  const userId = new Types.ObjectId();
  const periodStart = new Date(10 * HOUR);
  const periodEnd = new Date(17 * HOUR);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('presença: relatório histórico não duplica sessões IDLE/OFFLINE sobrepostas', async () => {
    presenceModelMocks.aggregate.mockResolvedValue([
      { _id: userId, idleSeconds: 4 * 3600, offlineSeconds: 2 * 3600 },
    ]);
    presenceModelMocks.find.mockReturnValue(
      mockFindChain([
        { userId, status: 'IDLE', startedAt: new Date(10 * HOUR), endedAt: new Date(12 * HOUR) },
        { userId, status: 'IDLE', startedAt: new Date(10 * HOUR), endedAt: new Date(12 * HOUR) },
        { userId, status: 'OFFLINE', startedAt: new Date(14 * HOUR), endedAt: new Date(15 * HOUR) },
        { userId, status: 'INVISIBLE', startedAt: new Date(14 * HOUR), endedAt: new Date(15 * HOUR) },
      ]),
    );

    const rows = await presenceSessionRepository.aggregateByPeriod(periodStart, periodEnd, {
      organizationId: orgId,
      guildId,
    });

    expect(rows).toEqual([{ _id: userId, idleSeconds: 2 * 3600, offlineSeconds: 1 * 3600 }]);
  });

  it('voz: relatório histórico não duplica sessões VOICE/AFK/LUNCH sobrepostas', async () => {
    voiceModelMocks.aggregate.mockResolvedValue([
      {
        _id: userId,
        productiveSeconds: 6 * 3600,
        voiceSeconds: 9 * 3600,
        afkSeconds: 2 * 3600,
        lunchSeconds: 1 * 3600,
      },
    ]);
    voiceModelMocks.find.mockReturnValue(
      mockFindChain([
        {
          userId,
          startedAt: new Date(10 * HOUR),
          endedAt: new Date(13 * HOUR),
          isIgnoredChannel: false,
          sessionType: 'VOICE',
        },
        {
          userId,
          startedAt: new Date(10 * HOUR),
          endedAt: new Date(13 * HOUR),
          isIgnoredChannel: false,
          sessionType: 'VOICE',
        },
        {
          userId,
          startedAt: new Date(14 * HOUR),
          endedAt: new Date(15 * HOUR),
          isIgnoredChannel: true,
          sessionType: 'AFK',
        },
        {
          userId,
          startedAt: new Date(14 * HOUR),
          endedAt: new Date(15 * HOUR),
          isIgnoredChannel: true,
          sessionType: 'AFK',
        },
        {
          userId,
          startedAt: new Date(16 * HOUR),
          endedAt: new Date(17 * HOUR),
          isIgnoredChannel: false,
          sessionType: 'LUNCH',
        },
      ]),
    );

    const rows = await voiceSessionRepository.aggregateByPeriod(periodStart, periodEnd, {
      organizationId: orgId,
      guildId,
    });

    expect(rows).toEqual([
      {
        _id: userId,
        productiveSeconds: 3 * 3600,
        voiceSeconds: 5 * 3600,
        afkSeconds: 1 * 3600,
        lunchSeconds: 1 * 3600,
      },
    ]);
  });
});

describe('closeAllOpenByUserId (correção de sessões órfãs)', () => {
  const orgId = new Types.ObjectId();
  const guildId = 'guild-1';
  const userId = new Types.ObjectId();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('presença: fecha todas as sessões abertas e calcula duração', async () => {
    const endedAt = new Date(2 * HOUR);
    const sessions = [
      { startedAt: new Date(0), endedAt: null, durationSeconds: null, save: vi.fn() },
      { startedAt: new Date(HOUR), endedAt: null, durationSeconds: null, save: vi.fn() },
    ];
    presenceModelMocks.find.mockResolvedValue(sessions);

    const closed = await presenceSessionRepository.closeAllOpenByUserId(userId, orgId, guildId, endedAt);

    expect(closed).toBe(2);
    expect(sessions[0].endedAt).toEqual(endedAt);
    expect(sessions[0].durationSeconds).toBe(2 * 3600);
    expect(sessions[1].durationSeconds).toBe(1 * 3600);
    expect(sessions[0].save).toHaveBeenCalledOnce();
    expect(sessions[1].save).toHaveBeenCalledOnce();
  });

  it('voz: retorna 0 quando não há sessões abertas', async () => {
    voiceModelMocks.find.mockResolvedValue([]);

    const closed = await voiceSessionRepository.closeAllOpenByUserId(userId, orgId, guildId, new Date());

    expect(closed).toBe(0);
  });
});
