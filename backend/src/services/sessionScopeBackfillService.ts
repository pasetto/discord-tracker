import { Model, Types } from 'mongoose';
import { PresenceSession } from '../db/models/PresenceSession';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { VoiceSession } from '../db/models/VoiceSession';

/**
 * Escopo multitenant (organização + guild) de uma sessão.
 */
export interface TenantScope {
  organizationId: Types.ObjectId;
  guildId: string;
}

/**
 * Motivo da decisão ao resolver o escopo único de um usuário.
 * - `ok`: escopo único encontrado
 * - `none`: usuário não está rastreado em nenhuma guild
 * - `ambiguous`: usuário rastreado em mais de uma guild (não dá para inferir)
 */
export type ScopeResolution =
  | { reason: 'ok'; scope: TenantScope }
  | { reason: 'none' }
  | { reason: 'ambiguous' };

/**
 * Resultado do backfill para uma collection de sessões.
 */
export interface SessionScopeBackfillResult {
  collection: string;
  totalLegacy: number;
  updated: number;
  skippedNoUser: number;
  skippedNoTracking: number;
  skippedAmbiguous: number;
}

/**
 * Opções de execução do backfill.
 */
export interface BackfillOptions {
  /** Quando `false` (padrão), apenas simula sem gravar (dry-run). */
  apply?: boolean;
  /** Tamanho do lote de escrita no MongoDB. */
  batchSize?: number;
}

const LEGACY_FILTER = {
  $or: [
    { organizationId: { $exists: false } },
    { organizationId: null },
    { guildId: { $exists: false } },
    { guildId: null },
    { guildId: '' },
  ],
};

/**
 * Resolve o escopo único (org/guild) a partir dos vínculos de rastreio do usuário.
 *
 * Sessões legadas não guardam guild; por isso só conseguimos atribuir escopo
 * com segurança quando o usuário está rastreado em exatamente uma guild.
 * @param pairs Lista de escopos (org/guild) em que o discordId aparece
 * @returns Decisão com o escopo único ou o motivo do descarte
 * @example
 * resolveUniqueScope([{ organizationId, guildId: '123' }]) // { reason: 'ok', scope }
 */
export function resolveUniqueScope(pairs: TenantScope[]): ScopeResolution {
  if (pairs.length === 0) {
    return { reason: 'none' };
  }

  const seen = new Map<string, TenantScope>();
  for (const pair of pairs) {
    seen.set(`${pair.organizationId.toHexString()}:${pair.guildId}`, pair);
  }

  const unique = [...seen.values()];
  if (unique.length === 1) {
    return { reason: 'ok', scope: unique[0] };
  }

  return { reason: 'ambiguous' };
}

/**
 * Monta o mapa `discordId -> escopos rastreados` a partir dos TrackedUsers.
 * @returns Mapa de discordId para a lista de escopos (org/guild)
 */
async function buildScopesByDiscordId(): Promise<Map<string, TenantScope[]>> {
  const trackedUsers = await TrackedUserModel.find({})
    .select({ discordId: 1, organizationId: 1, guildId: 1 })
    .lean()
    .exec();

  const map = new Map<string, TenantScope[]>();
  for (const tracked of trackedUsers) {
    const list = map.get(tracked.discordId) ?? [];
    list.push({
      organizationId: tracked.organizationId as Types.ObjectId,
      guildId: tracked.guildId,
    });
    map.set(tracked.discordId, list);
  }

  return map;
}

/**
 * Resolve, para cada `userId` core, o escopo único de destino do backfill.
 * @param userIds IDs de usuários core presentes em sessões legadas
 * @param scopesByDiscordId Mapa discordId -> escopos rastreados
 * @returns Mapa userId(hex) -> decisão de escopo
 */
async function buildScopeByUserId(
  userIds: Types.ObjectId[],
  scopesByDiscordId: Map<string, TenantScope[]>,
): Promise<Map<string, ScopeResolution>> {
  const users = await User.find({ _id: { $in: userIds } })
    .select({ discordId: 1 })
    .lean()
    .exec();

  const result = new Map<string, ScopeResolution>();
  for (const user of users) {
    const pairs = scopesByDiscordId.get(user.discordId) ?? [];
    result.set(String(user._id), resolveUniqueScope(pairs));
  }

  return result;
}

