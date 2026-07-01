import Router from '@koa/router';
import { Types } from 'mongoose';
import { TrackedUserModel } from '../../db/models/TrackedUser';
import { PlatformUserModel } from '../../db/models/PlatformUser';
import { User } from '../../db/models/User';
import { VoiceSession } from '../../db/models/VoiceSession';
import { PresenceSession } from '../../db/models/PresenceSession';
import { TextActivityEventModel } from '../../db/models/TextActivityEvent';
import { PlannedAbsenceModel, PlannedAbsenceStatus, PlannedAbsenceType } from '../../db/models/PlannedAbsence';
import { AuditTrailExportEntry, listAuditTrailExportStub } from '../../services/auditLogService';
import { signAccessToken } from '../../services/authService';
import { buildAuthPayloadFromPlatformUser } from '../../services/platformAuthService';
import { getMemberGamificationInsights } from '../../services/gamificationInsightsService';
import { createAbsenceRequest } from '../../services/plannedAbsenceService';

const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);
const ALLOWED_ABSENCE_TYPES = new Set<PlannedAbsenceType>(['vacation', 'pto', 'sick_leave', 'other']);

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
  id?: string;
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
 * Payload aceito para criação de solicitação de ausência no portal `/me`.
 */
interface MeAbsenceRequestPayload {
  guildId?: string;
  type?: PlannedAbsenceType;
  startDate?: string;
  endDate?: string;
  note?: string;
}

/**
 * Contexto autenticado para escopo do portal colaborador.
 */
interface MeRequestIdentity {
  organizationId: string;
  discordId: string;
}

/**
 * Estrutura de trilha de auditoria simplificada para export LGPD.
 */
interface MeAuditTrailExportStub {
  status: 'stub';
  entries: AuditTrailExportEntry[];
  notes: string[];
}

/** Rotas do portal colaborador (`/api/v1/me`). */
export const meRouter = new Router();

/**
 * @openapi
 * /me/discord-link:
 *   put:
 *     tags:
 *       - Me
 *     summary: Vincula o usuário da plataforma a um perfil Discord rastreado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - discordId
 *             properties:
 *               discordId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vínculo criado e novo access token emitido
 *       404:
 *         description: Perfil Discord não encontrado entre membros rastreados
 */
