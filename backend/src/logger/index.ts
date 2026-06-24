import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { config } from '../config/env';
import { createUtf8StdoutStream, shouldUseUtf8StdoutStream } from '../utils/utf8StdoutStream';

/**
 * Cria o destino de escrita do logger.
 * Windows/TTY: stream UTF-8 (sonic-boom corrompe acentos no console).
 * Demais casos: sonic-boom (performático para pipes e arquivos).
 * @returns Stream de destino para o Pino
 */
function createLogDestination(): pino.DestinationStream {
  const utf8Stream = createUtf8StdoutStream();

  if (process.stdout.isTTY && config.nodeEnv === 'development') {
    return pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      destination: shouldUseUtf8StdoutStream() ? utf8Stream : undefined,
    });
  }

  if (shouldUseUtf8StdoutStream()) {
    return utf8Stream as unknown as pino.DestinationStream;
  }

  return pino.destination({ dest: 1, sync: false });
}

/**
 * Logger estruturado da aplicação usando Pino.
 */
export const logger = pino({ level: config.logLevel }, createLogDestination());

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
