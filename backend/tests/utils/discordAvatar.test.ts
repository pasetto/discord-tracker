import { describe, expect, it } from 'vitest';
import { buildDiscordAvatarUrl, resolveDiscordUserAvatarUrl } from '../../src/utils/discordAvatar';

describe('discordAvatar', () => {
  it('monta URL de avatar customizado', () => {
    expect(buildDiscordAvatarUrl('123456789', 'abc123hash', 64)).toBe(
      'https://cdn.discordapp.com/avatars/123456789/abc123hash.png?size=64',
    );
  });

  it('monta URL de avatar padrão quando hash ausente', () => {
    const url = buildDiscordAvatarUrl('123456789012345678', null);
    expect(url).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);
  });

  it('resolve avatar a partir de usuário Discord.js', () => {
    expect(
      resolveDiscordUserAvatarUrl({ id: '999', avatar: 'hash' }),
    ).toBe('https://cdn.discordapp.com/avatars/999/hash.png?size=64');
  });
});
