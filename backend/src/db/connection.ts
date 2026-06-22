import mongoose from 'mongoose';
import { config } from '../config/env';
import { createLogger } from '../logger';
import { setMongodbConnected } from '../metrics/prometheus';

const log = createLogger('mongodb');

/** Indica se o Mongoose está conectado ao MongoDB. */
export let isMongoConnected = false;

/**
 * Conecta ao MongoDB utilizando a URI configurada.
 * @returns Promise resolvida após conexão estabelecida
 * @throws {Error} Quando a conexão falha
 */
export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri);
    isMongoConnected = true;
    setMongodbConnected(true);
    log.info('Conectado ao MongoDB');
  } catch (error) {
    isMongoConnected = false;
    setMongodbConnected(false);
    log.error({ err: error }, 'Falha ao conectar ao MongoDB');
    throw error;
  }

  mongoose.connection.on('disconnected', () => {
    isMongoConnected = false;
    setMongodbConnected(false);
    log.warn('MongoDB desconectado');
  });

  mongoose.connection.on('reconnected', () => {
    isMongoConnected = true;
    setMongodbConnected(true);
    log.info('MongoDB reconectado');
  });
}

/**
 * Desconecta do MongoDB de forma graciosa.
 * @returns Promise resolvida após desconexão
 */
export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  isMongoConnected = false;
  setMongodbConnected(false);
  log.info('Desconectado do MongoDB');
}

/**
 * Verifica se o MongoDB está conectado e respondendo.
 * @returns true quando conectado (readyState === 1)
 */
export function checkMongoHealth(): boolean {
  return mongoose.connection.readyState === 1;
}
