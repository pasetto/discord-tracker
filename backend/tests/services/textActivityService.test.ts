import { describe, expect, it, vi } from 'vitest';
import {
  buildTextActivityEvent,
  createTextActivityService,
} from '../../src/services/textActivityService';

describe('buildTextActivityEvent', () => {
  it('retorna só metadados permitidos', () => {
    const event = buildTextActivityEvent({
      organizationId: 'org1',
      guildId: 'g1',
      discordId: 'u1',
      channelId: 'c1',
      eventType: 'message',
      occurredAt: new Date('2026-06-20T10:00:00Z'),
    });

    expect(event).toEqual({
      organizationId: 'org1',
      guildId: 'g1',
      discordId: 'u1',
      channelId: 'c1',
      eventType: 'message',
      occurredAt: new Date('2026-06-20T10:00:00Z'),
    });
    expect('content' in (event as object)).toBe(false);
  });
});

describe('textActivityService', () => {
  it('aplica debounce de 60s por discordId+channelId', async () => {
    const createEvents = vi.fn(async () => {});
    const touchTrackedUsers = vi.fn(async () => {});
    const service = createTextActivityService({
      findTrackedUsers: async () => [
        {
          trackedUserId: 'tracked-1',
          organizationId: 'org1',
          guildId: 'g1',
          discordId: 'u1',
        },
      ],
      createEvents,
      touchTrackedUsers,
      debounceWindowMs: 60_000,
    });

    await service.recordActivity({
      guildId: 'g1',
      discordId: 'u1',
      channelId: 'c1',
      eventType: 'message',
      occurredAt: new Date('2026-06-20T10:00:00Z'),
    });
    await service.recordActivity({
      guildId: 'g1',
      discordId: 'u1',
      channelId: 'c1',
      eventType: 'reaction',
      occurredAt: new Date('2026-06-20T10:00:30Z'),
    });

    expect(createEvents).toHaveBeenCalledTimes(1);
    expect(touchTrackedUsers).toHaveBeenCalledTimes(1);
  });

  it('não aplica debounce quando muda channelId', async () => {
    const createEvents = vi.fn(async () => {});
    const touchTrackedUsers = vi.fn(async () => {});
    const service = createTextActivityService({
      findTrackedUsers: async () => [
        {
          trackedUserId: 'tracked-1',
          organizationId: 'org1',
          guildId: 'g1',
          discordId: 'u1',
        },
      ],
      createEvents,
      touchTrackedUsers,
      debounceWindowMs: 60_000,
    });

    await service.recordActivity({
      guildId: 'g1',
      discordId: 'u1',
      channelId: 'c1',
      eventType: 'message',
      occurredAt: new Date('2026-06-20T10:00:00Z'),
    });
    await service.recordActivity({
      guildId: 'g1',
      discordId: 'u1',
      channelId: 'c2',
      eventType: 'reaction',
      occurredAt: new Date('2026-06-20T10:00:30Z'),
    });

    expect(createEvents).toHaveBeenCalledTimes(2);
    expect(touchTrackedUsers).toHaveBeenCalledTimes(2);
  });
});
