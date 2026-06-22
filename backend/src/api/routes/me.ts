import Router from '@koa/router';
import { Types } from 'mongoose';
import { TrackedUserModel } from '../../db/models/TrackedUser';
import { User } from '../../db/models/User';
import { VoiceSession } from '../../db/models/VoiceSession';
import { PresenceSession } from '../../db/models/PresenceSession';
import { TextActivityEventModel } from '../../db/models/TextActivityEvent';
import { PlannedAbsenceModel, PlannedAbsenceStatus, PlannedAbsenceType } from '../../db/models/PlannedAbsence';

const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);

/**
 * Membership presente no JWT da sessão autenticada.
 */
interface JwtMembership {
  organizationId: string;
  role: string;
}

/**
 * Shape mínimo do usuário autenticado disponível em `ctx.state.user`.
 */
interface JwtUserShape {
  discordId?: string;
  memberships?: JwtMembership[];
}

/**
 * Perfil rastreado do colaborador no tenant.
 */
interface MeTrackedProfile {
  _id: Types.ObjectId;
  guildId: string;
  discordId: string;
  displayName: string;
  lastSeenAt: Date;
  lastTextActivityAt?: Date;
}

/**
 * Ausência planejada simplificada para retorno da API `/me`.
 */
interface MeAbsenceSummary {
  id: string;
  guildId: string;
  type: PlannedAbsenceType;
  status: PlannedAbsenceStatus;
  startDate: Date;
  endDate: Date;
  note?: string;
}

/**
 * Contexto autenticado para escopo do portal colaborador.
 */
interface MeRequestIdentity {
  organizationId: string;
  discordId: string;
}

/** Rotas do portal colaborador (`/api/v1/me`). */
export const meRouter = new Router();

/**
 * Resolve organização ativa para endpoints `/me`.
 * @param ctx Contexto Koa da requisição
 * @returns Identidade autenticada com organizationId e discordId
 * @throws {Error} Quando JWT estiver incompleto ou sem membership válido
 */
function resolveMeIdentity(ctx: Router.RouterContext): MeRequestIdentity {
  const user = ctx.state.user as JwtUserShape | undefined;
  const discordId = user?.discordId?.trim();
  const memberships = user?.memberships ?? [];
  const requestedOrgId = typeof ctx.query.organizationId === 'string' ? ctx.query.organizationId.trim() : '';

  if (!discordId) {
    throw new Error('Usuário autenticado inválido');
  }

  if (memberships.length === 0) {
    throw new Error('Nenhuma organização vinculada ao usuário autenticado');
  }

  const membership = requestedOrgId
    ? memberships.find((item) => item.organizationId === requestedOrgId)
    : memberships[0];

  if (!membership || !membership.organizationId) {
    throw new Error('organizationId inválido para o usuário autenticado');
  }

  if (!VIEWER_ROLES.has((membership.role ?? '').toLowerCase())) {
    ctx.throw(403, 'Permissão insuficiente para acessar o portal colaborador');
  }

  return { organizationId: membership.organizationId, discordId };
}

/**
 * Converte string para ObjectId validando formato.
 * @param value Valor textual recebido
 * @param field Nome lógico do campo
 * @returns ObjectId válido
 * @throws {Error} Quando valor não for um ObjectId válido
 */
function parseObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Lista perfis rastreados do colaborador no tenant selecionado.
 * @param identity Identidade autenticada do request
 * @returns Perfis rastreados por guild no tenant
 */
async function listTrackedProfiles(identity: MeRequestIdentity): Promise<MeTrackedProfile[]> {
  return TrackedUserModel.find({
    organizationId: parseObjectId(identity.organizationId, 'organizationId'),
    discordId: identity.discordId,
  })
    .select({
      _id: 1,
      guildId: 1,
      discordId: 1,
      displayName: 1,
      lastSeenAt: 1,
      lastTextActivityAt: 1,
    })
    .lean()
    .exec() as Promise<MeTrackedProfile[]>;
}

/**
 * Busca userId da collection `users` para agregações de voz/presença.
 * @param discordId Identificador Discord do colaborador autenticado
 * @returns ObjectId do usuário legado, quando existir
 */
async function findCoreUserIdByDiscordId(discordId: string): Promise<Types.ObjectId | undefined> {
  const user = await User.findOne({ discordId }).select({ _id: 1 }).lean().exec();
  return (user?._id as Types.ObjectId | undefined) ?? undefined;
}

/**
 * Soma segundos de sessão de voz colaborativa no tenant.
 * @param userId Identificador do usuário da collection `users`
 * @returns Total de segundos de colaboração em voz
 */
async function getTotalVoiceSeconds(userId: Types.ObjectId | undefined): Promise<number> {
  if (!userId) {
    return 0;
  }

  const rows = await VoiceSession.aggregate<{ _id: null; totalSeconds: number }>([
    {
      $match: {
        userId,
        durationSeconds: { $gt: 0 },
        sessionType: 'VOICE',
        isIgnoredChannel: false,
      },
    },
    {
      $group: {
        _id: null,
        totalSeconds: { $sum: '$durationSeconds' },
      },
    },
  ]);

  return rows[0]?.totalSeconds ?? 0;
}

/**
 * Soma segundos de presença rastreada no tenant.
 * @param userId Identificador do usuário da collection `users`
 * @returns Total de segundos de presença monitorada
 */
async function getTotalPresenceSeconds(userId: Types.ObjectId | undefined): Promise<number> {
  if (!userId) {
    return 0;
  }

  const rows = await PresenceSession.aggregate<{ _id: null; totalSeconds: number }>([
    {
      $match: {
        userId,
        durationSeconds: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalSeconds: { $sum: '$durationSeconds' },
      },
    },
  ]);

  return rows[0]?.totalSeconds ?? 0;
}