meRouter.put('/me/discord-link', async (ctx) => {
  try {
    const user = ctx.state.user as JwtUserShape | undefined;
    const userId = user?.id?.trim();
    if (!userId) {
      ctx.status = 401;
      ctx.body = { error: 'Sessão inválida' };
      return;
    }

    const payload = ctx.request.body as { discordId?: string };
    const discordId = payload.discordId?.trim();
    if (!discordId) {
      ctx.status = 400;
      ctx.body = { error: 'discordId é obrigatório' };
      return;
    }

    const memberships = user?.memberships ?? [];
    if (memberships.length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'Nenhuma organização vinculada ao usuário autenticado' };
      return;
    }

    const requestedOrgId = typeof ctx.query.organizationId === 'string' ? ctx.query.organizationId.trim() : '';
    const membership = requestedOrgId
      ? memberships.find((item) => item.organizationId === requestedOrgId)
      : memberships[0];

    if (!membership?.organizationId) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId inválido para o usuário autenticado' };
      return;
    }

    const trackedProfile = await TrackedUserModel.findOne({
      organizationId: new Types.ObjectId(membership.organizationId),
      discordId,
      isActive: true,
    })
      .select('displayName')
      .lean()
      .exec();

    if (!trackedProfile) {
      ctx.status = 404;
      ctx.body = {
        error:
          'Perfil Discord não encontrado entre os membros rastreados desta organização. Sincronize os membros primeiro.',
      };
      return;
    }

    const platformUser = await PlatformUserModel.findByIdAndUpdate(
      userId,
      { $set: { discordId } },
      { new: true },
    ).exec();

    if (!platformUser) {
      ctx.status = 404;
      ctx.body = { error: 'Usuário da plataforma não encontrado' };
      return;
    }

    const authPayload = buildAuthPayloadFromPlatformUser(platformUser);
    ctx.body = {
      accessToken: signAccessToken(authPayload),
      discordId,
      displayName: trackedProfile.displayName,
    };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * Resolve organização ativa para endpoints `/me`.
 * @param ctx Contexto Koa da requisição
 * @returns Identidade autenticada com organizationId e discordId
 * @throws {Error} Quando JWT estiver incompleto ou sem membership válido
 */
async function resolveMeIdentity(ctx: Router.RouterContext): Promise<MeRequestIdentity> {
  const user = ctx.state.user as JwtUserShape | undefined;
  const userId = user?.id?.trim();
  let discordId = user?.discordId?.trim();
  const memberships = user?.memberships ?? [];
  const requestedOrgId = typeof ctx.query.organizationId === 'string' ? ctx.query.organizationId.trim() : '';

  if (!discordId && userId) {
    const platformUser = await PlatformUserModel.findById(userId).select('discordId').lean().exec();
    discordId = platformUser?.discordId?.trim();
  }

  if (!discordId) {
    const error = new Error(
      'Conta não vinculada a um perfil Discord. Vincule seu Discord em Meu portal ou peça ao gestor.',
    ) as Error & { status?: number };
    error.status = 422;
    throw error;
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
 * Converte string ISO em Date validando formato.
 * @param value Valor textual recebido no payload
 * @param field Nome do campo para mensagens de erro
 * @returns Data válida
 * @throws {Error} Quando data for inválida
 */
function parseDate(value: string | undefined, field: string): Date {
  if (!value) {
    throw new Error(`${field} é obrigatório`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} inválido`);
  }

  return parsed;
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
    isActive: true,
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
 * @param organizationId Organização ativa do portal
 * @param guildIds Guilds rastreadas do colaborador no tenant
 * @returns Total de segundos de colaboração em voz
 */
async function getTotalVoiceSeconds(
  userId: Types.ObjectId | undefined,
  organizationId: string,
  guildIds: string[],
): Promise<number> {
  if (!userId || guildIds.length === 0) {
    return 0;
  }

  const rows = await VoiceSession.aggregate<{ _id: null; totalSeconds: number }>([
    {
      $match: {
        userId,
        organizationId: new Types.ObjectId(organizationId),
        guildId: { $in: guildIds },
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
 * @param organizationId Organização ativa do portal
 * @param guildIds Guilds rastreadas do colaborador no tenant
 * @returns Total de segundos de presença monitorada
 */
async function getTotalPresenceSeconds(
  userId: Types.ObjectId | undefined,
  organizationId: string,
  guildIds: string[],
): Promise<number> {
  if (!userId || guildIds.length === 0) {
    return 0;
  }

  const rows = await PresenceSession.aggregate<{ _id: null; totalSeconds: number }>([
    {
      $match: {
        userId,
        organizationId: new Types.ObjectId(organizationId),
        guildId: { $in: guildIds },
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
 * Monta trilha de auditoria simplificada para export de dados do titular.
 * @param ctx Contexto Koa do request autenticado
 * @param identity Identidade resolvida do colaborador autenticado
 * @returns Stub de trilha com entradas resumidas quando actorId for válido
 */
async function buildAuditTrailExportStub(
  ctx: Router.RouterContext,
  identity: MeRequestIdentity,
): Promise<MeAuditTrailExportStub> {
  const user = ctx.state.user as JwtUserShape | undefined;
  const actorId = user?.id?.trim();

  if (!actorId || !Types.ObjectId.isValid(actorId)) {
    return {
      status: 'stub',
      entries: [],
      notes: [
        'Trilha de auditoria habilitada para próximos ciclos de compliance.',
        'Nenhum actorId válido foi informado no JWT atual para vincular eventos existentes.',
      ],
    };
  }

  const entries = await listAuditTrailExportStub({
    organizationId: identity.organizationId,
    actorId,
    limit: 20,
  });

  return {
    status: 'stub',
    entries,
    notes: [
      'Stub LGPD: esta trilha inclui apenas resumo de ações sensíveis já auditadas.',
      'Metadados completos de auditoria permanecem restritos ao escopo administrativo.',
    ],
  };
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
    const identity = await resolveMeIdentity(ctx);
    const trackedProfiles = await listTrackedProfiles(identity);
    const coreUserId = await findCoreUserIdByDiscordId(identity.discordId);
    const trackedGuildIds = Array.from(new Set(trackedProfiles.map((profile) => profile.guildId)));

    const [voiceSeconds, presenceSeconds, textEventCount] = await Promise.all([
      getTotalVoiceSeconds(coreUserId, identity.organizationId, trackedGuildIds),
      getTotalPresenceSeconds(coreUserId, identity.organizationId, trackedGuildIds),
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
    const identity = await resolveMeIdentity(ctx);
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
 * /me/absence-requests:
 *   post:
 *     tags:
 *       - Me
 *     summary: Solicita PTO/ausência para aprovação do gestor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - startDate
 *               - endDate
 *             properties:
 *               guildId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [vacation, pto, sick_leave, other]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Solicitação criada com status pending_approval
 */
meRouter.post('/me/absence-requests', async (ctx) => {
  try {
    const identity = await resolveMeIdentity(ctx);
    const user = ctx.state.user as JwtUserShape | undefined;
    const userId = user?.id?.trim();
    if (!userId || !Types.ObjectId.isValid(userId)) {
      ctx.status = 401;
      ctx.body = { error: 'Sessão inválida' };
      return;
    }

    const payload = (ctx.request.body ?? {}) as MeAbsenceRequestPayload;
    if (!payload.type || !ALLOWED_ABSENCE_TYPES.has(payload.type)) {
      ctx.status = 400;
      ctx.body = { error: 'type inválido' };
      return;
    }

    const trackedProfiles = await listTrackedProfiles(identity);
    if (trackedProfiles.length === 0) {
      ctx.status = 404;
      ctx.body = { error: 'Nenhum perfil rastreado encontrado para o usuário autenticado' };
      return;
    }

    const requestedGuildId = payload.guildId?.trim() ?? '';
    if (!requestedGuildId && trackedProfiles.length > 1) {
      ctx.status = 400;
      ctx.body = { error: 'guildId é obrigatório quando há múltiplos perfis rastreados' };
      return;
    }

    const selectedProfile = requestedGuildId
      ? trackedProfiles.find((profile) => profile.guildId === requestedGuildId)
      : trackedProfiles[0];
    if (!selectedProfile) {
      ctx.status = 404;
      ctx.body = { error: 'Perfil rastreado não encontrado para o guildId informado' };
      return;
    }

    const request = await createAbsenceRequest({
      organizationId: identity.organizationId,
      guildId: selectedProfile.guildId,
      trackedUserId: String(selectedProfile._id),
      discordId: identity.discordId,
      type: payload.type,
      startDate: parseDate(payload.startDate, 'startDate'),
      endDate: parseDate(payload.endDate, 'endDate'),
      note: payload.note,
      requestedBy: userId,
    });

    ctx.status = 201;
    ctx.body = {
      request: {
        id: String(request._id),
        guildId: request.guildId,
        type: request.type,
        status: request.status,
        startDate: request.startDate,
        endDate: request.endDate,
        note: request.note,
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
    const identity = await resolveMeIdentity(ctx);
    const trackedProfiles = await listTrackedProfiles(identity);
    const coreUserId = await findCoreUserIdByDiscordId(identity.discordId);
    const trackedGuildIds = Array.from(new Set(trackedProfiles.map((profile) => profile.guildId)));

    const [voiceSeconds, presenceSeconds, textEventCount, absences, auditTrail] = await Promise.all([
      getTotalVoiceSeconds(coreUserId, identity.organizationId, trackedGuildIds),
      getTotalPresenceSeconds(coreUserId, identity.organizationId, trackedGuildIds),
      countTextMetadataEvents(identity),
      listOwnPlannedAbsences(identity, trackedProfiles),
      buildAuditTrailExportStub(ctx, identity),
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
        auditTrail,
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

/**
 * @openapi
 * /me/gamification:
 *   get:
 *     tags:
 *       - Me
 *     summary: Badges e streak do colaborador autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conquistas e streak do titular
 */
meRouter.get('/me/gamification', async (ctx) => {
  try {
    const identity = await resolveMeIdentity(ctx);
    const trackedProfiles = await listTrackedProfiles(identity);
    const requestedGuildId = typeof ctx.query.guildId === 'string' ? ctx.query.guildId.trim() : '';
    const profile =
      trackedProfiles.find((item) => item.guildId === requestedGuildId) ?? trackedProfiles[0];

    if (!profile) {
      ctx.status = 404;
      ctx.body = { error: 'Nenhum perfil rastreado encontrado para este usuário' };
      return;
    }

    const insights = await getMemberGamificationInsights({
      organizationId: identity.organizationId,
      guildId: profile.guildId,
      discordId: identity.discordId,
      displayName: profile.displayName,
    });

    ctx.body = { insights };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
