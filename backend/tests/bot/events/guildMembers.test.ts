import { beforeEach, describe, expect, it, vi } from 'vitest';

const deactivateMock = vi.hoisted(() => vi.fn());
const reactivateMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const listMonitoredMock = vi.hoisted(() => vi.fn());

const eventHandlers = vi.hoisted(() => ({
  guildMemberRemove: undefined as ((...args: unknown[]) => Promise<void>) | undefined,
  guildMemberAdd: undefined as ((...args: unknown[]) => Promise<void>) | undefined,
}));

vi.mock('../../../src/bot/client', () => ({
  discordClient: {
    on: (event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'guildMemberRemove') {
        eventHandlers.guildMemberRemove = handler;
      }
      if (event === 'guildMemberAdd') {
        eventHandlers.guildMemberAdd = handler;
      }
    },
  },
}));

vi.mock('../../../src/services/guildMonitoringService', () => ({
  listEnabledMonitoredGuilds: listMonitoredMock,
}));

vi.mock('../../../src/services/trackedUserService', () => ({
  deactivateTrackedUserByDiscordId: deactivateMock,
  reactivateTrackedUserByDiscordId: reactivateMock,
  upsertTrackedUser: upsertMock,
}));

import { registerGuildMembersHandlers } from '../../../src/bot/events/guildMembers';

describe('guildMembers handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMonitoredMock.mockResolvedValue([{ organizationId: 'org-1', guildId: 'guild-1' }]);
    deactivateMock.mockResolvedValue(true);
    reactivateMock.mockResolvedValue(false);
    upsertMock.mockResolvedValue({});
    registerGuildMembersHandlers();
  });

  it('desativa membro humano ao sair do guild monitorado', async () => {
    await eventHandlers.guildMemberRemove?.({
      id: 'discord-1',
      guild: { id: 'guild-1' },
      user: { bot: false },
    });

    expect(deactivateMock).toHaveBeenCalledWith('org-1', 'guild-1', 'discord-1');
  });

  it('ignora bots ao sair do guild', async () => {
    await eventHandlers.guildMemberRemove?.({
      id: 'bot-1',
      guild: { id: 'guild-1' },
      user: { bot: true },
    });

    expect(deactivateMock).not.toHaveBeenCalled();
  });

  it('reativa membro existente ao entrar no guild', async () => {
    reactivateMock.mockResolvedValueOnce(true);

    await eventHandlers.guildMemberAdd?.({
      id: 'discord-2',
      guild: { id: 'guild-1' },
      user: { username: 'user2', bot: false, globalName: 'User 2' },
      displayName: 'User 2',
    });

    expect(reactivateMock).toHaveBeenCalledWith('org-1', 'guild-1', 'discord-2');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('cria tracked user quando membro novo entra no guild', async () => {
    await eventHandlers.guildMemberAdd?.({
      id: 'discord-3',
      guild: { id: 'guild-1' },
      user: { username: 'user3', bot: false },
      displayName: 'User 3',
    });

    expect(upsertMock).toHaveBeenCalledWith({
      organizationId: 'org-1',
      guildId: 'guild-1',
      discordId: 'discord-3',
      username: 'user3',
      displayName: 'User 3',
    });
  });
});
