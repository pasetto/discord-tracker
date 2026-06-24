import nodemailer, { type Transporter } from 'nodemailer';
import { Types } from 'mongoose';
import { createLogger } from '../logger';
import { PlatformUserModel } from '../db/models/PlatformUser';
import { OrganizationModel } from '../db/models/Organization';
import { GuildConnectionModel } from '../db/models/GuildConnection';
import { config } from '../config/env';
import type { MissingMemberInput } from './pushService';

const MANAGER_ROLES = ['owner', 'admin', 'manager'];
const log = createLogger('email-digest-service');

let smtpTransport: Transporter | null | undefined;

/**
 * Contrato mínimo de transporte SMTP injetável para testes.
 */
export interface EmailTransport {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

/**
 * Entrada para montagem do digest semanal de inatividade.
 */
export interface BuildWeeklyInactivityDigestInput {
  organizationName: string;
  guildName: string;
  missingMembers: MissingMemberInput[];
  periodEnd: Date;
  dashboardUrl: string;
}

/**
 * Conteúdo do email de digest semanal.
 */
export interface WeeklyInactivityDigestContent {
  subject: string;
  textBody: string;
  htmlBody: string;
}

/**
 * Entrada para envio do digest semanal.
 */
export interface SendWeeklyInactivityDigestInput {
  to: string[];
  digest: WeeklyInactivityDigestContent;
  transport: EmailTransport | null;
  fromAddress: string;
}

/**
 * Resultado agregado do envio de emails.
 */
export interface EmailDispatchResult {
  disabled: boolean;
  recipients: number;
  sent: number;
  failed: number;
}

/**
 * Entrada de alto nível para notificar gestores via email no cron semanal.
 */
export interface SendWeeklyInactivityDigestToManagersInput {
  organizationId: string;
  guildId: string;
  missingMembers: MissingMemberInput[];
  periodEnd: Date;
}

/**
 * Formata data de referência do relatório em pt-BR.
 * @param date Data de fim do período
 * @returns Texto legível (ex.: 20/06/2026)
 */
function formatPeriodEndDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

/**
 * Monta lista textual dos colaboradores em alerta.
 * @param missingMembers Membros com status missing
 * @returns Linhas para corpo do email
 */
function formatMissingMemberLines(missingMembers: MissingMemberInput[]): string[] {
  return missingMembers.map(
    (member) =>
      `• ${member.displayName} — ${member.inactiveBusinessDays} dia(s) útil(is) sem sinais de colaboração`,
  );
}

/**
 * Monta assunto e corpo do digest semanal de quem sumiu.
 * @param input Contexto da organização, guild e membros afetados
 * @returns Conteúdo pronto para envio SMTP
 * @example
 * buildWeeklyInactivityDigest({
 *   organizationName: 'Acme',
 *   guildName: 'Dev',
 *   missingMembers: [{ displayName: 'Ana', discordId: '1', inactiveBusinessDays: 2 }],
 *   periodEnd: new Date(),
 *   dashboardUrl: 'https://app.example/app/reports/inactivity',
 * });
 */
export function buildWeeklyInactivityDigest(
  input: BuildWeeklyInactivityDigestInput,
): WeeklyInactivityDigestContent {
  const count = input.missingMembers.length;
  const collaboratorLabel = count === 1 ? '1 colaborador sumiu' : `${count} colaboradores sumiram`;
  const periodLabel = formatPeriodEndDate(input.periodEnd);
  const memberLines = formatMissingMemberLines(input.missingMembers);
  const subject = `Syntra — ${collaboratorLabel} na colaboração (${input.organizationName})`;

  const textBody = [
    `Olá,`,
    ``,
    `Resumo semanal de inatividade no Discord para ${input.organizationName} (${input.guildName}), referência ${periodLabel}:`,
    ``,
    ...memberLines,
    ``,
    `Abra o relatório completo: ${input.dashboardUrl}`,
    ``,
    `Este alerta considera apenas metadados de colaboração (voz, presença e texto) — sem conteúdo de mensagens.`,
    ``,
    `— Syntra`,
  ].join('\n');

  const htmlBody = [
    `<p>Olá,</p>`,
    `<p>Resumo semanal de <strong>inatividade</strong> no Discord para <strong>${input.organizationName}</strong> (${input.guildName}), referência ${periodLabel}:</p>`,
    `<ul>${input.missingMembers
      .map(
        (member) =>
          `<li><strong>${member.displayName}</strong> — ${member.inactiveBusinessDays} dia(s) útil(is) sem sinais de colaboração</li>`,
      )
      .join('')}</ul>`,
    `<p><a href="${input.dashboardUrl}">Ver relatório completo</a></p>`,
    `<p><small>Este alerta considera apenas metadados de colaboração — sem conteúdo de mensagens.</small></p>`,
    `<p>— Syntra</p>`,
  ].join('');

  return { subject, textBody, htmlBody };
}

/**
 * Converte string para ObjectId com validação.
 * @param value Identificador textual
 * @param label Nome do campo para erro
 * @returns ObjectId válido
 * @throws {Error} Quando inválido
 */
function toObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Retorna emails dos gestores da organização.
 * @param organizationId ID da organização (tenant)
 * @returns Lista de emails únicos e válidos
 */
export async function listManagerEmails(organizationId: string): Promise<string[]> {
  const organizationObjectId = toObjectId(organizationId, 'organizationId');
  const managers = await PlatformUserModel.find({
    memberships: {
      $elemMatch: {
        organizationId: organizationObjectId,
        role: { $in: MANAGER_ROLES },
      },
    },
  })
    .select({ email: 1 })
    .lean();

  const emails = managers
    .map((manager) => manager.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  return [...new Set(emails)];
}

/**
 * Configuração SMTP opcional carregada do ambiente.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * Lê configuração SMTP das variáveis de ambiente.
 * @returns Configuração completa ou `null` quando SMTP não está habilitado
 */
export function resolveSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !from) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from,
  };
}

