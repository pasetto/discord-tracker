import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSmtpTransportMock = vi.hoisted(() => vi.fn());
const resolveSmtpConfigFromEnvMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/emailDigestService', () => ({
  createSmtpTransport: createSmtpTransportMock,
  resolveSmtpConfigFromEnv: resolveSmtpConfigFromEnvMock,
}));

describe('passwordResetEmailService', () => {
  beforeEach(() => {
    createSmtpTransportMock.mockReset();
    resolveSmtpConfigFromEnvMock.mockReset();
    vi.resetModules();
  });

  it('retorna false quando SMTP não está configurado', async () => {
    resolveSmtpConfigFromEnvMock.mockReturnValue(null);
    createSmtpTransportMock.mockReturnValue(null);
    const { sendPasswordResetEmail } = await import('../../src/services/passwordResetEmailService');

    const sent = await sendPasswordResetEmail({
      to: 'user@test.com',
      resetUrl: 'http://localhost:4200/reset-password?token=x',
    });

    expect(sent).toBe(false);
  });

  it('envia email quando SMTP e transporte estão disponíveis', async () => {
    resolveSmtpConfigFromEnvMock.mockReturnValue({
      host: 'smtp.test',
      port: 587,
      secure: false,
      from: 'noreply@syntra.app',
    });
    const sendMail = vi.fn().mockResolvedValue({});
    createSmtpTransportMock.mockReturnValue({ sendMail });
    const { sendPasswordResetEmail } = await import('../../src/services/passwordResetEmailService');

    const sent = await sendPasswordResetEmail({
      to: 'user@test.com',
      resetUrl: 'http://localhost:4200/reset-password?token=x',
      transport: { sendMail },
    });

    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0].to).toBe('user@test.com');
    expect(sendMail.mock.calls[0][0].text).toContain('reset-password?token=x');
  });
});
