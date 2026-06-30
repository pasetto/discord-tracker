import { Types } from 'mongoose';
import { PresenceSession } from '../db/models/PresenceSession';
import { VoiceSession } from '../db/models/VoiceSession';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { getZonedParts, zonedDateTimeToUtc } from '../utils/timezone';
import { reportService } from './reportService';

/** Resultado da limpeza de sessões abertas duplicadas em uma collection. */
export interface DuplicateOpenCleanupResult {
  collection: string;
  groupsWithDuplicates: number;
  sessionsClosed: number;
  sessionsKeptOpen: number;
}

/** Opções da limpeza de sessões abertas duplicadas. */
export interface DuplicateOpenCleanupOptions {
  /** Quando `false` (padrão), apenas simula sem gravar. */
  apply?: boolean;
  /** Limita a uma organização (opcional). */
  organizationId?: string;
  /** Limita a um guild Discord (opcional). */
  guildId?: string;
}

/** Opções para regenerar relatórios diários persistidos. */
export interface RegenerateDailyReportsOptions {
  /** Quando `false` (padrão), apenas conta os dias sem gravar. */
  apply?: boolean;
  /** Primeiro dia civil inclusivo (timezone da aplicação). */
  from: Date;
  /** Último dia civil inclusivo (timezone da aplicação). */
  to: Date;
}

/** Resumo completo do saneamento legado. */
export interface SessionLegacyCleanupSummary {
  duplicateOpenVoice: DuplicateOpenCleanupResult;
  duplicateOpenPresence: DuplicateOpenCleanupResult;
  dailyReports: { daysProcessed: number };
}

type OpenSessionDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId?: Types.ObjectId | null;
  guildId?: string | null;
  startedAt: Date;
};

/**
 * Monta chave de agrupamento para sessões do mesmo usuário no mesmo escopo.
 * @param userId ID Mongo do usuário
 * @param organizationId Organização (opcional em dados legados)
 * @param guildId Guild Discord (opcional em dados legados)
 * @returns Chave estável para agrupamento
 */
export function buildSessionGroupKey(
  userId: Types.ObjectId,
  organizationId?: Types.ObjectId | null,
  guildId?: string | null,
): string {
  const org = organizationId ? String(organizationId) : '_';
  const guild = guildId?.trim() ? guildId : '_';
  return `${String(userId)}:${org}:${guild}`;
}

/**
 * Calcula o instante de encerramento de uma sessão órfã anterior à próxima.
 * @param startedAt Início da sessão a fechar
 * @param nextStartedAt Início da sessão seguinte (mais recente)
 * @returns Momento de fechamento (nunca anterior ao início)
 */
export function resolveDuplicateSessionEnd(startedAt: Date, nextStartedAt: Date): Date {
  return nextStartedAt.getTime() > startedAt.getTime() ? nextStartedAt : startedAt;
}

/**
 * Itera cada dia civil inclusivo entre duas datas na timezone da aplicação.
 * @param from Data inicial
 * @param to Data final
 * @returns Datas de referência (meio-dia local) para cada dia
 */
export function* eachCalendarDayInRange(from: Date, to: Date): Generator<Date> {
  let parts = getZonedParts(from);
  const end = getZonedParts(to);

  while (true) {
    yield zonedDateTimeToUtc(parts.year, parts.month, parts.day, 12);

    if (parts.year === end.year && parts.month === end.month && parts.day === end.day) {
      break;
    }

    const noon = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 12);
    parts = getZonedParts(new Date(noon.getTime() + 24 * 60 * 60 * 1000));
  }
}

/**
 * Fecha sessões abertas duplicadas, mantendo apenas a mais recente por usuário/escopo.
 *
 * Sessões órfãs antigas (bug de corridas de eventos) ficam com `endedAt` no instante em
 * que a sessão seguinte começou, preservando a linha do tempo sem inflar o dia.
 * @param options Opções de escopo e dry-run
 * @returns Resumo da operação em voz
 */
export async function cleanupDuplicateOpenVoiceSessions(
  options: DuplicateOpenCleanupOptions = {},
): Promise<DuplicateOpenCleanupResult> {
  const openSessions = await loadOpenSessions(VoiceSession, options);
  const plan = planDuplicateOpenSessionCleanup(openSessions);

  if (options.apply) {
    for (const closure of plan.closures) {
      await voiceSessionRepository.close(closure.sessionId, closure.endedAt);
    }
  }

  return { collection: 'voicesessions', ...plan.summary };
}

/**
 * Fecha sessões de presença abertas duplicadas (mesma regra da voz).
 * @param options Opções de escopo e dry-run
 * @returns Resumo da operação em presença
 */
export async function cleanupDuplicateOpenPresenceSessions(
  options: DuplicateOpenCleanupOptions = {},
): Promise<DuplicateOpenCleanupResult> {
  const openSessions = await loadOpenSessions(PresenceSession, options);
  const plan = planDuplicateOpenSessionCleanup(openSessions);

  if (options.apply) {
    for (const closure of plan.closures) {
      await presenceSessionRepository.close(closure.sessionId, closure.endedAt);
    }
  }

  return { collection: 'presencesessions', ...plan.summary };
}

