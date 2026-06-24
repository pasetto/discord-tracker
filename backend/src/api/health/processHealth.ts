import { checkDiscordHealth } from '../../bot/client';
import { checkMongoHealth } from '../../db/connection';
import {
  getApplicationReadinessState,
  getUnhealthyReason,
  isProcessLive,
  isReadyForTraffic,
} from '../../runtime/applicationState';
import { getClusterInstanceId, shouldRunBackgroundJobs } from '../../runtime/clusterRole';

/**
 * Resultado consolidado das verificações de saúde do processo.
 */
export interface ProcessHealthSnapshot {
  live: boolean;
  ready: boolean;
  readiness: ReturnType<typeof getApplicationReadinessState>;
  unhealthyReason?: string;
  mongodbConnected: boolean;
  discordRequired: boolean;
  discordConnected: boolean | null;
  clusterInstanceId: number;
  runsBackgroundJobs: boolean;
}

/**
 * Avalia saúde do processo para probes live/ready e `/health`.
 * @returns Snapshot com flags usadas pelos endpoints HTTP
 */
export function evaluateProcessHealth(): ProcessHealthSnapshot {
  const mongodbConnected = checkMongoHealth();
  const runsBackgroundJobs = shouldRunBackgroundJobs();
  const discordRequired = runsBackgroundJobs;
  const discordConnected = discordRequired ? checkDiscordHealth() : null;
  const ready = isReadyForTraffic() && mongodbConnected;

  return {
    live: isProcessLive(),
    ready,
    readiness: getApplicationReadinessState(),
    unhealthyReason: getUnhealthyReason(),
    mongodbConnected,
    discordRequired,
    discordConnected,
    clusterInstanceId: getClusterInstanceId(),
    runsBackgroundJobs,
  };
}
