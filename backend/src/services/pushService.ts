import { Types } from 'mongoose';
import webPush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { createLogger } from '../logger';
import { PushSubscriptionModel } from '../db/models/PushSubscription';
import { PlatformUserModel } from '../db/models/PlatformUser';

const MANAGER_ROLES = ['owner', 'admin', 'manager'];
const log = createLogger('push-service');
let vapidConfigured = false;

/**
 * Assinatura recebida do navegador via Push API.
 */
export interface BrowserPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

/**
 * Payload mínimo para registrar uma assinatura web push.
 */
export interface RegisterPushSubscriptionInput {
  organizationId: string;
  userId: string;
  subscription: BrowserPushSubscription;
  userAgent?: string;
}

/**
 * Payload mínimo para remover uma assinatura web push.
 */
export interface UnregisterPushSubscriptionInput {
  organizationId: string;
  userId: string;
  endpoint: string;
}

/**
 * Membro sinalizado como "missing" no relatório de inatividade.
 */
export interface MissingMemberInput {
  discordId: string;
  displayName: string;
  inactiveBusinessDays: number;
}

/**
 * Entrada para envio de push a gestores sobre membros inativos.
 */
export interface NotifyManagersAboutMissingMembersInput {
  organizationId: string;
  guildId: string;
  missingMembers: MissingMemberInput[];
}

/**
 * Resultado agregado de entrega de push para auditoria/log.
 */
export interface PushDispatchResult {
  disabled: boolean;
  managers: number;
  subscriptions: number;
  sent: number;
  failed: number;
}

/**
 * Garante que VAPID esteja configurado no cliente `web-push`.
 * @returns {boolean} `true` quando o serviço está habilitado para envio.
 */
function configureVapidIfNeeded(): boolean {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return false;
  }

  if (!vapidConfigured) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
  }

  return true;
}

/**
 * Converte assinatura do navegador para o formato esperado pelo `web-push`.
 * @param {BrowserPushSubscription} subscription Assinatura persistida no banco.
 * @returns {WebPushSubscription} Assinatura serializada para envio.
 */
function toWebPushSubscription(subscription: BrowserPushSubscription): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    expirationTime: subscription.expirationTime ?? null,
  };
}

/**
 * Valida e converte string para ObjectId.
 * @param {string} value Valor textual de identificador.
 * @param {string} label Nome lógico para mensagem de erro.
 * @returns {Types.ObjectId} ObjectId validado.
 * @throws {Error} Quando o identificador for inválido.
 */
function toObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Retorna IDs dos gestores da organização para notificação push.
 * @param {Types.ObjectId} organizationId Organização alvo (tenant).
 * @returns {Promise<string[]>} IDs textuais dos gestores elegíveis.
 */
async function listManagerIds(organizationId: Types.ObjectId): Promise<string[]> {
  const managers = await PlatformUserModel.find({
    memberships: {
      $elemMatch: {
        organizationId,
        role: { $in: MANAGER_ROLES },
      },
    },
  })
    .select({ _id: 1 })
    .lean();

  return managers.map((manager) => String(manager._id));
}

/**
 * Registra ou atualiza assinatura web push do usuário atual.
 * @param {RegisterPushSubscriptionInput} input Dados do usuário e assinatura.
 * @returns {Promise<void>} Não retorna valor.
 */
export async function registerPushSubscription(input: RegisterPushSubscriptionInput): Promise<void> {
  const organizationId = toObjectId(input.organizationId, 'organizationId');
  const userId = toObjectId(input.userId, 'userId');

  await PushSubscriptionModel.findOneAndUpdate(
    {
      organizationId,
      userId,
      endpoint: input.subscription.endpoint,
    },
    {
      $set: {
        keys: {
          p256dh: input.subscription.keys.p256dh,
          auth: input.subscription.keys.auth,
        },
        expirationTime: input.subscription.expirationTime ?? null,
        userAgent: input.userAgent,
      },
      $setOnInsert: {
        organizationId,
        userId,
        endpoint: input.subscription.endpoint,
      },
    },
    { upsert: true, new: true },
  );
}

/**
 * Remove assinatura web push do usuário atual.
 * @param {UnregisterPushSubscriptionInput} input Organização, usuário e endpoint.
 * @returns {Promise<boolean>} `true` quando removeu uma assinatura.
 */
export async function unregisterPushSubscription(input: UnregisterPushSubscriptionInput): Promise<boolean> {
  const organizationId = toObjectId(input.organizationId, 'organizationId');
  const userId = toObjectId(input.userId, 'userId');

  const result = await PushSubscriptionModel.deleteOne({
    organizationId,
    userId,
    endpoint: input.endpoint,
  });

  return result.deletedCount > 0;
}

/**
 * Retorna a chave pública VAPID para inscrição no frontend.
 * @returns {string | null} Chave pública ou `null` se não configurada.
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Envia notificação push para gestores quando há membros "missing".
 * @param {NotifyManagersAboutMissingMembersInput} input Organização/guild e membros afetados.
 * @returns {Promise<PushDispatchResult>} Métricas de envio para observabilidade.
 */
export async function notifyManagersAboutMissingMembers(
  input: NotifyManagersAboutMissingMembersInput,
): Promise<PushDispatchResult> {
  if (!configureVapidIfNeeded()) {
    return { disabled: true, managers: 0, subscriptions: 0, sent: 0, failed: 0 };
  }
  if (input.missingMembers.length === 0) {
    return { disabled: false, managers: 0, subscriptions: 0, sent: 0, failed: 0 };
  }

  const organizationId = toObjectId(input.organizationId, 'organizationId');
  const managerIds = await listManagerIds(organizationId);
  if (managerIds.length === 0) {
    return { disabled: false, managers: 0, subscriptions: 0, sent: 0, failed: 0 };
  }

  const subscriptions = await PushSubscriptionModel.find({
    organizationId,
    userId: { $in: managerIds.map((id) => new Types.ObjectId(id)) },
  }).lean();

  const payload = JSON.stringify({
    title: 'Syntra - Quem sumiu',
    body: `${input.missingMembers.length} membro(s) com status de inatividade "missing".`,
    guildId: input.guildId,
    missingMembers: input.missingMembers,
    createdAt: new Date().toISOString(),
  });

  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        toWebPushSubscription({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          expirationTime: subscription.expirationTime ?? null,
        }),
        payload,
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ endpoint: subscription.endpoint });
      }
      log.warn({ err: error, endpoint: subscription.endpoint }, 'Falha ao enviar web push para assinatura');
    }
  }

  return {
    disabled: false,
    managers: managerIds.length,
    subscriptions: subscriptions.length,
    sent,
    failed,
  };
}