/**
 * Regenera documentos `DailyReport` no intervalo usando a lógica corrigida (união de intervalos).
 * @param options Intervalo e modo dry-run
 * @returns Quantidade de dias processados
 */
export async function regenerateDailyReportsInRange(
  options: RegenerateDailyReportsOptions,
): Promise<{ daysProcessed: number }> {
  let daysProcessed = 0;

  for (const day of eachCalendarDayInRange(options.from, options.to)) {
    if (options.apply) {
      await reportService.generateDailyReports(day);
    }
    daysProcessed += 1;
  }

  return { daysProcessed };
}

/**
 * Executa o saneamento legado completo: sessões abertas duplicadas + relatórios diários.
 * @param options Opções de escopo, intervalo e dry-run
 * @returns Resumo agregado
 */
export async function runSessionLegacyCleanup(options: {
  apply?: boolean;
  organizationId?: string;
  guildId?: string;
  from: Date;
  to: Date;
  steps?: Array<'open-sessions' | 'daily-reports'>;
}): Promise<SessionLegacyCleanupSummary> {
  const apply = options.apply ?? false;
  const steps = new Set(options.steps ?? ['open-sessions', 'daily-reports']);
  const scope = { apply, organizationId: options.organizationId, guildId: options.guildId };

  const duplicateOpenVoice = steps.has('open-sessions')
    ? await cleanupDuplicateOpenVoiceSessions(scope)
    : emptyDuplicateResult('voicesessions');

  const duplicateOpenPresence = steps.has('open-sessions')
    ? await cleanupDuplicateOpenPresenceSessions(scope)
    : emptyDuplicateResult('presencesessions');

  const dailyReports = steps.has('daily-reports')
    ? await regenerateDailyReportsInRange({ apply, from: options.from, to: options.to })
    : { daysProcessed: 0 };

  return { duplicateOpenVoice, duplicateOpenPresence, dailyReports };
}

/**
 * Monta filtro Mongo para sessões abertas no escopo informado.
 * @param options Escopo opcional
 * @returns Filtro Mongoose
 */
function buildOpenSessionFilter(options: DuplicateOpenCleanupOptions): Record<string, unknown> {
  const filter: Record<string, unknown> = { endedAt: null };
  if (options.organizationId) {
    filter.organizationId = new Types.ObjectId(options.organizationId);
  }
  if (options.guildId) {
    filter.guildId = options.guildId;
  }
  return filter;
}

/**
 * Carrega sessões abertas de voz ou presença.
 * @param model Modelo Mongoose
 * @param options Escopo
 * @returns Documentos enxutos para planejamento
 */
async function loadOpenSessions(
  model: typeof VoiceSession | typeof PresenceSession,
  options: DuplicateOpenCleanupOptions,
): Promise<OpenSessionDoc[]> {
  if (model === VoiceSession) {
    return VoiceSession.find(buildOpenSessionFilter(options))
      .select('_id userId organizationId guildId startedAt')
      .sort({ startedAt: 1 })
      .lean<OpenSessionDoc[]>()
      .exec();
  }

  return PresenceSession.find(buildOpenSessionFilter(options))
    .select('_id userId organizationId guildId startedAt')
    .sort({ startedAt: 1 })
    .lean<OpenSessionDoc[]>()
    .exec();
}

/** Plano de fechamento de sessões duplicadas abertas. */
interface DuplicateOpenCleanupPlan {
  summary: Omit<DuplicateOpenCleanupResult, 'collection'>;
  closures: Array<{ sessionId: Types.ObjectId; endedAt: Date }>;
}

/**
 * Planeja o fechamento de sessões abertas duplicadas (função pura).
 * @param openSessions Sessões abertas carregadas do banco
 * @returns Resumo e lista de fechamentos a aplicar
 */
export function planDuplicateOpenSessionCleanup(openSessions: OpenSessionDoc[]): DuplicateOpenCleanupPlan {
  const groups = new Map<string, OpenSessionDoc[]>();
  for (const session of openSessions) {
    const key = buildSessionGroupKey(session.userId, session.organizationId, session.guildId);
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }

  let groupsWithDuplicates = 0;
  let sessionsClosed = 0;
  let sessionsKeptOpen = 0;
  const closures: Array<{ sessionId: Types.ObjectId; endedAt: Date }> = [];

  for (const sessions of groups.values()) {
    if (sessions.length <= 1) {
      sessionsKeptOpen += sessions.length;
      continue;
    }

    groupsWithDuplicates += 1;
    sessions.sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());

    for (let index = 0; index < sessions.length - 1; index += 1) {
      const session = sessions[index];
      const nextStartedAt = sessions[index + 1].startedAt;
      closures.push({
        sessionId: session._id,
        endedAt: resolveDuplicateSessionEnd(session.startedAt, nextStartedAt),
      });
      sessionsClosed += 1;
    }

    sessionsKeptOpen += 1;
  }

  return {
    summary: { groupsWithDuplicates, sessionsClosed, sessionsKeptOpen },
    closures,
  };
}

/**
 * Retorna resultado vazio para um passo ignorado.
 * @param collection Nome da collection
 * @returns Resultado zerado
 */
function emptyDuplicateResult(collection: string): DuplicateOpenCleanupResult {
  return { collection, groupsWithDuplicates: 0, sessionsClosed: 0, sessionsKeptOpen: 0 };
}
