import { Types } from 'mongoose';
import { DiscordApplicationModel, type IDiscordApplication } from '../db/models/DiscordApplication';
import { encryptSecret, decryptSecret } from './encryptionService';

/**
 * Credenciais OAuth resolvidas a partir do aplicativo Discord padrão.
 */
export interface DiscordOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Payload para cadastro de aplicativo Discord via UI.
 */
export interface CreateDiscordApplicationInput {
  name: string;
  clientId: string;
  clientSecret: string;
  botToken: string;
  isPlatformDefault?: boolean;
}

/**
 * Resposta pública mascarada de um aplicativo Discord.
 */
export interface DiscordApplicationSummary {
  id: string;
  name: string;
  clientId: string;
  botTokenMasked: string;
  clientSecretMasked: string;
  isPlatformDefault: boolean;
  isActive: boolean;
  botUserId?: string;
  botUsername?: string;
  lastValidatedAt?: string;
  validationError?: string;
}

/**
 * Resultado da validação remota do token do bot no Discord.
 */
export interface DiscordBotValidationResult {
  botUserId: string;
  botUsername: string;
  botAvatarUrl?: string;
}

/** Formato esperado de Client ID (snowflake numérico do Discord). */
const DISCORD_CLIENT_ID_PATTERN = /^\d{17,20}$/;

/** Formato mínimo de Bot Token (três segmentos separados por ponto). */
const DISCORD_BOT_TOKEN_PATTERN = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * Valida formato local das credenciais antes de consultar o Discord.
 * @param input Credenciais informadas na UI
 * @throws {Error} Quando algum campo não corresponde ao formato do Developer Portal
 */
export function validateDiscordApplicationInputFormat(input: CreateDiscordApplicationInput): void {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  const botToken = input.botToken.trim();

  if (!DISCORD_CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error(
      'Client ID inválido. No Discord Developer Portal → OAuth2, copie o número longo (ex.: 1234567890123456789). Não use email nem nome.',
    );
  }

  if (clientSecret.length < 20) {
    throw new Error(
      'Client Secret inválido. No Discord Developer Portal → OAuth2, copie o Client Secret completo (geralmente 32 caracteres).',
    );
  }

  if (!DISCORD_BOT_TOKEN_PATTERN.test(botToken) || botToken.length < 50) {
    throw new Error(
      'Bot Token inválido. No Discord Developer Portal → Bot → Reset Token / Copy, cole o token completo (formato XXXXX.XXXXX.XXXXX). Não confunda com Client Secret.',
    );
  }
}

/**
 * Traduz falhas da API do Discord para mensagens amigáveis em português.
 * @param status Código HTTP retornado pelo Discord
 * @param body Corpo bruto da resposta
 * @returns Mensagem para exibir ao usuário
 */
export function formatDiscordBotTokenError(status: number, body: string): string {
  if (status === 401) {
    return (
      'O Discord rejeitou o Bot Token (401 Unauthorized). Verifique se você copiou o token em Developer Portal → Bot → Token. ' +
      'Se o token foi resetado recentemente, use o novo. Não use Client Secret no lugar do Bot Token.'
    );
  }

  return `Token do bot inválido (${status}): ${body}`;
}

/**
 * Mascara um segredo exibindo apenas os últimos 4 caracteres.
 * @param value Valor sensível em texto puro
 * @returns Texto mascarado para exibição na UI
 */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }
  return `••••${trimmed.slice(-4)}`;
}

/**
 * Converte documento Mongoose em resumo seguro para API.
 * @param app Documento de aplicativo Discord
 * @returns Resumo sem segredos em texto puro
 */
function toSummary(app: IDiscordApplication): DiscordApplicationSummary {
  let botTokenMasked = '••••';
  let clientSecretMasked = '••••';

  try {
    botTokenMasked = maskSecret(decryptSecret(app.botTokenEncrypted));
    clientSecretMasked = maskSecret(decryptSecret(app.clientSecretEncrypted));
  } catch {
    botTokenMasked = '••••????';
    clientSecretMasked = '••••????';
  }

  return {
    id: String(app._id),
    name: app.name,
    clientId: app.clientId,
    botTokenMasked,
    clientSecretMasked,
    isPlatformDefault: app.isPlatformDefault,
    isActive: app.isActive,
    botUserId: app.botUserId,
    botUsername: app.botUsername,
    lastValidatedAt: app.lastValidatedAt?.toISOString(),
    validationError: app.validationError,
  };
}

