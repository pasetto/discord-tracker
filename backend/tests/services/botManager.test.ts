import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotManager, PlatformNotConfiguredError } from '../../src/services/botManager';

/**
 * Cria payload mínimo de credenciais do Discord para os testes.
 * @returns Objeto de credenciais criptografadas
 */
function buildDiscordApplication() {
  return {
    botTokenEncrypted: 'encrypted-token',
    clientSecretEncrypted: 'encrypted-secret',
    clientId: 'client-id',
    isActive: true,
    isPlatformDefault: true,
  };
}

describe('BotManager', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('em production sem DiscordApplication lança PlatformNotConfiguredError', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const manager = new BotManager({
      findPlatformDefault: async () => null,
      decrypt: () => 'unused',
      onTokenLoaded: async () => {},
    });

    await expect(manager.initialize()).rejects.toBeInstanceOf(PlatformNotConfiguredError);
  });

  it('carrega token do banco e notifica callback na inicialização', async () => {
    const onTokenLoaded = vi.fn(async () => {});

    const manager = new BotManager({
      findPlatformDefault: async () => buildDiscordApplication(),
      decrypt: (value) => `decrypted:${value}`,
      onTokenLoaded,
    });

    await manager.initialize();

    expect(onTokenLoaded).toHaveBeenCalledTimes(1);
    expect(onTokenLoaded).toHaveBeenCalledWith('decrypted:encrypted-token');
  });

  it('reloadFromDatabase recarrega credenciais do banco', async () => {
    const onTokenLoaded = vi.fn(async () => {});
    const findPlatformDefault = vi
      .fn()
      .mockResolvedValueOnce(buildDiscordApplication())
      .mockResolvedValueOnce({
        ...buildDiscordApplication(),
        botTokenEncrypted: 'encrypted-token-v2',
      });

    const manager = new BotManager({
      findPlatformDefault,
      decrypt: (value) => `decrypted:${value}`,
      onTokenLoaded,
    });

    await manager.initialize();
    await manager.reloadFromDatabase();

    expect(findPlatformDefault).toHaveBeenCalledTimes(2);
    expect(onTokenLoaded).toHaveBeenNthCalledWith(1, 'decrypted:encrypted-token');
    expect(onTokenLoaded).toHaveBeenNthCalledWith(2, 'decrypted:encrypted-token-v2');
  });
});
