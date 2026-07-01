import { Types } from 'mongoose';
import type { Guild } from 'discord.js';
import { MemberCategoryModel } from '../db/models/MemberCategory';
import { TrackedUserModel, type ITrackedUser } from '../db/models/TrackedUser';
import { discordClient, canAccessDiscordGuild, ensureDiscordClientReady } from '../bot/client';

/**
 * Dados mínimos para upsert de membro rastreado.
 */
export interface UpsertTrackedUserInput {
  organizationId: string;
  guildId: string;
  discordId: string;
  username: string;
  displayName: string;
  seenAt?: Date;
}

/**
 * Membro rastreado retornado em listagens da API.
 */
export interface TrackedUserSummary {
  id: string;
  discordId: string;
  username: string;
  displayName: string;
  categoryId?: string;
  lastSeenAt: Date;
}

/**
 * Resultado da sincronização de membros com o servidor Discord.
 */
export interface SyncTrackedUsersResult {
  syncedCount: number;
  deactivatedCount: number;
  reactivatedCount: number;
}

/**
 * Desativa membro rastreado que saiu do servidor Discord.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @param discordId ID do membro no Discord
 * @returns `true` quando um registro ativo foi desativado
 */
export async function deactivateTrackedUserByDiscordId(
  organizationId: string,
  guildId: string,
  discordId: string,
): Promise<boolean> {
  const result = await TrackedUserModel.updateOne(
    {
      organizationId: new Types.ObjectId(organizationId),
      guildId,
      discordId,
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        removedAt: new Date(),
        removedReason: 'left_guild',
      },
    },
  ).exec();

  return (result.modifiedCount ?? 0) > 0;
}

/**
 * Reativa membro rastreado que retornou ao servidor Discord.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @param discordId ID do membro no Discord
 * @returns `true` quando um registro inativo foi reativado
 */
export async function reactivateTrackedUserByDiscordId(
  organizationId: string,
  guildId: string,
  discordId: string,
): Promise<boolean> {
  const result = await TrackedUserModel.updateOne(
    {
      organizationId: new Types.ObjectId(organizationId),
      guildId,
      discordId,
      isActive: false,
    },
    {
      $set: { isActive: true },
      $unset: { removedAt: '', removedReason: '' },
    },
  ).exec();

  return (result.modifiedCount ?? 0) > 0;
}

/**
 * Lista membros rastreados ativos de um guild.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @returns Documentos ativos em `tracked_users`
 */
export async function findActiveTrackedUsers(
  organizationId: string,
  guildId: string,
): Promise<ITrackedUser[]> {
  return TrackedUserModel.find({
    organizationId: new Types.ObjectId(organizationId),
    guildId,
    isActive: true,
  })
    .lean()
    .exec() as Promise<ITrackedUser[]>;
}

/**
 * Cria ou atualiza um membro rastreado do tenant/guild.
 * @param input Dados do membro Discord
 * @returns Documento persistido em `tracked_users`
 */
export async function upsertTrackedUser(input: UpsertTrackedUserInput): Promise<ITrackedUser> {
  const organizationObjectId = new Types.ObjectId(input.organizationId);
  const seenAt = input.seenAt ?? new Date();

  const trackedUser = await TrackedUserModel.findOneAndUpdate(
    {
      organizationId: organizationObjectId,
      guildId: input.guildId,
      discordId: input.discordId,
    },
    {
      $set: {
        username: input.username,
        displayName: input.displayName,
        lastSeenAt: seenAt,
        isActive: true,
      },
      $unset: {
        removedAt: '',
        removedReason: '',
      },
      $setOnInsert: {
        organizationId: organizationObjectId,
        guildId: input.guildId,
        discordId: input.discordId,
        firstSeenAt: seenAt,
      },
    },
    { upsert: true, new: true },
  ).exec();

  if (!trackedUser) {
    throw new Error('Falha ao persistir membro rastreado');
  }

  return trackedUser;
}

/**
 * Extrai tempo de espera de um erro de rate limit do gateway Discord.
 * @param error Erro capturado durante fetch de membros
 * @returns Segundos sugeridos para nova tentativa
 */
function getGatewayRateLimitRetrySeconds(error: unknown): number | undefined {
  if (!(error instanceof Error) || error.name !== 'GatewayRateLimitError') {
    return undefined;
  }

  const retryAfter = (error as Error & { data?: { retry_after?: number } }).data?.retry_after;
  return typeof retryAfter === 'number' ? Math.ceil(retryAfter) : undefined;
}

/**
 * Lista membros humanos do guild usando cache local e fetch apenas quando necessário.
 * @param guild Servidor Discord monitorado
 * @returns Membros humanos disponíveis no cache ou após fetch
 * @throws {Error} Quando o Discord limitar o gateway e não houver cache utilizável
 */
async function listHumanGuildMembers(guild: Guild) {
  const cachedMembers = [...guild.members.cache.values()].filter((member) => !member.user.bot);
  if (cachedMembers.length > 0) {
    return cachedMembers;
  }

  try {
    await guild.members.fetch();
  } catch (error) {
    const retrySeconds = getGatewayRateLimitRetrySeconds(error);
    if (retrySeconds) {
      throw new Error(`Discord limitou a sincronização de membros. Aguarde ${retrySeconds} segundos e tente novamente.`);
    }
    throw error;
  }

  return [...guild.members.cache.values()].filter((member) => !member.user.bot);
}

