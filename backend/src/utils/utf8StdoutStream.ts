import './ensureWinConsoleUtf8';
import fs from 'node:fs';
import { Writable } from 'node:stream';

/**
 * Stream que grava UTF-8 diretamente no stdout via writeSync.
 * Evita conversão de code page do sonic-boom/Pino no console Windows.
 * @returns Writable compatível com destino do Pino
 */
export function createUtf8StdoutStream(): Writable {
  return new Writable({
    write(chunk: Buffer | string, _encoding, callback): void {
      try {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
        fs.writeSync(1, buffer);
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

/**
 * Indica se logs devem usar stream UTF-8 em vez do sonic-boom padrão.
 * No Windows o sonic-boom corrompe acentos no console; em TTY usamos stream seguro.
 * @returns true quando stdout é terminal interativo
 */
export function shouldUseUtf8StdoutStream(): boolean {
  return process.platform === 'win32' || Boolean(process.stdout.isTTY);
}
