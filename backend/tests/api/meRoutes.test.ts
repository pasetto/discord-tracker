import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackedUserModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
}));

const userModelMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
}));

const voiceSessionModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
}));

const presenceSessionModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
}));

const textActivityEventModelMocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
}));

const plannedAbsenceModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
}));

vi.mock('../../src/db/models/TrackedUser', () => ({
  TrackedUserModel: {
    find: trackedUserModelMocks.find,
  },
}));

vi.mock('../../src/db/models/User', () => ({
  User: {
    findOne: userModelMocks.findOne,
  },
}));

vi.mock('../../src/db/models/VoiceSession', () => ({
  VoiceSession: {
    aggregate: voiceSessionModelMocks.aggregate,
  },
}));

vi.mock('../../src/db/models/PresenceSession', () => ({
  PresenceSession: {
    aggregate: presenceSessionModelMocks.aggregate,
  },
}));

vi.mock('../../src/db/models/TextActivityEvent', () => ({
  TextActivityEventModel: {
    countDocuments: textActivityEventModelMocks.countDocuments,
  },
}));

vi.mock('../../src/db/models/PlannedAbsence', () => ({
  PlannedAbsenceModel: {
    find: plannedAbsenceModelMocks.find,
  },
}));

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

/**
 * Cria header Authorization Bearer para cenários autenticados.
 * @param memberships Memberships válidas do usuário para o token
 * @returns Header Authorization pronto para o Supertest
 */
function buildAuthHeader(memberships: Array<{ organizationId: string; role: string }>): string {
  const token = signAccessToken({
    id: 'platform-user-1',
    discordId: 'discord-123',
    username: 'colaborador',
    memberships,
  });

  return `Bearer ${token}`;
}

describe('me routes', () => {
  beforeEach(() => {
    trackedUserModelMocks.find.mockReset();
    userModelMocks.findOne.mockReset();
    voiceSessionModelMocks.aggregate.mockReset();
    presenceSessionModelMocks.aggregate.mockReset();
    textActivityEventModelMocks.countDocuments.mockReset();
    plannedAbsenceModelMocks.find.mockReset();
  });

  it('retorna 401 ao acessar /api/v1/me/collaboration sem JWT', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/api/v1/me/collaboration');

    expect(response.status).toBe(401);
  });

  it('retorna resumo de colaboração do próprio usuário autenticado', async () => {
    const app = createApp();
    trackedUserModelMocks.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '665f9312eb6f3a663b6f0011',
              guildId: 'guild-1',
              discordId: 'discord-123',
              displayName: 'Colab 1',
              lastSeenAt: '2026-06-21T10:00:00.000Z',
              lastTextActivityAt: '2026-06-21T09:00:00.000Z',
            },
          ]),
        }),
      }),
    });
    userModelMocks.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ _id: '665f9312eb6f3a663b6f0099' }),
        }),
      }),
    });
    voiceSessionModelMocks.aggregate.mockResolvedValue([{ _id: null, totalSeconds: 7200 }]);
    presenceSessionModelMocks.aggregate.mockResolvedValue([{ _id: null, totalSeconds: 14400 }]);
    textActivityEventModelMocks.countDocuments.mockResolvedValue(42);

    const response = await request(app.callback())
      .get('/api/v1/me/collaboration')
      .set('Authorization', buildAuthHeader([{ organizationId: '665f9312eb6f3a663b6f0001', role: 'viewer' }]));

    expect(response.status).toBe(200);
    expect(response.body.summary.organizationId).toBe('665f9312eb6f3a663b6f0001');
    expect(response.body.summary.discordId).toBe('discord-123');
    expect(response.body.summary.trackedProfilesCount).toBe(1);
    expect(response.body.summary.signals.voiceSessions.totalCollaborationHours).toBe(2);
    expect(response.body.summary.signals.presence.totalTrackedHours).toBe(4);
    expect(response.body.summary.signals.text.totalMetadataEvents).toBe(42);
  });

  it('retorna ausências planejadas do colaborador autenticado', async () => {
    const app = createApp();
    trackedUserModelMocks.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '665f9312eb6f3a663b6f0011',
              guildId: 'guild-1',
              discordId: 'discord-123',
            },
          ]),
        }),
      }),
    });
    plannedAbsenceModelMocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '665f9312eb6f3a663b6f00aa',
              guildId: 'guild-1',
              type: 'pto',
              status: 'scheduled',
              startDate: '2026-07-01T00:00:00.000Z',
              endDate: '2026-07-03T00:00:00.000Z',
            },
          ]),
        }),
      }),
    });

    const response = await request(app.callback())
      .get('/api/v1/me/absences')
      .set('Authorization', buildAuthHeader([{ organizationId: '665f9312eb6f3a663b6f0001', role: 'viewer' }]));

    expect(response.status).toBe(200);
    expect(response.body.absences).toHaveLength(1);
    expect(response.body.absences[0]).toMatchObject({
      guildId: 'guild-1',
      type: 'pto',
      status: 'scheduled',
    });
  });

  it('retorna export LGPD sem conteúdo de mensagens', async () => {
    const app = createApp();
    trackedUserModelMocks.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([
            {
              _id: '665f9312eb6f3a663b6f0011',
              guildId: 'guild-1',
              discordId: 'discord-123',
              displayName: 'Colab 1',
              lastSeenAt: '2026-06-21T10:00:00.000Z',
              lastTextActivityAt: '2026-06-21T09:00:00.000Z',
            },
          ]),
        }),
      }),
    });
    userModelMocks.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ _id: '665f9312eb6f3a663b6f0099' }),
        }),
      }),
    });
    voiceSessionModelMocks.aggregate.mockResolvedValue([{ _id: null, totalSeconds: 3600 }]);
    presenceSessionModelMocks.aggregate.mockResolvedValue([{ _id: null, totalSeconds: 5400 }]);
    textActivityEventModelMocks.countDocuments.mockResolvedValue(9);
    plannedAbsenceModelMocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const response = await request(app.callback())
      .get('/api/v1/me/data-export')
      .set('Authorization', buildAuthHeader([{ organizationId: '665f9312eb6f3a663b6f0001', role: 'viewer' }]));

    expect(response.status).toBe(200);
    expect(response.body.exportData).toBeDefined();
    expect(response.body.exportData.privacy.messageContentStored).toBe(false);
    expect(response.body.exportData).not.toHaveProperty('messageContent');
  });
});
