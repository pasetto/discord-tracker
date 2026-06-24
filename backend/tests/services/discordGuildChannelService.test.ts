import { describe, expect, it, vi } from 'vitest';

const discordMocks = vi.hoisted(() => ({
  isDiscordReady: true,
  guildsCache: new Map<string, { channels: { cache: Map<string, { id: string; name: string; type: number; parent?: { name: string } }> } }>(),
}));

vi.mock('../../src/bot/client', () => ({
  get isDiscordReady() {
    return discordMocks.isDiscordReady;
  },
  discordClient: {
    guilds: {
      cache: discordMocks.guildsCache,
    },
  },
}));

import { ChannelType } from 'discord.js';
import { listGuildDiscordChannels } from '../../src/services/discordGuildChannelService';

describe('listGuildDiscordChannels', () => {
  it('retorna canais de voz e texto ordenados por nome', () => {
    discordMocks.isDiscordReady = true;
    discordMocks.guildsCache.set('guild-1', {
      channels: {
        cache: new Map([
          ['2', { id: '2', name: 'geral', type: ChannelType.GuildText }],
          ['1', { id: '1', name: 'Reunião', type: ChannelType.GuildVoice, parent: { name: 'Trabalho' } }],
        ]),
      },
    });

    const channels = listGuildDiscordChannels('guild-1');

    expect(channels).toEqual([
      { channelId: '2', channelName: 'geral', channelType: 'text', parentName: undefined },
      { channelId: '1', channelName: 'Reunião', channelType: 'voice', parentName: 'Trabalho' },
    ]);
  });

  it('falha quando bot não está conectado', () => {
    discordMocks.isDiscordReady = false;
    discordMocks.guildsCache.clear();
    expect(() => listGuildDiscordChannels('guild-1')).toThrow(/Bot Discord não conectado/);
    discordMocks.isDiscordReady = true;
  });
});
