import { afterEach, describe, expect, it } from 'vitest';
import { getAlertsReadiness } from '../../src/services/alertsReadinessService';

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_FROM', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'] as const;
const VAPID_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

/**
 * Remove variáveis SMTP/VAPID do ambiente para isolar o teste.
 * @returns {void}
 */
function clearAlertEnv(): void {
  for (const key of [...SMTP_KEYS, ...VAPID_KEYS]) {
    delete process.env[key];
  }
}

describe('alertsReadinessService', () => {
  afterEach(() => {
    clearAlertEnv();
  });

  it('retorna false/false quando SMTP e VAPID estão ausentes', () => {
    clearAlertEnv();

    expect(getAlertsReadiness()).toEqual({
      emailConfigured: false,
      vapidConfigured: false,
    });
  });

  it('marca emailConfigured quando SMTP_HOST e SMTP_FROM existem', () => {
    clearAlertEnv();
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'noreply@syntra.app';

    expect(getAlertsReadiness()).toEqual({
      emailConfigured: true,
      vapidConfigured: false,
    });
  });

  it('não marca emailConfigured só com SMTP_HOST', () => {
    clearAlertEnv();
    process.env.SMTP_HOST = 'smtp.example.com';

    expect(getAlertsReadiness().emailConfigured).toBe(false);
  });

  it('marca vapidConfigured quando as três VAPID_* existem', () => {
    clearAlertEnv();
    process.env.VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_PRIVATE_KEY = 'private';
    process.env.VAPID_SUBJECT = 'mailto:support@syntra.app';

    expect(getAlertsReadiness()).toEqual({
      emailConfigured: false,
      vapidConfigured: true,
    });
  });

  it('não marca vapidConfigured com VAPID incompleto', () => {
    clearAlertEnv();
    process.env.VAPID_PUBLIC_KEY = 'public';
    process.env.VAPID_SUBJECT = 'mailto:support@syntra.app';

    expect(getAlertsReadiness().vapidConfigured).toBe(false);
  });
});
