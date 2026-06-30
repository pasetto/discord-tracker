import { describe, expect, it, vi } from 'vitest';

const discordMocks = vi.hoisted(() => ({
  ensureDiscordGuildAccessible: vi.fn(async () => true),
  guildsCache: new Map<string, { channels: { cache: Map<string, { id: string; name: string; type: number; parent?: { name: string } }> } }>(),
}));

vi.mock('../../src/bot/client', () => ({
  ensureDiscordGuildAccessible: discordMocks.ensureDiscordGuildAccessible,
  discordClient: {
    guilds: {
      cache: discordMocks.guildsCache,
    },
  },
}));

import { ChannelType } from 'discord.js';
import { listGuildDiscordChannels } from '../../src/services/discordGuildChannelService';

describe('listGuildDiscordChannels', () => {
  it('retorna canais de voz e texto ordenados por nome', async () => {
    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(true);
    discordMocks.guildsCache.set('guild-1', {
      channels: {
        cache: new Map([
          ['2', { id: '2', name: 'geral', type: ChannelType.GuildText }],
          ['1', { id: '1', name: 'Reunião', type: ChannelType.GuildVoice, parent: { name: 'Trabalho' } }],
        ]),
      },
    });

    const channels = await listGuildDiscordChannels('guild-1');

    expect(channels).toEqual([
      { channelId: '2', channelName: 'geral', channelType: 'text', parentName: undefined },
      { channelId: '1', channelName: 'Reunião', channelType: 'voice', parentName: 'Trabalho' },
    ]);
  });

  it('falha quando o bot não fica acessível mesmo após o retry', async () => {
    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(false);
    discordMocks.guildsCache.clear();

    await expect(listGuildDiscordChannels('guild-1')).rejects.toThrow(/Bot Discord não conectado/);
    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(true);
  });

  it('lista canais quando o retry restabelece a conexão do bot', async () => {
    discordMocks.guildsCache.set('guild-1', {
      channels: {
        cache: new Map([['1', { id: '1', name: 'geral', type: ChannelType.GuildText }]]),
      },
    });
    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(true);

    const channels = await listGuildDiscordChannels('guild-1');

    expect(discordMocks.ensureDiscordGuildAccessible).toHaveBeenCalledWith('guild-1');
    expect(channels).toHaveLength(1);
  });
});
