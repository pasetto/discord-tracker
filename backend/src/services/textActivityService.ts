import { Types } from 'mongoose';
import {
  TextActivityEventModel,
  type TextActivityEventType,
} from '../db/models/TextActivityEvent';
import { TrackedUserModel } from '../db/models/TrackedUser';

/**
 * Payload normalizado de evento textual sem conteúdo de mensagem.
 */
export interface TextActivityEventPayload {
  organizationId: string | Types.ObjectId;
  guildId: string;
  discordId: string;
  channelId: string;
  eventType: TextActivityEventType;
  occurredAt: Date;
}

/**
 * Entrada para gravação de atividade textual recebida do bot.
 */
export interface RecordTextActivityInput {
  guildId: string;
  discordId: string;
  channelId: string;
  eventType: TextActivityEventType;
  occurredAt?: Date;
}

/**
 * Referência mínima de usuário rastreado para persistência de eventos.
 */
export interface TrackedUserReference {
  trackedUserId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
  guildId: string;
  discordId: string;
}

/**
 * Contrato de dependências para persistência e teste do serviço textual.
 */
export interface TextActivityServiceDependencies {
  findTrackedUsers(guildId: string, discordId: string): Promise<TrackedUserReference[]>;
  createEvents(events: TextActivityEventPayload[]): Promise<void>;
  touchTrackedUsers(trackedUserIds: Array<string | Types.ObjectId>, occurredAt: Date): Promise<void>;
  debounceWindowMs: number;
  now(): Date;
}

/**
 * Resultado da tentativa de gravação de atividade textual.
 */
export interface RecordTextActivityResult {
  persistedCount: number;
  skippedByDebounce: boolean;
}

const DEFAULT_DEBOUNCE_WINDOW_MS = 60_000;

/**
 * Gera a chave de debounce por usuário e canal.
 * @param discordId ID do usuário no Discord
 * @param channelId ID do canal de texto
 * @returns Chave única de debounce
 */
function buildDebounceKey(discordId: string, channelId: string): string {
  return `${discordId}:${channelId}`;
}

/**
 * Constrói um evento textual sanitizado contendo apenas metadados permitidos.
 * @param payload Dados da atividade textual
 * @returns Evento pronto para persistência, sem campo content
 * @example
 * buildTextActivityEvent({
 *   organizationId: 'org1',
 *   guildId: 'g1',
 *   discordId: 'u1',
 *   channelId: 'c1',
 *   eventType: 'message',
 *   occurredAt: new Date(),
 * });
 */
export function buildTextActivityEvent(payload: TextActivityEventPayload): TextActivityEventPayload {
  return {
    organizationId: payload.organizationId,
    guildId: payload.guildId,
    discordId: payload.discordId,
    channelId: payload.channelId,
    eventType: payload.eventType,
    occurredAt: payload.occurredAt,
  };
}

/**
 * Cria uma instância do serviço de atividade textual com debounce em memória.
 * @param overrides Sobrescritas opcionais para facilitar testes
 * @returns Serviço pronto para gravar eventos textuais
 */
export function createTextActivityService(
  overrides: Partial<TextActivityServiceDependencies> = {},
): { recordActivity(input: RecordTextActivityInput): Promise<RecordTextActivityResult> } {
  const dependencies: TextActivityServiceDependencies = {
    async findTrackedUsers(guildId: string, discordId: string): Promise<TrackedUserReference[]> {
      const docs = await TrackedUserModel.find({ guildId, discordId, isActive: true })
        .select({ _id: 1, organizationId: 1, guildId: 1, discordId: 1 })
        .lean()
        .exec();

      return docs.map((doc) => ({
        trackedUserId: doc._id as Types.ObjectId,
        organizationId: doc.organizationId as Types.ObjectId,
        guildId: doc.guildId,
        discordId: doc.discordId,
      }));
    },
    async createEvents(events: TextActivityEventPayload[]): Promise<void> {
      if (events.length === 0) {
        return;
      }

      await TextActivityEventModel.insertMany(events);
    },
    async touchTrackedUsers(
      trackedUserIds: Array<string | Types.ObjectId>,
      occurredAt: Date,
    ): Promise<void> {
      if (trackedUserIds.length === 0) {
        return;
      }

      await TrackedUserModel.updateMany(
        { _id: { $in: trackedUserIds } },
        { $set: { lastTextActivityAt: occurredAt } },
      );
    },
    debounceWindowMs: DEFAULT_DEBOUNCE_WINDOW_MS,
    now: () => new Date(),
    ...overrides,
  };

  const debounceCache = new Map<string, number>();

  return {
    /**
     * Persiste atividade textual por metadados e atualiza o último sinal do usuário.
     * @param input Dados mínimos do evento textual vindo do Discord
     * @returns Resultado com quantidade persistida e estado de debounce
     */
    async recordActivity(input: RecordTextActivityInput): Promise<RecordTextActivityResult> {
      const occurredAt = input.occurredAt ?? dependencies.now();
      const trackedUsers = await dependencies.findTrackedUsers(input.guildId, input.discordId);

      if (trackedUsers.length === 0) {
        return { persistedCount: 0, skippedByDebounce: false };
      }

      const debounceKey = buildDebounceKey(input.discordId, input.channelId);
      const lastEventAtMs = debounceCache.get(debounceKey);
      const currentEventAtMs = occurredAt.getTime();

      if (
        typeof lastEventAtMs === 'number'
        && currentEventAtMs - lastEventAtMs < dependencies.debounceWindowMs
      ) {
        return { persistedCount: 0, skippedByDebounce: true };
      }

      debounceCache.set(debounceKey, currentEventAtMs);

      const events = trackedUsers.map((trackedUser) => buildTextActivityEvent({
        organizationId: trackedUser.organizationId,
        guildId: trackedUser.guildId,
        discordId: trackedUser.discordId,
        channelId: input.channelId,
        eventType: input.eventType,
        occurredAt,
      }));

      await dependencies.createEvents(events);
      await dependencies.touchTrackedUsers(
        trackedUsers.map((trackedUser) => trackedUser.trackedUserId),
        occurredAt,
      );

      return { persistedCount: events.length, skippedByDebounce: false };
    },
  };
}

/** Serviço singleton para registrar sinais de texto em runtime. */
export const textActivityService = createTextActivityService();
