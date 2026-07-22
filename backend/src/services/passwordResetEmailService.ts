import { createLogger } from '../logger';
import {
  createSmtpTransport,
  resolveSmtpConfigFromEnv,
  type EmailTransport,
} from './emailDigestService';

const log = createLogger('password-reset-email');

/**
 * Entrada para envio de email de redefinição de senha.
 */
export interface SendPasswordResetEmailInput {
  to: string;
  resetUrl: string;
  /** Transporte injetável para testes. */
  transport?: EmailTransport | null;
}

/**
 * Envia email de reset de senha via SMTP configurado (`SMTP_*`).
 * Fire-and-forget friendly: retorna `false` quando SMTP não está configurado.
 * @param input Destinatário e URL de reset
 * @returns `true` quando o email foi enviado
 */
export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<boolean> {
  const smtpConfig = resolveSmtpConfigFromEnv();
  const transport =
    input.transport === undefined ? createSmtpTransport(smtpConfig) : input.transport;

  if (!smtpConfig || !transport) {
    log.info({ to: input.to }, 'SMTP ausente — email de reset não enviado');
    return false;
  }

  await transport.sendMail({
    from: smtpConfig.from,
    to: input.to,
    subject: 'Redefinir senha — Syntra',
    text: [
      'Recebemos um pedido para redefinir sua senha no Syntra.',
      '',
      `Abra o link abaixo para escolher uma nova senha:`,
      input.resetUrl,
      '',
      'Se você não solicitou isso, ignore este email.',
    ].join('\n'),
    html: `
      <p>Recebemos um pedido para redefinir sua senha no Syntra.</p>
      <p><a href="${input.resetUrl}">Redefinir senha</a></p>
      <p>Se você não solicitou isso, ignore este email.</p>
    `,
  });

  return true;
}
