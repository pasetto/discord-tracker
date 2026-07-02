/**
 * Monta URL pública do avatar Discord via CDN.
 * @param discordId ID numérico do usuário Discord
 * @param avatarHash Hash do avatar (null quando usa avatar padrão)
 * @param size Tamanho em pixels (default 64)
 * @returns URL HTTPS do avatar
 * @example
 * buildDiscordAvatarUrl('123', 'abc123') // avatar customizado
 */
export function buildDiscordAvatarUrl(
  discordId: string,
  avatarHash: string | null | undefined,
  size = 64,
): string {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=${size}`;
  }

  const index = Number((BigInt(discordId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Resolve avatar a partir de usuário Discord.js (id + hash).
 * @param user Usuário com identificador e hash de avatar
 * @returns URL HTTPS do avatar
 */
export function resolveDiscordUserAvatarUrl(user: {
  id: string;
  avatar: string | null;
}): string {
  return buildDiscordAvatarUrl(user.id, user.avatar);
}