/**
 * Valida token do bot consultando a API do Discord.
 * @param botToken Token do bot em texto puro
 * @returns Dados básicos do bot retornados pelo Discord
 * @throws {Error} Quando o Discord rejeita o token
 */
export async function validateBotTokenRemote(botToken: string): Promise<DiscordBotValidationResult> {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bot ${botToken.trim()}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatDiscordBotTokenError(response.status, body));
  }

  const payload = (await response.json()) as {
    id: string;
    username: string;
    avatar?: string | null;
  };

  return {
    botUserId: payload.id,
    botUsername: payload.username,
    botAvatarUrl: payload.avatar
      ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png`
      : undefined,
  };
}

/**
 * Resolve credenciais OAuth do aplicativo Discord padrão ativo.
 * @returns Client ID e secret descriptografados
 * @throws {Error} Quando não há aplicativo padrão configurado
 */
export async function resolveDiscordOAuthCredentials(): Promise<DiscordOAuthCredentials> {
  const app = await DiscordApplicationModel.findOne({
    isPlatformDefault: true,
    isActive: true,
  }).exec();

  if (!app) {
    throw new Error(
      'Aplicativo Discord não configurado. Cadastre em /admin/discord ou execute npm run seed:discord-app',
    );
  }

  return {
    clientId: app.clientId,
    clientSecret: decryptSecret(app.clientSecretEncrypted),
  };
}

/**
 * Retorna client ID público do aplicativo padrão, quando existir.
 * @returns Client ID ou `null` se ainda não configurado
 */
export async function getPublicDiscordClientId(): Promise<string | null> {
  const app = await DiscordApplicationModel.findOne({
    isPlatformDefault: true,
    isActive: true,
  })
    .select('clientId')
    .lean<{ clientId: string }>()
    .exec();

  return app?.clientId ?? null;
}

/**
 * Lista aplicativos Discord cadastrados (sem expor segredos).
 * @returns Lista mascarada para UI administrativa
 */
export async function listDiscordApplications(): Promise<DiscordApplicationSummary[]> {
  const apps = await DiscordApplicationModel.find().sort({ createdAt: -1 }).exec();
  return apps.map((app) => toSummary(app));
}

/**
 * Cadastra um novo aplicativo Discord com segredos criptografados.
 * @param input Dados informados na UI
 * @param createdById ID do super admin autenticado
 * @returns Resumo mascarado do registro criado
 */
export async function createDiscordApplication(
  input: CreateDiscordApplicationInput,
  createdById: string,
): Promise<DiscordApplicationSummary> {
  validateDiscordApplicationInputFormat(input);
  const validation = await validateBotTokenRemote(input.botToken);
  const shouldBeDefault = input.isPlatformDefault ?? (await DiscordApplicationModel.countDocuments()) === 0;

  if (shouldBeDefault) {
    await DiscordApplicationModel.updateMany({ isPlatformDefault: true }, { isPlatformDefault: false });
  }

  const app = await DiscordApplicationModel.create({
    name: input.name.trim(),
    clientId: input.clientId.trim(),
    clientSecretEncrypted: encryptSecret(input.clientSecret.trim()),
    botTokenEncrypted: encryptSecret(input.botToken.trim()),
    isPlatformDefault: shouldBeDefault,
    isActive: true,
    botUserId: validation.botUserId,
    botUsername: validation.botUsername,
    botAvatarUrl: validation.botAvatarUrl,
    lastValidatedAt: new Date(),
    validationError: undefined,
    createdBy: new Types.ObjectId(createdById),
  });

  return toSummary(app);
}

/**
 * Revalida credenciais de um aplicativo contra a API do Discord.
 * @param applicationId ID do aplicativo
 * @returns Resumo atualizado após validação
 */
export async function validateDiscordApplication(applicationId: string): Promise<DiscordApplicationSummary> {
  const app = await DiscordApplicationModel.findById(applicationId).exec();
  if (!app) {
    throw new Error('Aplicativo Discord não encontrado');
  }

  try {
    const botToken = decryptSecret(app.botTokenEncrypted);
    const validation = await validateBotTokenRemote(botToken);
    app.botUserId = validation.botUserId;
    app.botUsername = validation.botUsername;
    app.botAvatarUrl = validation.botAvatarUrl;
    app.lastValidatedAt = new Date();
    app.validationError = undefined;
    await app.save();
  } catch (error) {
    app.validationError = (error as Error).message;
    await app.save();
    throw error;
  }

  return toSummary(app);
}

/**
 * Ativa aplicativo como padrão da plataforma e reconecta o bot.
 * @param applicationId ID do aplicativo
 * @returns Resumo do aplicativo ativado
 */
export async function activateDiscordApplication(applicationId: string): Promise<DiscordApplicationSummary> {
  const app = await DiscordApplicationModel.findById(applicationId).exec();
  if (!app) {
    throw new Error('Aplicativo Discord não encontrado');
  }

  await DiscordApplicationModel.updateMany({ isPlatformDefault: true }, { isPlatformDefault: false });
  app.isPlatformDefault = true;
  app.isActive = true;
  app.validationError = undefined;
  await app.save();

  await validateDiscordApplication(applicationId);

  const refreshed = await DiscordApplicationModel.findById(applicationId).exec();
  return toSummary(refreshed!);
}

/** Permissões mínimas para o bot monitorar voz e presença. */
const BOT_INVITE_PERMISSIONS = '36818496';

/**
 * Monta URL de convite OAuth para instalar o bot em um servidor Discord.
 * @param clientId Client ID público do aplicativo
 * @param state Estado opcional para correlação pós-redirect
 * @returns URL de autorização do Discord
 */
export function buildDiscordBotInstallUrl(clientId: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: BOT_INVITE_PERMISSIONS,
    scope: 'bot applications.commands',
  });
  if (state?.trim()) {
    params.set('state', state.trim());
  }
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * Busca aplicativo Discord vinculado à organização.
 * @param organizationId ID da organização
 * @returns Resumo mascarado ou null
 */
export async function getOrganizationDiscordApplication(
  organizationId: string,
): Promise<DiscordApplicationSummary | null> {
  const app = await DiscordApplicationModel.findOne({
    organizationId: new Types.ObjectId(organizationId),
  }).exec();
  return app ? toSummary(app) : null;
}

/**
 * Cadastra ou atualiza bot Discord da organização (sem alterar bot padrão da plataforma).
 * @param organizationId ID da organização
 * @param input Credenciais informadas na UI
 * @param createdById ID do usuário autenticado
 * @returns Resumo mascarado do aplicativo
 */
export async function upsertOrganizationDiscordApplication(
  organizationId: string,
  input: CreateDiscordApplicationInput,
  createdById: string,
): Promise<DiscordApplicationSummary> {
  validateDiscordApplicationInputFormat(input);
  const validation = await validateBotTokenRemote(input.botToken);
  const orgObjectId = new Types.ObjectId(organizationId);
  const existing = await DiscordApplicationModel.findOne({ organizationId: orgObjectId }).exec();

  if (existing) {
    existing.name = input.name.trim();
    existing.clientId = input.clientId.trim();
    existing.clientSecretEncrypted = encryptSecret(input.clientSecret.trim());
    existing.botTokenEncrypted = encryptSecret(input.botToken.trim());
    existing.botUserId = validation.botUserId;
    existing.botUsername = validation.botUsername;
    existing.botAvatarUrl = validation.botAvatarUrl;
    existing.lastValidatedAt = new Date();
    existing.validationError = undefined;
    existing.isActive = true;
    existing.isPlatformDefault = false;
    await existing.save();
    return toSummary(existing);
  }

  const app = await DiscordApplicationModel.create({
    name: input.name.trim(),
    clientId: input.clientId.trim(),
    clientSecretEncrypted: encryptSecret(input.clientSecret.trim()),
    botTokenEncrypted: encryptSecret(input.botToken.trim()),
    organizationId: orgObjectId,
    isPlatformDefault: false,
    isActive: true,
    botUserId: validation.botUserId,
    botUsername: validation.botUsername,
    botAvatarUrl: validation.botAvatarUrl,
    lastValidatedAt: new Date(),
    createdBy: new Types.ObjectId(createdById),
  });

  return toSummary(app);
}
