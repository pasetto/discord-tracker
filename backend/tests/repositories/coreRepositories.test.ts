import { beforeEach, describe, expect, it, vi } from 'vitest';

const appSettingModelMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

const channelRuleModelMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

const systemLogModelMocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

const userModelMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  countDocuments: vi.fn(),
  find: vi.fn(),
}));

vi.mock('../../src/db/models/AppSetting', () => ({
  AppSetting: appSettingModelMocks,
}));

vi.mock('../../src/db/models/ChannelRule', () => ({
  ChannelRuleModel: channelRuleModelMocks,
}));

vi.mock('../../src/db/models/SystemLog', () => ({
  SystemLog: systemLogModelMocks,
}));

vi.mock('../../src/db/models/User', () => ({
  User: userModelMocks,
}));

import { appSettingRepository } from '../../src/repositories/appSettingRepository';
import {
  channelRuleRepository,
  createDefaultChannelRules,
  normalizeChannelRules,
} from '../../src/repositories/channelRuleRepository';
import { systemLogRepository } from '../../src/repositories/systemLogRepository';
import { userRepository } from '../../src/repositories/userRepository';

describe('core repositories', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('appSettingRepository retorna null quando configuração não existe', async () => {
    appSettingModelMocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const value = await appSettingRepository.get('unknown.key');

    expect(value).toBeNull();
    expect(appSettingModelMocks.findOne).toHaveBeenCalledWith({ key: 'unknown.key' });
  });

  it('appSettingRepository persiste configuração por upsert', async () => {
    appSettingModelMocks.findOneAndUpdate.mockResolvedValue({ key: 'app.theme', value: 'dark' });

    const result = await appSettingRepository.set('app.theme', 'dark');

    expect(result).toEqual({ key: 'app.theme', value: 'dark' });
    expect(appSettingModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'app.theme' },
      { value: 'dark' },
      { upsert: true, new: true },
    );
  });

  it('normaliza regras de canais removendo inválidos e duplicados', () => {
    const result = normalizeChannelRules({
      ignored: [
        { channelId: ' 1 ', channelName: ' AFK ', channelType: 'voice' },
        { channelId: '1', channelName: 'duplicado', channelType: 'voice' },
        { channelId: '   ', channelName: 'inválido', channelType: 'voice' },
      ],
      productiveText: [{ channelId: 'txt-1', channelName: ' Geral ', channelType: 'voice' }],
    });

    expect(result.ignored).toEqual([{ channelId: '1', channelName: 'AFK', channelType: 'voice' }]);
    expect(result.productiveText).toEqual([
      { channelId: 'txt-1', channelName: 'Geral', channelType: 'text' },
    ]);
    expect(result.afk).toEqual([]);
    expect(result.lunch).toEqual([]);
    expect(result.productiveVoice).toEqual([]);
    expect(result.ignoredText).toEqual([]);
  });

  it('retorna regras padrão quando guild não possui configuração', async () => {
    channelRuleModelMocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await channelRuleRepository.getByGuild('org-1', 'guild-1');

    expect(result).toEqual(createDefaultChannelRules());
    expect(channelRuleModelMocks.findOne).toHaveBeenCalledWith({ organizationId: 'org-1', guildId: 'guild-1' });
  });

  it('upsertByGuild salva regras normalizadas', async () => {
    channelRuleModelMocks.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        rules: {
          ignored: [{ channelId: 'v1', channelName: 'AFK', channelType: 'voice' }],
        },
      }),
    });

    const result = await channelRuleRepository.upsertByGuild('org-1', 'guild-1', {
      ignored: [{ channelId: 'v1', channelName: 'AFK', channelType: 'voice' }],
    });

    expect(result.ignored).toEqual([{ channelId: 'v1', channelName: 'AFK', channelType: 'voice' }]);
    expect(channelRuleModelMocks.findOneAndUpdate).toHaveBeenCalled();
  });

  it('systemLogRepository persiste log com metadata padrão', async () => {
    systemLogModelMocks.create.mockResolvedValue({ level: 'info' });

    await systemLogRepository.create('info', 'boot', 'api');

    expect(systemLogModelMocks.create).toHaveBeenCalledWith({
      level: 'info',
      message: 'boot',
      context: 'api',
      metadata: {},
    });
  });

  it('userRepository realiza operações básicas de busca e upsert', async () => {
    userModelMocks.findOne.mockResolvedValue({ discordId: '123' });
    userModelMocks.findOneAndUpdate.mockResolvedValue({ discordId: '123' });
    userModelMocks.countDocuments.mockResolvedValue(7);
    const sortMock = vi.fn().mockResolvedValue([{ discordId: '123' }]);
    userModelMocks.find.mockReturnValue({ sort: sortMock });

    const found = await userRepository.findByDiscordId('123');
    const upserted = await userRepository.upsert({
      discordId: '123',
      username: 'alice',
      displayName: 'Alice',
    });
    const count = await userRepository.countAll();
    const allUsers = await userRepository.findAll();

    expect(found).toEqual({ discordId: '123' });
    expect(upserted).toEqual({ discordId: '123' });
    expect(count).toBe(7);
    expect(allUsers).toEqual([{ discordId: '123' }]);
    expect(userModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { discordId: '123' },
      expect.objectContaining({
        $set: expect.objectContaining({
          username: 'alice',
          displayName: 'Alice',
        }),
        $setOnInsert: expect.objectContaining({
          discordId: '123',
        }),
      }),
      { upsert: true, new: true },
    );
  });
});