/**
 * Sincroniza membros humanos do servidor Discord para `tracked_users`.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @param options Opções de execução interna
 * @param options.skipReadyCheck Quando `true`, assume gateway pronto (ex.: handler `ready`)
 * @returns Quantidade de membros sincronizados e contadores de desativação/reativação
 * @throws {Error} Quando o bot não estiver conectado ou o guild não existir
 */
export async function syncTrackedUsersFromDiscordGuild(
  organizationId: string,
  guildId: string,
  options?: { skipReadyCheck?: boolean },
): Promise<SyncTrackedUsersResult> {
  if (!options?.skipReadyCheck && !canAccessDiscordGuild(guildId)) {
    try {
      await ensureDiscordClientReady();
    } catch {
      throw new Error('Bot Discord não está conectado. Aguarde a conexão e tente novamente.');
    }
  }

  if (!canAccessDiscordGuild(guildId) && !options?.skipReadyCheck) {
    throw new Error('Bot Discord não está conectado. Aguarde a conexão e tente novamente.');
  }

  let guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    try {
      guild = await discordClient.guilds.fetch(guildId);
    } catch {
      throw new Error('Servidor não encontrado no bot. Verifique se o bot está no servidor selecionado.');
    }
  }

  const members = await listHumanGuildMembers(guild);
  const organizationObjectId = new Types.ObjectId(organizationId);
  const discordIdSet = new Set(members.map((member) => member.id));

  await Promise.all(
    members.map((member) =>
      upsertTrackedUser({
        organizationId,
        guildId,
        discordId: member.id,
        username: member.user.username,
        displayName: member.displayName ?? member.user.globalName ?? member.user.username,
      }),
    ),
  );

  const [deactivateResult, reactivateResult] = await Promise.all([
    TrackedUserModel.updateMany(
      {
        organizationId: organizationObjectId,
        guildId,
        isActive: true,
        discordId: { $nin: [...discordIdSet] },
      },
      {
        $set: {
          isActive: false,
          removedAt: new Date(),
          removedReason: 'left_guild',
        },
      },
    ).exec(),
    TrackedUserModel.updateMany(
      {
        organizationId: organizationObjectId,
        guildId,
        isActive: false,
        discordId: { $in: [...discordIdSet] },
      },
      {
        $set: { isActive: true },
        $unset: { removedAt: '', removedReason: '' },
      },
    ).exec(),
  ]);

  return {
    syncedCount: members.length,
    deactivatedCount: deactivateResult.modifiedCount ?? 0,
    reactivatedCount: reactivateResult.modifiedCount ?? 0,
  };
}

/**
 * Atribui ou remove categoria de um membro rastreado.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @param trackedUserId ID do membro rastreado
 * @param categoryId ID da categoria ou `null` para remover vínculo
 * @returns Membro atualizado
 * @throws {Error} Quando membro ou categoria não existirem no tenant
 */
export async function assignTrackedUserCategory(
  organizationId: string,
  guildId: string,
  trackedUserId: string,
  categoryId: string | null,
): Promise<TrackedUserSummary> {
  const organizationObjectId = new Types.ObjectId(organizationId);
  const trackedUserObjectId = new Types.ObjectId(trackedUserId);

  if (categoryId) {
    const category = await MemberCategoryModel.findOne({
      _id: new Types.ObjectId(categoryId),
      organizationId: organizationObjectId,
      guildId,
    })
      .lean()
      .exec();

    if (!category) {
      throw new Error('Categoria não encontrada para este servidor');
    }
  }

  const updateOperation = categoryId
    ? { $set: { categoryId: new Types.ObjectId(categoryId) } }
    : { $unset: { categoryId: '' } };

  const trackedUser = await TrackedUserModel.findOneAndUpdate(
    {
      _id: trackedUserObjectId,
      organizationId: organizationObjectId,
      guildId,
    },
    updateOperation,
    { new: true },
  )
    .lean()
    .exec();

  if (!trackedUser) {
    throw new Error('Membro rastreado não encontrado');
  }

  return {
    id: String(trackedUser._id),
    discordId: trackedUser.discordId,
    username: trackedUser.username,
    displayName: trackedUser.displayName,
    categoryId: trackedUser.categoryId ? String(trackedUser.categoryId) : undefined,
    lastSeenAt: trackedUser.lastSeenAt,
  };
}

/**
 * Atribui categorias em lote para membros rastreados.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @param assignments Lista de vínculos membro → categoria
 * @returns Membros atualizados
 */
export async function bulkAssignTrackedUsersCategory(
  organizationId: string,
  guildId: string,
  assignments: Array<{ trackedUserId: string; categoryId: string | null }>,
): Promise<TrackedUserSummary[]> {
  const results: TrackedUserSummary[] = [];

  for (const assignment of assignments) {
    const updated = await assignTrackedUserCategory(
      organizationId,
      guildId,
      assignment.trackedUserId,
      assignment.categoryId,
    );
    results.push(updated);
  }

  return results;
}

/**
 * Lista membros rastreados de um guild para uso em relatórios e formulários.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @returns Membros ordenados por nome de exibição
 */
export async function listTrackedUsers(
  organizationId: string,
  guildId: string,
): Promise<TrackedUserSummary[]> {
  const organizationObjectId = new Types.ObjectId(organizationId);
  const users = await TrackedUserModel.find({ organizationId: organizationObjectId, guildId, isActive: true })
    .sort({ displayName: 1 })
    .lean()
    .exec();

  return users.map((user) => ({
    id: String(user._id),
    discordId: user.discordId,
    username: user.username,
    displayName: user.displayName,
    categoryId: user.categoryId ? String(user.categoryId) : undefined,
    lastSeenAt: user.lastSeenAt,
  }));
}
