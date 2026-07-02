/**
 * Valida se o identificador Discord é numérico e seguro para BigInt.
 * @param discordId ID do usuário Discord
 * @returns true quando o ID é uma string numérica válida
 */
function isValidDiscordId(discordId: string | null | undefined): discordId is string {
  return typeof discordId === 'string' && /^\d+$/.test(discordId);
}

/**
 * Monta URL pública do avatar Discord via CDN.
 * @param discordId ID numérico do usuário Discord
 * @param avatarHash Hash do avatar (null quando usa avatar padrão)
 * @param size Tamanho em pixels (default 64)
 * @returns URL HTTPS do avatar ou undefined quando o ID é inválido
 * @example
 * buildDiscordAvatarUrl('123', 'abc123') // avatar customizado
 */
export function buildDiscordAvatarUrl(
  discordId: string | null | undefined,
  avatarHash: string | null | undefined,
  size = 64,
): string | undefined {
  if (!isValidDiscordId(discordId)) {
    return undefined;
  }

  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=${size}`;
  }

  const index = Number((BigInt(discordId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Resolve avatar a partir de usuário Discord.js (id + hash).
 * @param user Usuário com identificador e hash de avatar
 * @param discordIdFallback ID alternativo (ex.: `GuildMember.id`) quando `user.id` ausente
 * @returns URL HTTPS do avatar ou undefined quando nenhum ID válido está disponível
 */
export function resolveDiscordUserAvatarUrl(
  user: { id?: string | null; avatar?: string | null } | null | undefined,
  discordIdFallback?: string | null,
): string | undefined {
  const discordId = user?.id ?? discordIdFallback;
  return buildDiscordAvatarUrl(discordId, user?.avatar ?? null);
}
