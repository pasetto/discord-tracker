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
    throw new Error(`Token do bot inválido (${response.status}): ${body}`);
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
