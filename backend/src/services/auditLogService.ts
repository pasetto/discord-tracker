import { Types } from 'mongoose';
import { AuditLogModel, IAuditLog } from '../db/models/AuditLog';

/**
 * Payload de criação de evento de auditoria.
 */
export interface CreateAuditLogInput {
  organizationId?: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/**
 * Entrada enxuta de trilha para export LGPD.
 */
export interface AuditTrailExportEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadataKeys: string[];
  createdAt: string;
}

/**
 * Filtros aceitos para o stub de trilha no export LGPD.
 */
export interface ListAuditTrailExportStubInput {
  organizationId: string;
  actorId: string;
  limit?: number;
}

/**
 * Converte string para ObjectId com validação explícita.
 * @param value Valor textual recebido
 * @param field Nome lógico do campo para mensagem de erro
 * @returns ObjectId pronto para uso em query/persistência
 * @throws {Error} Quando o valor informado não for ObjectId válido
 */
function parseObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Normaliza limite de busca da trilha de auditoria.
 * @param value Limite recebido na API de serviço
 * @returns Limite final entre 1 e 50
 */
function resolveLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 20;
  }

  return Math.min(50, Math.max(1, Math.trunc(value)));
}

/**
 * Registra evento de auditoria seguindo padrão multitenant.
 * @param input Dados do evento de auditoria
 * @returns Documento persistido na coleção audit_logs
 * @example
 * await createAuditLog({
 *   organizationId: '665f9312eb6f3a663b6f0001',
 *   actorId: '665f9312eb6f3a663b6f0002',
 *   action: 'report.exported',
 *   resourceType: 'report',
 *   resourceId: 'weekly-2026-06-22',
 *   metadata: { format: 'csv' },
 * })
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<IAuditLog> {
  return AuditLogModel.create({
    organizationId: input.organizationId ? parseObjectId(input.organizationId, 'organizationId') : undefined,
    actorId: parseObjectId(input.actorId, 'actorId'),
    action: input.action.trim(),
    resourceType: input.resourceType.trim(),
    resourceId: input.resourceId?.trim() || undefined,
    metadata: input.metadata ?? {},
    ip: input.ip?.trim() || undefined,
  });
}

/**
 * Retorna trilha simplificada para export do titular no endpoint `/me/data-export`.
 * @param input Organização, ator e limite de linhas para o stub LGPD
 * @returns Entradas de trilha sem payload completo de metadados
 */
export async function listAuditTrailExportStub(
  input: ListAuditTrailExportStubInput,
): Promise<AuditTrailExportEntry[]> {
  const rows = await AuditLogModel.find({
    organizationId: parseObjectId(input.organizationId, 'organizationId'),
    actorId: parseObjectId(input.actorId, 'actorId'),
  })
    .sort({ createdAt: -1 })
    .limit(resolveLimit(input.limit))
    .lean()
    .exec();

  return rows.map((item) => ({
    action: item.action,
    resourceType: item.resourceType,
    resourceId: item.resourceId,
    metadataKeys: Object.keys((item.metadata as Record<string, unknown> | undefined) ?? {}),
    createdAt: item.createdAt.toISOString(),
  }));
}
