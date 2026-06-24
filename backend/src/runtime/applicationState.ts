/**
 * Estados de prontidão do processo para probes HTTP e sinalização ao PM2.
 */
export type ApplicationReadinessState = 'starting' | 'ready' | 'unhealthy' | 'shutting_down';

let readinessState: ApplicationReadinessState = 'starting';
let unhealthyReason: string | undefined;

/**
 * Retorna o estado atual de prontidão da aplicação.
 * @returns Estado interno do processo
 */
export function getApplicationReadinessState(): ApplicationReadinessState {
  return readinessState;
}

/**
 * Retorna motivo da última marcação como unhealthy, se houver.
 * @returns Texto descritivo ou undefined
 */
export function getUnhealthyReason(): string | undefined {
  return unhealthyReason;
}

/**
 * Marca o processo como em inicialização (antes de aceitar tráfego).
 */
export function markApplicationStarting(): void {
  readinessState = 'starting';
  unhealthyReason = undefined;
}

/**
 * Marca o processo pronto para receber requisições HTTP.
 */
export function markApplicationReady(): void {
  readinessState = 'ready';
  unhealthyReason = undefined;
}

/**
 * Marca o processo como unhealthy — probes de readiness devem falhar.
 * @param reason Motivo operacional (ex.: MongoDB desconectado)
 */
export function markApplicationUnhealthy(reason: string): void {
  readinessState = 'unhealthy';
  unhealthyReason = reason;
}

/**
 * Marca encerramento gracioso em andamento.
 */
export function markApplicationShuttingDown(): void {
  readinessState = 'shutting_down';
}

/**
 * Indica se o processo deve aceitar tráfego de aplicação.
 * @returns true quando estado é `ready`
 */
export function isReadyForTraffic(): boolean {
  return readinessState === 'ready';
}

/**
 * Indica se o processo está vivo (não em shutdown).
 * @returns true exceto durante `shutting_down`
 */
export function isProcessLive(): boolean {
  return readinessState !== 'shutting_down';
}

/**
 * Restaura prontidão após recuperação de dependência (ex.: Mongo reconectou).
 */
export function recoverApplicationReadiness(): void {
  if (readinessState === 'unhealthy') {
    readinessState = 'ready';
    unhealthyReason = undefined;
  }
}
