import client from 'prom-client';

/** Registry global de métricas Prometheus. */
export const register = new client.Registry();

client.collectDefaultMetrics({ register });

/** Indica se o bot Discord está conectado (1 = sim, 0 = não). */
export const discordConnectedGauge = new client.Gauge({
  name: 'discord_connected',
  help: 'Status de conexão do bot Discord (1=conectado, 0=desconectado)',
  registers: [register],
});

/** Latência (ping) do WebSocket Discord em ms. */
export const discordPingGauge = new client.Gauge({
  name: 'discord_ping',
  help: 'Ping do WebSocket Discord em milissegundos',
  registers: [register],
});

/** Quantidade de sessões de voz abertas. */
export const activeVoiceSessionsGauge = new client.Gauge({
  name: 'active_voice_sessions',
  help: 'Número de sessões de voz abertas',
  registers: [register],
});

/** Quantidade de sessões de presença abertas. */
export const activePresenceSessionsGauge = new client.Gauge({
  name: 'active_presence_sessions',
  help: 'Número de sessões de presença abertas',
  registers: [register],
});

/** Indica se o MongoDB está conectado (1 = sim, 0 = não). */
export const mongodbConnectedGauge = new client.Gauge({
  name: 'mongodb_connected',
  help: 'Status de conexão MongoDB (1=conectado, 0=desconectado)',
  registers: [register],
});

/** Uso de memória RSS do processo em bytes. */
export const processMemoryGauge = new client.Gauge({
  name: 'process_memory_usage',
  help: 'Uso de memória RSS do processo em bytes',
  labelNames: ['type'],
  registers: [register],
});

/** Uso de CPU do processo (user + system) em segundos. */
export const processCpuGauge = new client.Gauge({
  name: 'process_cpu_usage',
  help: 'Uso acumulado de CPU do processo em segundos',
  labelNames: ['type'],
  registers: [register],
});

let lastCpuUsage = process.cpuUsage();

/**
 * Atualiza métricas de memória e CPU do processo.
 */
export function updateProcessMetrics(): void {
  const mem = process.memoryUsage();
  processMemoryGauge.set({ type: 'rss' }, mem.rss);
  processMemoryGauge.set({ type: 'heapUsed' }, mem.heapUsed);
  processMemoryGauge.set({ type: 'heapTotal' }, mem.heapTotal);

  const cpu = process.cpuUsage(lastCpuUsage);
  lastCpuUsage = process.cpuUsage();
  processCpuGauge.set({ type: 'user' }, cpu.user / 1_000_000);
  processCpuGauge.set({ type: 'system' }, cpu.system / 1_000_000);
}

/**
 * Define o status de conexão Discord nas métricas.
 * @param connected true quando conectado
 */
export function setDiscordConnected(connected: boolean): void {
  discordConnectedGauge.set(connected ? 1 : 0);
}

/**
 * Define o ping Discord nas métricas.
 * @param ping Latência em ms
 */
export function setDiscordPing(ping: number): void {
  discordPingGauge.set(ping);
}

/**
 * Define o status de conexão MongoDB nas métricas.
 * @param connected true quando conectado
 */
export function setMongodbConnected(connected: boolean): void {
  mongodbConnectedGauge.set(connected ? 1 : 0);
}

/**
 * Atualiza contadores de sessões ativas.
 * @param voiceSessions Quantidade de sessões de voz abertas
 * @param presenceSessions Quantidade de sessões de presença abertas
 */
export function setActiveSessions(voiceSessions: number, presenceSessions: number): void {
  activeVoiceSessionsGauge.set(voiceSessions);
  activePresenceSessionsGauge.set(presenceSessions);
}
