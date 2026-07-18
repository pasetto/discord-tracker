import { createLogger } from '../logger';
import { OrganizationModel } from '../db/models/Organization';
import { WorkCalendarModel, createDefaultWorkWeek } from '../db/models/WorkCalendar';
import { generateWeeklyInactivitySnapshot, listTrackedGuildIdsByOrganization } from '../services/inactivityService';
import { getInactivitySettings } from '../services/inactivitySettingsService';
import { sendWeeklyInactivityDigestToManagers } from '../services/emailDigestService';
import { notifyManagersAboutMissingMembers } from '../services/pushService';
import { enqueueWebhookDeliveries } from '../services/webhookService';
import { getZonedParts } from '../utils/timezone';
import { isBusinessDayInTimezone } from '../utils/workWindowUtils';

const ONE_MINUTE_MS = 60_000;
const TARGET_HOUR = 8;
const TARGET_MINUTE = 0;
const log = createLogger('inactivity-cron');
const lastExecutionByOrgAndGuild = new Map<string, string>();

/**
 * Retorna chave de data local YYYY-MM-DD para deduplicar execução diária.
 * @param now Instante de referência
 * @param timeZone Timezone IANA da organização
 * @returns Chave textual de data local
 */
function getLocalDateKey(now: Date, timeZone: string): string {
  const parts = getZonedParts(now, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Verifica se o relógio local da organização está em 08:00.
 * @param now Instante atual em UTC
 * @param timeZone Timezone IANA da organização
 * @returns true quando deve executar o cron naquele instante
 */
function shouldRunAtTargetTime(now: Date, timeZone: string): boolean {
  const parts = getZonedParts(now, timeZone);
  return parts.hour === TARGET_HOUR && parts.minute === TARGET_MINUTE;
}

/**
 * Resolve calendário organizacional usado para decidir dia útil.
 * @param organizationId Identificador textual da organização
 * @returns Jornada e feriados aplicáveis para execução do cron
 */
async function resolveOrganizationCalendar(
  organizationId: string,
): Promise<{ workWeek: ReturnType<typeof createDefaultWorkWeek>; holidays: Array<{ date: string; name: string; type: 'national_br' | 'company_custom'; recurring?: boolean }> }> {
  const calendar = await WorkCalendarModel.findOne({ organizationId, guildId: { $exists: false } })
    .select({ workWeek: 1, holidays: 1 })
    .lean()
    .exec();

  if (!calendar) {
    return { workWeek: createDefaultWorkWeek(), holidays: [] };
  }

  return {
    workWeek: calendar.workWeek,
    holidays: calendar.holidays,
  };
}

/**
 * Executa um ciclo do cron de inatividade para todas as organizações elegíveis.
 * @param now Instante de referência para verificação de horário
 * @returns Quantidade de snapshots semanais gerados no ciclo
 */
export async function runInactivityCronTick(now: Date = new Date()): Promise<number> {
  const organizations = await OrganizationModel.find({})
    .select({ _id: 1, settings: 1 })
    .lean()
    .exec();

  let snapshotsGenerated = 0;

  for (const organization of organizations) {
    const organizationId = String(organization._id);
    const timezone = organization.settings?.timezone ?? 'America/Sao_Paulo';

    if (!shouldRunAtTargetTime(now, timezone)) {
      continue;
    }

    const calendar = await resolveOrganizationCalendar(organizationId);
    // Usa timezone da org (não UTC): às 08:00 locais em UTC+N o dia UTC pode ser o anterior.
    if (!isBusinessDayInTimezone(calendar, now, timezone)) {
      continue;
    }

    const guildIds = await listTrackedGuildIdsByOrganization(organizationId);
    const localDateKey = getLocalDateKey(now, timezone);

    for (const guildId of guildIds) {
      const executionKey = `${organizationId}:${guildId}`;
      if (lastExecutionByOrgAndGuild.get(executionKey) === localDateKey) {
        continue;
      }

      const snapshot = await generateWeeklyInactivitySnapshot(organizationId, guildId, now);
      const missingMembers = snapshot.entries
        .filter((entry) => entry.status === 'missing')
        .map((entry) => ({
          discordId: entry.discordId,
          displayName: entry.displayName,
          inactiveBusinessDays: entry.inactiveBusinessDays,
        }));

      if (missingMembers.length > 0) {
        const settings = await getInactivitySettings(organizationId, guildId);

        if (settings.notifyManagerPush) {
          await notifyManagersAboutMissingMembers({
            organizationId,
            guildId,
            missingMembers,
          });
        }

        if (settings.notifyManagerEmail) {
          await sendWeeklyInactivityDigestToManagers({
            organizationId,
            guildId,
            missingMembers,
            periodEnd: snapshot.periodEnd,
          });
        }

        await enqueueWebhookDeliveries({
          organizationId,
          event: 'member.inactivity.detected',
          payload: {
            guildId,
            missingCount: missingMembers.length,
            missingMembers,
            periodStart: snapshot.periodStart.toISOString(),
            periodEnd: snapshot.periodEnd.toISOString(),
            detectedAt: now.toISOString(),
          },
        });
      }
      lastExecutionByOrgAndGuild.set(executionKey, localDateKey);
      snapshotsGenerated += 1;
    }
  }

  log.info({ snapshotsGenerated }, 'Ciclo do cron de inatividade concluído');
  return snapshotsGenerated;
}

/**
 * Inicia cron que recalcula inatividade às 08:00 da timezone de cada organização.
 * @returns Função para encerrar o cron em shutdown gracioso
 */
export function startInactivityCron(): () => void {
  const interval = setInterval(() => {
    runInactivityCronTick().catch((error) => {
      log.error({ err: error }, 'Falha no cron de inatividade');
    });
  }, ONE_MINUTE_MS);

  return () => clearInterval(interval);
}
