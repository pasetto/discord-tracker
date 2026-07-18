/**
 * Prontidão segura de canais de alerta (sem expor secrets).
 */
export interface AlertsReadiness {
  /** `true` quando `SMTP_HOST` e `SMTP_FROM` estão definidos. */
  emailConfigured: boolean;
  /** `true` quando `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` estão definidos. */
  vapidConfigured: boolean;
}

/**
 * Indica se SMTP mínimo para digest por email está presente no ambiente.
 * Espelha a regra de `resolveSmtpConfigFromEnv` (host + from).
 * @returns `true` quando `SMTP_HOST` e `SMTP_FROM` estão preenchidos
 */
export function isEmailConfiguredFromEnv(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  return Boolean(host && from);
}

/**
 * Indica se as chaves VAPID necessárias para web push estão presentes no ambiente.
 * @returns `true` quando as três variáveis VAPID estão preenchidas
 */
export function isVapidConfiguredFromEnv(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return Boolean(publicKey && privateKey && subject);
}

/**
 * Reporta se email digest e web push estão configurados no processo atual.
 * Não valida conectividade SMTP nem validade criptográfica das chaves — só presença de env.
 * @returns Booleans seguros para health/smoke (sem secrets)
 * @example
 * getAlertsReadiness() // { emailConfigured: false, vapidConfigured: true }
 */
export function getAlertsReadiness(): AlertsReadiness {
  return {
    emailConfigured: isEmailConfiguredFromEnv(),
    vapidConfigured: isVapidConfiguredFromEnv(),
  };
}