/**
 * Cria ou reutiliza transporte SMTP de produção.
 * @param smtpConfig Configuração explícita (testes) ou leitura do env
 * @returns Transporte nodemailer ou `null` se desabilitado
 */
export function createSmtpTransport(smtpConfig: SmtpConfig | null = resolveSmtpConfigFromEnv()): Transporter | null {
  if (!smtpConfig) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.user && smtpConfig.pass ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
  });
}

/**
 * Obtém transporte SMTP singleton (lazy).
 * @returns Instância cacheada, `null` se SMTP desabilitado, ou `undefined` antes da primeira leitura
 */
export function getSmtpTransport(): Transporter | null {
  if (smtpTransport === undefined) {
    smtpTransport = createSmtpTransport();
  }

  return smtpTransport;
}

/**
 * Reseta cache de transporte (testes).
 * @returns {void}
 */
export function resetSmtpTransportCache(): void {
  smtpTransport = undefined;
}

/**
 * Envia digest semanal para lista de destinatários.
 * @param input Destinatários, conteúdo e transporte
 * @returns Métricas de envio
 */
export async function sendWeeklyInactivityDigest(
  input: SendWeeklyInactivityDigestInput,
): Promise<EmailDispatchResult> {
  if (!input.transport || input.to.length === 0) {
    return {
      disabled: !input.transport,
      recipients: input.to.length,
      sent: 0,
      failed: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of input.to) {
    try {
      await input.transport.sendMail({
        from: input.fromAddress,
        to: recipient,
        subject: input.digest.subject,
        text: input.digest.textBody,
        html: input.digest.htmlBody,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      log.warn({ err: error, recipient }, 'Falha ao enviar digest semanal por email');
    }
  }

  return {
    disabled: false,
    recipients: input.to.length,
    sent,
    failed,
  };
}

/**
 * Resolve nomes amigáveis de organização e guild para o email.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @returns Nomes para template
 */
async function resolveDigestLabels(
  organizationId: string,
  guildId: string,
): Promise<{ organizationName: string; guildName: string }> {
  const organizationObjectId = toObjectId(organizationId, 'organizationId');
  const [organization, guildConnection] = await Promise.all([
    OrganizationModel.findById(organizationObjectId).select({ name: 1 }).lean(),
    GuildConnectionModel.findOne({ organizationId: organizationObjectId, guildId, isActive: true })
      .select({ guildName: 1 })
      .lean(),
  ]);

  return {
    organizationName: organization?.name ?? 'Sua organização',
    guildName: guildConnection?.guildName ?? 'Servidor Discord',
  };
}

/**
 * Envia digest semanal de inatividade para gestores da organização (cron).
 * @param input Organização, guild, membros missing e fim do período
 * @returns Métricas de envio
 */
export async function sendWeeklyInactivityDigestToManagers(
  input: SendWeeklyInactivityDigestToManagersInput,
): Promise<EmailDispatchResult> {
  if (input.missingMembers.length === 0) {
    return { disabled: false, recipients: 0, sent: 0, failed: 0 };
  }

  const smtpConfig = resolveSmtpConfigFromEnv();
  const transport = smtpConfig ? createSmtpTransport(smtpConfig) : null;
  if (!transport || !smtpConfig) {
    return { disabled: true, recipients: 0, sent: 0, failed: 0 };
  }

  const [managerEmails, labels] = await Promise.all([
    listManagerEmails(input.organizationId),
    resolveDigestLabels(input.organizationId, input.guildId),
  ]);

  if (managerEmails.length === 0) {
    return { disabled: false, recipients: 0, sent: 0, failed: 0 };
  }

  const dashboardUrl = `${config.frontendUrl}/app/reports/inactivity`;
  const digest = buildWeeklyInactivityDigest({
    organizationName: labels.organizationName,
    guildName: labels.guildName,
    missingMembers: input.missingMembers,
    periodEnd: input.periodEnd,
    dashboardUrl,
  });

  const result = await sendWeeklyInactivityDigest({
    to: managerEmails,
    digest,
    transport,
    fromAddress: smtpConfig.from,
  });

  if (result.sent > 0) {
    log.info(
      {
        organizationId: input.organizationId,
        guildId: input.guildId,
        sent: result.sent,
        failed: result.failed,
        missingCount: input.missingMembers.length,
      },
      'Digest semanal de inatividade enviado por email',
    );
  }

  return result;
}
