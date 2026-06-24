import { Types } from 'mongoose';
import { OrganizationModel } from '../db/models/Organization';
import { IntradayAlertDispatchModel, type IntradayAlertStatus } from '../db/models/IntradayAlertDispatch';
import type { IntradayInactivityEntry } from '../services/intradayInactivityService';
import { getIntradayInactivityReport } from '../services/intradayInactivityService';
import { listTrackedGuildIdsByOrganization } from '../services/inactivityService';
import { getInactivitySettings } from '../services/inactivitySettingsService';
import { notifyManagersAboutIntradayConcerns } from '../services/pushService';
import { enqueueWebhookDeliveries } from '../services/webhookService';
import { createLogger } from '../logger';
import { getZonedParts } from '../utils/timezone';

const FIFTEEN_MINUTES_MS = 15 * 60_000;
const log = createLogger('intraday-inactivity-cron');

/**
 * Chaves mínimas para deduplicação intradiária.
 */
interface IntradayDedupEntry {
  trackedUserId: Types.ObjectId;
  status: IntradayAlertStatus;
}

/**
 * Converte data em chave local YYYY-MM-DD baseada no timezone da organização.
 * @param now Instante de referência
 * @param timezone Timezone IANA da organização
 * @returns Chave textual da data local
 */
function getLocalDateKey(now: Date, timezone: string): string {
  const parts = getZonedParts(now, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Verifica se entrada intradiária representa um alerta de preocupação.
 * @param entry Entrada do relatório intradiário
 * @returns `true` quando o status deve gerar push/webhook
 */
function isConcernEntry(entry: IntradayInactivityEntry): entry is IntradayInactivityEntry & { status: IntradayAlertStatus } {
  return entry.status === 'not_started' || entry.status === 'low_collaboration_today';
}

/**
 * Registra pares (membro,status) de forma idempotente para evitar spam no dia.
 * @param input Contexto mínimo para deduplicação por organização/guild/data
 * @returns Entradas inéditas que devem disparar notificação
 */
async function persistUndispatchedAlerts(input: {
  organizationId: string;
  guildId: string;
  localDate: string;
  detectedAt: Date;
  entries: Array<IntradayInactivityEntry & { status: IntradayAlertStatus }>;
}): Promise<Array<IntradayInactivityEntry & { status: IntradayAlertStatus }>> {
  const newEntries: Array<IntradayInactivityEntry & { status: IntradayAlertStatus }> = [];
  const organizationObjectId = new Types.ObjectId(input.organizationId);

  for (const entry of input.entries) {
    const filter = {
      organizationId: organizationObjectId,
      guildId: input.guildId,
      trackedUserId: entry.trackedUserId,
      localDate: input.localDate,
      status: entry.status,
    } satisfies IntradayDedupEntry & {
      organizationId: Types.ObjectId;
      guildId: string;
      localDate: string;
    };

    const result = await IntradayAlertDispatchModel.updateOne(
      filter,
      {
        $setOnInsert: {
          organizationId: organizationObjectId,
          guildId: input.guildId,
          trackedUserId: entry.trackedUserId,
          localDate: input.localDate,
          status: entry.status,
          firstDetectedAt: input.detectedAt,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      newEntries.push(entry);
    }
  }

  return newEntries;
}

/**
 * Executa um ciclo do cron intradiário para todas as organizações/guilds rastreadas.
 * @param now Instante de referência para execução
 * @returns Quantidade de alertas inéditos disparados no ciclo
 */
export async function runIntradayInactivityCronTick(now: Date = new Date()): Promise<number> {
  const organizations = await OrganizationModel.find({})
    .select({ _id: 1, settings: 1 })
    .lean()
    .exec();

  let dispatchedConcerns = 0;

  for (const organization of organizations) {
    const organizationId = String(organization._id);
    const timezone = organization.settings?.timezone ?? 'America/Sao_Paulo';
    const localDate = getLocalDateKey(now, timezone);
    const guildIds = await listTrackedGuildIdsByOrganization(organizationId);

    for (const guildId of guildIds) {
      const report = await getIntradayInactivityReport(organizationId, guildId, now);
      if (!report.isBusinessDay || !report.isWithinWorkHours) {
        continue;
      }

      const concernEntries = report.concernEntries.filter(isConcernEntry);
      if (concernEntries.length === 0) {
        continue;
      }

      const freshConcerns = await persistUndispatchedAlerts({
        organizationId,
        guildId,
        localDate,
        detectedAt: report.generatedAt,
        entries: concernEntries,
      });
      if (freshConcerns.length === 0) {
        continue;
      }

      const settings = await getInactivitySettings(organizationId, guildId);
      const shouldNotifyPush = settings.notifyManagerPush && settings.notifyIntradayPush;

      if (shouldNotifyPush) {
        await notifyManagersAboutIntradayConcerns({
          organizationId,
          guildId,
          concerns: freshConcerns.map((entry) => ({
            trackedUserId: String(entry.trackedUserId),
            discordId: entry.discordId,
            displayName: entry.displayName,
            status: entry.status,
            elapsedWorkPercent: entry.elapsedWorkPercent,
            collaborationPercentOfElapsed: entry.collaborationPercentOfElapsed,
          })),
        });
      }

      await enqueueWebhookDeliveries({
        organizationId,
        event: 'member.intraday_concern.detected',
        payload: {
          guildId,
          concerns: freshConcerns.map((entry) => ({
            trackedUserId: String(entry.trackedUserId),
            discordId: entry.discordId,
            displayName: entry.displayName,
            status: entry.status,
            elapsedWorkPercent: entry.elapsedWorkPercent,
            collaborationPercentOfElapsed: entry.collaborationPercentOfElapsed,
          })),
          concernCount: freshConcerns.length,
          generatedAt: report.generatedAt.toISOString(),
          detectedAt: now.toISOString(),
          localDate,
        },
      });

      dispatchedConcerns += freshConcerns.length;
    }
  }

  log.info({ dispatchedConcerns }, 'Ciclo do cron intradiário concluído');
  return dispatchedConcerns;
}

/**
 * Inicia worker intradiário para detectar quem não apareceu durante o expediente.
 * @returns Função para encerrar o intervalo em shutdown gracioso
 */
export function startIntradayInactivityCron(): () => void {
  const interval = setInterval(() => {
    runIntradayInactivityCronTick().catch((error) => {
      log.error({ err: error }, 'Falha no cron intradiário');
    });
  }, FIFTEEN_MINUTES_MS);

  return () => clearInterval(interval);
}
