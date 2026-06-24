import { Types } from 'mongoose';
import { TextActivityEventModel } from '../db/models/TextActivityEvent';

/**
 * Entrada para geração do relatório de sinais de texto por colaborador.
 */
export interface GetTextCollaborationReportInput {
  organizationId: string;
  guildId: string;
  from: Date;
  to: Date;
}

/**
 * Linha agregada do relatório de sinais de texto.
 */
export interface TextCollaborationReportEntry {
  discordId: string;
  displayName: string;
  categoryId: string | null;
  eventsCount: number;
  lastOccurredAt: Date;
}

/**
 * Estrutura final do relatório de texto colaborativo.
 */
export interface TextCollaborationReport {
  from: Date;
  to: Date;
  generatedAt: Date;
  entries: TextCollaborationReportEntry[];
}

/**
 * Converte string para ObjectId válido.
 * @param value Valor textual recebido da camada HTTP
 * @param label Nome do campo para mensagens de erro
 * @returns ObjectId pronto para consulta no MongoDB
 * @throws {Error} Quando o valor não representa um ObjectId válido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Agrega sinais de texto por colaborador no período informado, sem expor conteúdo de mensagens.
 * @param input Filtros de tenant, guild e intervalo temporal
 * @returns Relatório com contagem de eventos e último sinal por `discordId`
 * @throws {Error} Quando organizationId for inválido ou intervalo temporal inconsistente
 */
export async function getTextCollaborationReport(
  input: GetTextCollaborationReportInput,
): Promise<TextCollaborationReport> {
  const organizationObjectId = parseObjectId(input.organizationId, 'organizationId');
  if (input.from.getTime() > input.to.getTime()) {
    throw new Error('Intervalo inválido: from deve ser menor ou igual a to');
  }

  const rows = await TextActivityEventModel.aggregate<{
    discordId: string;
    eventsCount: number;
    lastOccurredAt: Date;
    displayName?: string;
    categoryId?: Types.ObjectId;
  }>([
    {
      $match: {
        organizationId: organizationObjectId,
        guildId: input.guildId,
        occurredAt: { $gte: input.from, $lte: input.to },
      },
    },
    {
      $group: {
        _id: '$discordId',
        eventsCount: { $sum: 1 },
        lastOccurredAt: { $max: '$occurredAt' },
      },
    },
    {
      $lookup: {
        from: 'trackedusers',
        let: { discordId: '$_id' },
        pipeline: [
          {
            $match: {
              organizationId: organizationObjectId,
              guildId: input.guildId,
              $expr: { $eq: ['$discordId', '$$discordId'] },
            },
          },
          {
            $project: {
              _id: 0,
              displayName: 1,
              categoryId: 1,
            },
          },
          { $limit: 1 },
        ],
        as: 'trackedUser',
      },
    },
    {
      $unwind: {
        path: '$trackedUser',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        discordId: '$_id',
        eventsCount: 1,
        lastOccurredAt: 1,
        displayName: '$trackedUser.displayName',
        categoryId: '$trackedUser.categoryId',
      },
    },
    { $sort: { eventsCount: -1, discordId: 1 } },
  ]);

  return {
    from: input.from,
    to: input.to,
    generatedAt: new Date(),
    entries: rows.map((row) => ({
      discordId: row.discordId,
      displayName: row.displayName ?? row.discordId,
      categoryId: row.categoryId ? String(row.categoryId) : null,
      eventsCount: row.eventsCount,
      lastOccurredAt: row.lastOccurredAt,
    })),
  };
}
