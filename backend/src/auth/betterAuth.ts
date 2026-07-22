import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { createLogger } from '../logger';
import { hashPassword, verifyPassword } from '../services/passwordHash';
import { sendPasswordResetEmail } from '../services/passwordResetEmailService';

const log = createLogger('better-auth');

/** Captura de URL de reset para resposta admin (não logar o token). */
export interface CapturedPasswordReset {
  url: string;
  token: string;
  expiresAt: Date;
  emailed: boolean;
}

let authInstance: ReturnType<typeof betterAuth> | null = null;
const capturedResets = new Map<string, CapturedPasswordReset>();

/**
 * Invalida a instância Better Auth (testes / reconexão Mongo).
 * @returns {void}
 */
export function resetBetterAuthInstance(): void {
  authInstance = null;
  capturedResets.clear();
}

/**
 * Lê e remove a captura de reset associada a um email.
 * @param email Email do usuário
 * @returns Dados do reset ou `undefined`
 */
export function takeCapturedPasswordReset(email: string): CapturedPasswordReset | undefined {
  const key = email.trim().toLowerCase();
  const value = capturedResets.get(key);
  if (value) {
    capturedResets.delete(key);
  }
  return value;
}

/**
 * Espia a captura de reset sem remover (útil após requestPasswordReset).
 * @param email Email do usuário
 * @returns Dados do reset ou `undefined`
 */
export function peekCapturedPasswordReset(email: string): CapturedPasswordReset | undefined {
  return capturedResets.get(email.trim().toLowerCase());
}

/**
 * Obtém (ou cria) a instância Better Auth ligada ao Mongo atual.
 * Requer mongoose conectado. Sem social providers.
 * @returns Instância Better Auth
 * @throws {Error} Quando MongoDB não está conectado ou secret ausente
 */
export function getBetterAuth(): ReturnType<typeof betterAuth> {
  if (authInstance) {
    return authInstance;
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB não conectado para Better Auth');
  }

  const secret = (process.env.BETTER_AUTH_SECRET ?? process.env.JWT_SECRET)?.trim();
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET ou JWT_SECRET é obrigatório');
  }

  authInstance = betterAuth({
    database: mongodbAdapter(db, {
      // Standalone Mongo (memory-server / sem replica set) não suporta transactions.
      transaction: false,
    }),
    secret,
    baseURL: config.apiPublicUrl,
    basePath: '/api/v1/auth/ba',
    trustedOrigins: [config.frontendUrl],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      password: {
        hash: async (password: string) => hashPassword(password),
        verify: async ({ hash, password }: { hash: string; password: string }) =>
          verifyPassword(password, hash),
      },
      sendResetPassword: async ({ user, url, token }) => {
        const email = user.email.trim().toLowerCase();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        // Prefer frontend deep-link with token for Angular reset page + admin copy.
        const frontendResetUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const resetUrl = frontendResetUrl || url;
        let emailed = false;

        try {
          emailed = await sendPasswordResetEmail({
            to: user.email,
            resetUrl,
          });
        } catch (error) {
          log.warn({ err: error, email }, 'Falha ao enviar email de reset de senha');
        }

        capturedResets.set(email, { url: resetUrl, token, expiresAt, emailed });
      },
      onPasswordReset: async ({ user }) => {
        try {
          const { syncPlatformUserPasswordFromBetterAuth } = await import(
            '../services/betterAuthBridgeService'
          );
          await syncPlatformUserPasswordFromBetterAuth(user.email);
        } catch (error) {
          log.error({ err: error, email: user.email }, 'Falha ao sincronizar senha no PlatformUser');
        }
      },
    },
  });

  return authInstance;
}
