import { describe, expect, it, vi } from 'vitest';
import { liveActivityBroadcaster } from '../../src/services/liveActivityBroadcaster';

describe('liveActivityBroadcaster', () => {
  it('notifica assinantes com snapshot e transição', () => {
    const messages: unknown[] = [];
    const unsubscribe = liveActivityBroadcaster.subscribe('org-1', 'guild-1', (message) => {
      messages.push(message);
    });

    liveActivityBroadcaster.publishTransition('org-1', 'guild-1', {
      organizationId: 'org-1',
      guildId: 'guild-1',
      discordId: 'u1',
      displayName: 'Ana',
      eventType: 'JOIN',
      toChannelName: 'Geral',
      fromIgnored: false,
      toIgnored: false,
      countsAsCollaboration: true,
      occurredAt: new Date().toISOString(),
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: 'transition', data: { eventType: 'JOIN' } });
    unsubscribe();
  });
});
