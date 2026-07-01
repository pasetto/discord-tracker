import { describe, expect, it, vi } from 'vitest';

const discordMocks = vi.hoisted(() => ({
  runWithDiscordBot: vi.fn(async ({ onBotInstance }: { onBotInstance: () => Promise<unknown> }) => onBotInstance()),
  guildsCache: new Map<string, { channels: { cache: Map<string, { id: string; name: string; type: number; parent?: { name: string } }> } }>(),
  guildsFetch: vi.fn(),
}));

vi.mock('../../src/services/discordClusterProxy', () => ({
  runWithDiscordBot: discordMocks.runWithDiscordBot,
}));

vi.mock('../../src/bot/client', () => ({
  discordClient: {
    guilds: {
      cache: discordMocks.guildsCache,
      fetch: discordMocks.guildsFetch,
    },
  },
}));

import { ChannelType } from 'discord.js';
import { listGuildDiscordChannels, unwrapDiscordChannelsResponse } from '../../src/services/discordGuildChannelService';

describe('listGuildDiscordChannels', () => {
  it('retorna canais de voz e texto ordenados por nome', async () => {
    discordMocks.runWithDiscordBot.mockImplementation(async ({ onBotInstance }) => onBotInstance());
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
    discordMocks.runWithDiscordBot.mockRejectedValue(new Error('Bot Discord não conectado. Verifique a configuração em Configurações → Discord.'));
    discordMocks.guildsCache.clear();

    await expect(listGuildDiscordChannels('guild-1')).rejects.toThrow(/Bot Discord não conectado/);
    discordMocks.runWithDiscordBot.mockImplementation(async ({ onBotInstance }) => onBotInstance());
  });

  it('usa proxy de cluster quando worker é API-only', async () => {
    discordMocks.guildsCache.clear();
    discordMocks.runWithDiscordBot.mockResolvedValue({
      channels: [{ channelId: '1', channelName: 'geral', channelType: 'text' }],
    });

    const channels = await listGuildDiscordChannels('guild-1');

    expect(discordMocks.runWithDiscordBot).toHaveBeenCalledWith(
      expect.objectContaining({ guildId: 'guild-1', internalPath: '/internal/discord/guilds/guild-1/channels' }),
    );
    expect(channels).toEqual([{ channelId: '1', channelName: 'geral', channelType: 'text' }]);
  });

  it('unwrapDiscordChannelsResponse aceita lista direta ou envelope do proxy', () => {
    const list = [{ channelId: '1', channelName: 'geral', channelType: 'text' as const }];
    expect(unwrapDiscordChannelsResponse(list)).toEqual(list);
    expect(unwrapDiscordChannelsResponse({ channels: list })).toEqual(list);
  });
});
