import { config } from '../config/env';
import { PlatformUserModel } from '../db/models/PlatformUser';
import { createLogger } from '../logger';
import {
  getBetterAuth,
  peekCapturedPasswordReset,
  takeCapturedPasswordReset,
  type CapturedPasswordReset,
} from '../auth/betterAuth';

const log = createLogger('better-auth-bridge');

/**
 * Dados mínimos de PlatformUser para sincronizar com Better Auth.
 */
export interface PlatformUserCredentialSyncInput {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

/**
 * Resultado do fluxo admin de reset de senha.
 */
export interface AdminPasswordResetResult {
  resetUrl: string;
  expiresAt: string;
  emailed: boolean;
}

/**
 * Garante usuário + conta credential no Better Auth alinhados ao PlatformUser.
 * Usa o mesmo `id` do PlatformUser para mapeamento 1:1.
 * @param input Dados do usuário da plataforma (com hash bcrypt)
 * @returns {Promise<void>}
 */
export async function ensureBetterAuthCredentialUser(
  input: PlatformUserCredentialSyncInput,
): Promise<void> {
  const auth = getBetterAuth();
  const ctx = await auth.$context;
  const email = input.email.trim().toLowerCase();
  const existing = await ctx.internalAdapter.findUserByEmail(email);

  if (!existing?.user) {
    await ctx.internalAdapter.createUser({
      id: input.id,
      email,
      name: input.displayName,
      emailVerified: true,
    });
    await ctx.internalAdapter.createAccount({
      userId: input.id,
      accountId: input.id,
      providerId: 'credential',
      password: input.passwordHash,
    });
    return;
  }

  const userId = existing.user.id;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credential = accounts.find((account) => account.providerId === 'credential');

  if (!credential) {
    await ctx.internalAdapter.createAccount({
      userId,
      accountId: userId,
      providerId: 'credential',
      password: input.passwordHash,
    });
    return;
  }

  if (credential.password !== input.passwordHash) {
    await ctx.internalAdapter.updatePassword(userId, input.passwordHash);
  }
}

/**
 * Copia o hash credential do Better Auth para `PlatformUser.passwordHash`.
 * @param email Email do usuário
 * @returns {Promise<void>}
 */
export async function syncPlatformUserPasswordFromBetterAuth(email: string): Promise<void> {
  const auth = getBetterAuth();
  const ctx = await auth.$context;
  const normalized = email.trim().toLowerCase();
  const existing = await ctx.internalAdapter.findUserByEmail(normalized);
  if (!existing?.user) {
    return;
  }

  const accounts = await ctx.internalAdapter.findAccounts(existing.user.id);
  const credential = accounts.find((account) => account.providerId === 'credential');
  const passwordHash = credential?.password;
  if (!passwordHash) {
    return;
  }

  await PlatformUserModel.updateOne({ email: normalized }, { $set: { passwordHash } }).exec();
}

/**
 * Solicita reset de senha (público). Sempre retorna sucesso genérico.
 * @param email Email informado pelo usuário
 * @returns `{ ok: true }`
 */
export async function requestPublicPasswordReset(email: string): Promise<{ ok: true }> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { ok: true };
  }

  const platformUser = await PlatformUserModel.findOne({ email: normalized }).select('+passwordHash').exec();
  if (!platformUser?.passwordHash) {
    return { ok: true };
  }

  try {
    await ensureBetterAuthCredentialUser({
      id: String(platformUser._id),
      email: platformUser.email,
      displayName: platformUser.displayName,
      passwordHash: platformUser.passwordHash,
    });

    await getBetterAuth().api.requestPasswordReset({
      body: {
        email: normalized,
        redirectTo: `${config.frontendUrl}/reset-password`,
      },
    });
  } catch (error) {
    log.warn({ err: error }, 'requestPasswordReset falhou (resposta pública permanece genérica)');
  }

  return { ok: true };
}

/**
 * Conclui reset de senha com token Better Auth e sincroniza PlatformUser.
 * @param input Token + nova senha
 * @returns {Promise<void>}
 * @throws {Error} Quando token inválido/expirado ou senha fraca
 */
export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<void> {
  if (!input.newPassword || input.newPassword.length < 8) {
    throw new Error('A senha deve ter pelo menos 8 caracteres');
  }
  if (!input.token?.trim()) {
    throw new Error('Token de redefinição inválido');
  }

  try {
    await getBetterAuth().api.resetPassword({
      body: {
        token: input.token.trim(),
        newPassword: input.newPassword,
      },
    });
  } catch {
    throw new Error('Token de redefinição inválido ou expirado');
  }
}

/**
 * Cria (ou regenera) reset de senha para suporte admin e retorna URL recuperável.
 * @param userId ID do PlatformUser
 * @param actorId ID do super admin (somente audit log)
 * @returns URL, expiração e se o email foi enviado
 * @throws {Error} Quando usuário não existe
 */
export async function adminCreatePasswordReset(
  userId: string,
  actorId: string,
): Promise<AdminPasswordResetResult> {
  const platformUser = await PlatformUserModel.findById(userId).select('+passwordHash').exec();
  if (!platformUser?.passwordHash) {
    throw new Error('Usuário não encontrado');
  }

  await ensureBetterAuthCredentialUser({
    id: String(platformUser._id),
    email: platformUser.email,
    displayName: platformUser.displayName,
    passwordHash: platformUser.passwordHash,
  });

  await getBetterAuth().api.requestPasswordReset({
    body: {
      email: platformUser.email,
      redirectTo: `${config.frontendUrl}/reset-password`,
    },
  });

  const captured = peekCapturedPasswordReset(platformUser.email);
  if (!captured) {
    throw new Error('Não foi possível gerar link de redefinição');
  }

  takeCapturedPasswordReset(platformUser.email);

  log.info(
    { actorId, targetUserId: userId, emailed: captured.emailed },
    'Admin gerou reset de senha',
  );

  return toAdminPasswordResetResult(captured);
}

/**
 * Converte captura interna em DTO admin.
 * @param captured Dados capturados no sendResetPassword
 * @returns DTO para a API admin
 */
function toAdminPasswordResetResult(captured: CapturedPasswordReset): AdminPasswordResetResult {
  return {
    resetUrl: captured.url,
    expiresAt: captured.expiresAt.toISOString(),
    emailed: captured.emailed,
  };
}
