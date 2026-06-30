import { describe, expect, it } from 'vitest';
import {
  buildVoiceTransitionDedupKey,
  deduplicateVoiceTransitionFeed,
} from '../../src/repositories/voiceChannelTransitionRepository';

describe('deduplicateVoiceTransitionFeed', () => {
  const base = {
    organizationId: 'org-1',
    guildId: 'guild-1',
    userId: 'user-1',
    discordId: 'discord-1',
    displayName: 'Ana',
    eventType: 'SWITCH' as const,
    fromChannelName: 'Dev 4',
    toChannelName: 'Dev 8',
    fromIgnored: false,
    toIgnored: false,
    countsAsCollaboration: true,
  };

  it('remove eventos espelhados no mesmo segundo (cluster PM2)', () => {
    const occurredAt = new Date('2026-06-30T18:42:27.000Z');
    const triple = [0, 39, 72].map((offsetMs, index) => ({
      ...base,
      _id: `id-${index}`,
      occurredAt: new Date(occurredAt.getTime() + offsetMs),
    }));

    const unique = deduplicateVoiceTransitionFeed(triple, 10);

    expect(unique).toHaveLength(1);
    expect(unique[0]?._id).toBe('id-0');
  });

  it('mantém eventos distintos do mesmo membro', () => {
    const first = {
      ...base,
      _id: 'a',
      occurredAt: new Date('2026-06-30T18:41:06.000Z'),
      fromChannelName: 'Dev 8',
      toChannelName: 'Dev 4',
    };
    const second = {
      ...base,
      _id: 'b',
      occurredAt: new Date('2026-06-30T18:42:27.000Z'),
    };

    const unique = deduplicateVoiceTransitionFeed([second, first], 10);

    expect(unique).toHaveLength(2);
  });
});

describe('buildVoiceTransitionDedupKey', () => {
  it('usa canal e segundo civil na chave', () => {
    const key = buildVoiceTransitionDedupKey({
      discordId: '1',
      eventType: 'JOIN',
      toChannelId: 'chan-1',
      occurredAt: new Date('2026-06-30T18:35:16.525Z'),
    });

    expect(key).toContain('1|JOIN|');
    expect(key).toContain('|chan-1|');
    expect(key.endsWith(`|${Math.floor(new Date('2026-06-30T18:35:16.525Z').getTime() / 1000)}`)).toBe(true);
  });
});