/**
 * Aplica o backfill de escopo (org/guild) em uma collection de sessões.
 * @param model Model Mongoose (VoiceSession ou PresenceSession)
 * @param scopesByDiscordId Mapa discordId -> escopos rastreados
 * @param options Opções de execução (apply, batchSize)
 * @returns Resumo com contagens de atualização e descartes
 */
async function backfillModelScope(
  model: Model<{ userId: Types.ObjectId; organizationId?: Types.ObjectId; guildId?: string }>,
  scopesByDiscordId: Map<string, TenantScope[]>,
  options: Required<BackfillOptions>,
): Promise<SessionScopeBackfillResult> {
  const collection = model.collection.collectionName;
  const totalLegacy = await model.countDocuments(LEGACY_FILTER).exec();

  const result: SessionScopeBackfillResult = {
    collection,
    totalLegacy,
    updated: 0,
    skippedNoUser: 0,
    skippedNoTracking: 0,
    skippedAmbiguous: 0,
  };

  if (totalLegacy === 0) {
    return result;
  }

  const legacyUserIds = (await model.distinct('userId', LEGACY_FILTER).exec()) as Types.ObjectId[];
  const scopeByUserId = await buildScopeByUserId(legacyUserIds, scopesByDiscordId);

  type BulkOp = {
    updateOne: {
      filter: Record<string, unknown>;
      update: { $set: { organizationId: Types.ObjectId; guildId: string } };
    };
  };

  let batch: BulkOp[] = [];

  /**
   * Descarrega o lote acumulado de operações de escrita.
   * @returns Promise resolvida após a escrita (ou no-op em dry-run)
   */
  async function flush(): Promise<void> {
    if (batch.length === 0 || !options.apply) {
      batch = [];
      return;
    }
    await model.bulkWrite(batch, { ordered: false });
    batch = [];
  }

  const cursor = model
    .find(LEGACY_FILTER)
    .select({ _id: 1, userId: 1 })
    .lean()
    .cursor();

  for await (const session of cursor) {
    const decision = scopeByUserId.get(String(session.userId));

    if (!decision) {
      result.skippedNoUser += 1;
      continue;
    }
    if (decision.reason === 'none') {
      result.skippedNoTracking += 1;
      continue;
    }
    if (decision.reason === 'ambiguous') {
      result.skippedAmbiguous += 1;
      continue;
    }

    result.updated += 1;
    batch.push({
      updateOne: {
        filter: { _id: session._id },
        update: {
          $set: {
            organizationId: decision.scope.organizationId,
            guildId: decision.scope.guildId,
          },
        },
      },
    });

    if (batch.length >= options.batchSize) {
      await flush();
    }
  }

  await flush();
  return result;
}

/**
 * Faz o backfill de `organizationId`/`guildId` nas sessões legadas de voz e presença.
 *
 * Mapeia cada sessão (via `userId` -> `discordId` -> `TrackedUser`) para o
 * escopo da guild correspondente. É idempotente (só toca documentos sem escopo)
 * e roda em dry-run por padrão.
 * @param options Opções de execução (apply, batchSize)
 * @returns Resumos por collection (voz e presença)
 */
export async function backfillSessionScopes(
  options: BackfillOptions = {},
): Promise<SessionScopeBackfillResult[]> {
  const resolved: Required<BackfillOptions> = {
    apply: options.apply ?? false,
    batchSize: options.batchSize ?? 500,
  };

  const scopesByDiscordId = await buildScopesByDiscordId();

  const voice = await backfillModelScope(
    VoiceSession as unknown as Model<{ userId: Types.ObjectId }>,
    scopesByDiscordId,
    resolved,
  );
  const presence = await backfillModelScope(
    PresenceSession as unknown as Model<{ userId: Types.ObjectId }>,
    scopesByDiscordId,
    resolved,
  );

  return [voice, presence];
}
