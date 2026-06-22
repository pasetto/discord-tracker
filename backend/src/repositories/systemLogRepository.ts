import { SystemLog } from '../db/models/SystemLog';

/**
 * Repositório de logs de sistema persistidos no MongoDB.
 */
export const systemLogRepository = {
  /**
   * Persiste um log de sistema.
   * @param level Nível do log (info, warn, error)
   * @param message Mensagem descritiva
   * @param context Módulo ou contexto de origem
   * @param metadata Dados adicionais opcionais
   * @returns Documento criado
   */
  async create(
    level: string,
    message: string,
    context: string,
    metadata: Record<string, unknown> = {},
  ) {
    return SystemLog.create({ level, message, context, metadata });
  },
};
