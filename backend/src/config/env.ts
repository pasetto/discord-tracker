import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Tipos de sessão de voz suportados pelo sistema.
 */
export type VoiceSessionType = 'VOICE' | 'AFK' | 'LUNCH';

/**
 * Status de presença monitorados pelo bot.
 */
export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' | 'INVISIBLE';

/**
 * Tipos de evento de voz registrados.
 */
export type VoiceEventType =
  | 'JOIN'
  | 'LEAVE'
  | 'SWITCH'
  | 'MOVED'
  | 'AFK_AUTO'
  | 'RECONNECT'
  | 'DISCONNECT';

/**
 * Configuração centralizada da aplicação carregada das variáveis de ambiente.
 */
export interface AppConfig {
  mongodbUri: string;
  port: number;
  host: string;
  logLevel: string;
  nodeEnv: string;
  timezone: string;
  apiKeys: string[];
  jwtSecret: string;
  frontendUrl: string;
  apiPublicUrl: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
}

/**
 * Converte uma string separada por vírgulas em array trimado.
 * @param value Valor bruto da variável de ambiente
 * @param fallback Valores padrão quando vazio
 * @returns Lista de strings normalizadas
 */
function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) {
    return fallback;
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * Valida ENCRYPTION_KEY exigida para criptografar tokens Discord no banco.
 * @throws {Error} Quando ausente ou com tamanho inválido
 */
function assertEncryptionKey(): void {
  const rawKey = process.env.ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new Error(
      'ENCRYPTION_KEY é obrigatório no .env (32 bytes em base64). Gere com: npm run generate:encryption-key --workspace=backend',
    );
  }

  const decodedKey = Buffer.from(rawKey, 'base64');
  if (decodedKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY deve ser base64 de exatamente 32 bytes');
  }
}

/**
 * Carrega e valida a configuração da aplicação.
 * @returns Objeto de configuração tipado
 * @throws {Error} Quando variáveis obrigatórias estão ausentes
 */
export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const mongodbUri = process.env.MONGODB_URI;
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:4200').replace(/\/$/, '');
  const apiPublicUrl = (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(
    /\/$/,
    '',
  );
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!mongodbUri) {
    throw new Error('MONGODB_URI é obrigatório');
  }
  if (!jwtSecret) {
    throw new Error('JWT_SECRET é obrigatório');
  }
  assertEncryptionKey();

  const apiKeys = parseList(process.env.API_KEYS, []);
  if (apiKeys.length === 0 && nodeEnv !== 'development') {
    throw new Error('API_KEYS é obrigatório (uma ou mais chaves separadas por vírgula)');
  }

  if (process.env.DISCORD_TOKEN?.trim()) {
    console.warn(
      '[env] DISCORD_TOKEN está definido mas será ignorado. Cadastre o bot via /admin/discord ou seed:discord-app.',
    );
  }

  return {
    mongodbUri,
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv,
    timezone: process.env.TIMEZONE ?? 'America/Sao_Paulo',
    apiKeys,
    jwtSecret,
    frontendUrl,
    apiPublicUrl,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
  };
}

/** Instância singleton da configuração. */
export const config = loadConfig();