/**
 * Conta eventos textuais por metadados do colaborador.
 * @param identity Identidade autenticada do request
 * @returns Total de eventos de texto sem conteúdo
 */
async function countTextMetadataEvents(identity: MeRequestIdentity): Promise<number> {
  return TextActivityEventModel.countDocuments({
    organizationId: parseObjectId(identity.organizationId, 'organizationId'),
    discordId: identity.discordId,
  });
}

/**
 * Lista ausências planejadas do colaborador autenticado.
 * @param identity Identidade autenticada do request
 * @param trackedProfiles Perfis rastreados no tenant
 * @returns Ausências ordenadas da mais recente para a mais antiga
 */
async function listOwnPlannedAbsences(
  identity: MeRequestIdentity,
  trackedProfiles: MeTrackedProfile[],
): Promise<MeAbsenceSummary[]> {
  if (trackedProfiles.length === 0) {
    return [];
  }

  const trackedUserIds = trackedProfiles.map((profile) => profile._id);
  const absences = await PlannedAbsenceModel.find({
    organizationId: parseObjectId(identity.organizationId, 'organizationId'),
    trackedUserId: { $in: trackedUserIds },
  })
    .sort({ startDate: -1, createdAt: -1 })
    .lean()
    .exec();

  return absences.map((absence) => ({
    id: String(absence._id),
    guildId: absence.guildId,
    type: absence.type,
    status: absence.status,
    startDate: absence.startDate,
    endDate: absence.endDate,
    note: absence.note,
  }));
}

/**
 * @openapi
 * /me/collaboration:
 *   get:
 *     tags:
 *       - Me
 *     summary: Retorna resumo de sinais de colaboração do próprio usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo consolidado por voz, presença e metadados de texto
 */
meRouter.get('/me/collaboration', async (ctx) => {
  try {
    const identity = resolveMeIdentity(ctx);
    const trackedProfiles = await listTrackedProfiles(identity);
    const coreUserId = await findCoreUserIdByDiscordId(identity.discordId);

    const [voiceSeconds, presenceSeconds, textEventCount] = await Promise.all([
      getTotalVoiceSeconds(coreUserId),
      getTotalPresenceSeconds(coreUserId),
      countTextMetadataEvents(identity),
    ]);

    ctx.body = {
      summary: {
        organizationId: identity.organizationId,
        discordId: identity.discordId,
        trackedProfilesCount: trackedProfiles.length,
        guildIds: Array.from(new Set(trackedProfiles.map((profile) => profile.guildId))),
        lastPresenceAt: trackedProfiles
          .map((profile) => profile.lastSeenAt)
          .filter((value): value is Date => Boolean(value))
          .sort((left, right) => right.getTime() - left.getTime())[0] ?? null,
        lastTextMetadataAt: trackedProfiles
          .map((profile) => profile.lastTextActivityAt)
          .filter((value): value is Date => Boolean(value))
          .sort((left, right) => right.getTime() - left.getTime())[0] ?? null,
        signals: {
          voiceSessions: {
            totalCollaborationSeconds: voiceSeconds,
            totalCollaborationHours: Number((voiceSeconds / 3600).toFixed(2)),
          },
          presence: {
            totalTrackedSeconds: presenceSeconds,
            totalTrackedHours: Number((presenceSeconds / 3600).toFixed(2)),
          },
          text: {
            totalMetadataEvents: textEventCount,
            contentStored: false,
          },
        },
      },
    };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /me/absences:
 *   get:
 *     tags:
 *       - Me
 *     summary: Lista ausências planejadas do próprio colaborador
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ausências do usuário autenticado
 */
meRouter.get('/me/absences', async (ctx) => {
  try {
    const identity = resolveMeIdentity(ctx);
    const trackedProfiles = await listTrackedProfiles(identity);
    const absences = await listOwnPlannedAbsences(identity, trackedProfiles);

    ctx.body = { absences };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /me/data-export:
 *   get:
 *     tags:
 *       - Me
 *     summary: Exporta stub LGPD dos dados rastreados do colaborador
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export JSON de dados próprios sem conteúdo textual
 */
meRouter.get('/me/data-export', async (ctx) => {
  try {
    const identity = resolveMeIdentity(ctx);
    const trackedProfiles = await listTrackedProfiles(identity);
    const coreUserId = await findCoreUserIdByDiscordId(identity.discordId);

    const [voiceSeconds, presenceSeconds, textEventCount, absences] = await Promise.all([
      getTotalVoiceSeconds(coreUserId),
      getTotalPresenceSeconds(coreUserId),
      countTextMetadataEvents(identity),
      listOwnPlannedAbsences(identity, trackedProfiles),
    ]);

    ctx.body = {
      exportData: {
        generatedAt: new Date().toISOString(),
        user: {
          discordId: identity.discordId,
          organizationId: identity.organizationId,
          trackedProfiles,
        },
        collaborationSignals: {
          voice: {
            totalCollaborationSeconds: voiceSeconds,
            totalCollaborationHours: Number((voiceSeconds / 3600).toFixed(2)),
          },
          presence: {
            totalTrackedSeconds: presenceSeconds,
            totalTrackedHours: Number((presenceSeconds / 3600).toFixed(2)),
          },
          textMetadata: {
            totalEvents: textEventCount,
            eventTypesTracked: ['message', 'thread_reply', 'reaction'],
          },
        },
        absences,
        privacy: {
          messageContentStored: false,
          notes: [
            'Este export inclui apenas metadados de colaboração.',
            'Conteúdo de mensagens, áudio e DMs não é armazenado.',
          ],
        },
      },
    };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
