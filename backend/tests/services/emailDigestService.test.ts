import { describe, expect, it, vi } from 'vitest';
import {
  buildWeeklyInactivityDigest,
  sendWeeklyInactivityDigest,
  type EmailTransport,
} from '../../src/services/emailDigestService';

describe('buildWeeklyInactivityDigest', () => {
  it('monta assunto e corpo em pt-BR com contagem de sumidos', () => {
    const digest = buildWeeklyInactivityDigest({
      organizationName: 'Acme',
      guildName: 'Time Dev',
      missingMembers: [
        { displayName: 'Ana', inactiveBusinessDays: 3 },
        { displayName: 'Bruno', inactiveBusinessDays: 2 },
      ],
      periodEnd: new Date('2026-06-20T12:00:00.000Z'),
      dashboardUrl: 'https://app.syntra.test/app/reports/inactivity',
    });

    expect(digest.subject).toContain('2');
    expect(digest.subject).toMatch(/sumir/i);
    expect(digest.textBody).toContain('Ana');
    expect(digest.textBody).toContain('Bruno');
    expect(digest.textBody).toContain('https://app.syntra.test/app/reports/inactivity');
    expect(digest.textBody.toLowerCase()).not.toContain('produtiv');
  });

  it('usa singular no assunto quando há um colaborador', () => {
    const digest = buildWeeklyInactivityDigest({
      organizationName: 'Acme',
      guildName: 'Guild',
      missingMembers: [{ displayName: 'Ana', inactiveBusinessDays: 2 }],
      periodEnd: new Date('2026-06-20T12:00:00.000Z'),
      dashboardUrl: 'https://app.syntra.test/app/dashboard',
    });

    expect(digest.subject).toMatch(/1 colaborador/i);
  });
});

describe('sendWeeklyInactivityDigest', () => {
  it('retorna disabled quando transport não está configurado', async () => {
    const result = await sendWeeklyInactivityDigest({
      to: ['gestor@acme.com'],
      digest: buildWeeklyInactivityDigest({
        organizationName: 'Acme',
        guildName: 'Guild',
        missingMembers: [],
        periodEnd: new Date(),
        dashboardUrl: 'https://app.syntra.test/app/dashboard',
      }),
      transport: null,
      fromAddress: 'noreply@syntra.app',
    });

    expect(result.disabled).toBe(true);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('envia email para cada destinatário quando transport está disponível', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const transport: EmailTransport = { sendMail };

    const digest = buildWeeklyInactivityDigest({
      organizationName: 'Acme',
      guildName: 'Guild',
      missingMembers: [{ displayName: 'Ana', inactiveBusinessDays: 2 }],
      periodEnd: new Date('2026-06-20T12:00:00.000Z'),
      dashboardUrl: 'https://app.syntra.test/app/dashboard',
    });

    const result = await sendWeeklyInactivityDigest({
      to: ['gestor@acme.com', 'admin@acme.com'],
      digest,
      transport,
      fromAddress: 'noreply@syntra.app',
    });

    expect(result.disabled).toBe(false);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'gestor@acme.com',
        subject: digest.subject,
        text: digest.textBody,
        html: digest.htmlBody,
      }),
    );
  });

  it('conta falhas sem interromper demais destinatários', async () => {
    const sendMail = vi
      .fn()
      .mockResolvedValueOnce({ messageId: 'ok' })
      .mockRejectedValueOnce(new Error('smtp down'));
    const transport: EmailTransport = { sendMail };

    const digest = buildWeeklyInactivityDigest({
      organizationName: 'Acme',
      guildName: 'Guild',
      missingMembers: [{ displayName: 'Ana', inactiveBusinessDays: 2 }],
      periodEnd: new Date(),
      dashboardUrl: 'https://app.syntra.test/app/dashboard',
    });

    const result = await sendWeeklyInactivityDigest({
      to: ['ok@acme.com', 'fail@acme.com'],
      digest,
      transport,
      fromAddress: 'noreply@syntra.app',
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });
});
