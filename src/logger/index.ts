import pino from 'pino';
import { config } from '../config/env';

/**
 * Logger estruturado da aplicação usando Pino.
 * Em desenvolvimento utiliza pretty-print para facilitar leitura.
 */
export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

/**
 * Cria um logger filho com contexto adicional.
 * @param context Nome do módulo ou contexto
 * @returns Instância de logger com binding de contexto
 * @example
 * const log = createLogger('voice');
 * log.info('Usuário entrou no canal');
 */
export function createLogger(context: string): pino.Logger {
  return logger.child({ context });
}
