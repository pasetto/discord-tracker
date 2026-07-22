import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PlatformUserModel } from '../../src/db/models/PlatformUser';
import { hashPassword, loginPlatformUser, verifyPassword } from '../../src/services/platformAuthService';
import { resetBetterAuthInstance, takeCapturedPasswordReset } from '../../src/auth/betterAuth';
import {
  adminCreatePasswordReset,
  completePasswordReset,
  ensureBetterAuthCredentialUser,
  requestPublicPasswordReset,
} from '../../src/services/betterAuthBridgeService';

const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/passwordResetEmailService', () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

describe('betterAuthBridgeService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await PlatformUserModel.syncIndexes();
  }, 60000);

  afterAll(async () => {
    resetBetterAuthInstance();
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  beforeEach(async () => {
    resetBetterAuthInstance();
    sendPasswordResetEmailMock.mockReset();
    sendPasswordResetEmailMock.mockResolvedValue(true);
    await PlatformUserModel.deleteMany({});
  });

  it('permite login com hash bcrypt legado após sync Better Auth', async () => {
    const passwordHash = await hashPassword('senha-segura');
    const user = await PlatformUserModel.create({
      email: 'legacy@test.com',
      passwordHash,
      displayName: 'Legacy',
      isSuperAdmin: true,
      memberships: [],
    });

    await ensureBetterAuthCredentialUser({
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      passwordHash,
    });

    const session = await loginPlatformUser({
      email: 'legacy@test.com',
      password: 'senha-segura',
    });

    expect(session.user.email).toBe('legacy@test.com');
    expect(await verifyPassword('senha-segura', passwordHash)).toBe(true);
  });

  it('request público de reset captura URL e dispara SMTP', async () => {
    const passwordHash = await hashPassword('senha-segura');
    await PlatformUserModel.create({
      email: 'reset@test.com',
      passwordHash,
      displayName: 'Reset',
      isSuperAdmin: true,
      memberships: [],
    });

    const result = await requestPublicPasswordReset('reset@test.com');
    expect(result).toEqual({ ok: true });

    const captured = takeCapturedPasswordReset('reset@test.com');
    expect(captured?.url).toContain('http://localhost:4200/reset-password');
    expect(captured?.token).toBeTruthy();
    expect(sendPasswordResetEmailMock).toHaveBeenCalledOnce();
  });

  it('completa reset com token válido e atualiza PlatformUser', async () => {
    const passwordHash = await hashPassword('senha-antiga');
    await PlatformUserModel.create({
      email: 'complete@test.com',
      passwordHash,
      displayName: 'Complete',
      isSuperAdmin: true,
      memberships: [],
    });

    await requestPublicPasswordReset('complete@test.com');
    const captured = takeCapturedPasswordReset('complete@test.com');
    expect(captured?.token).toBeTruthy();

    await completePasswordReset({
      token: captured!.token,
      newPassword: 'senha-nova-123',
    });

    const updated = await PlatformUserModel.findOne({ email: 'complete@test.com' })
      .select('+passwordHash')
      .exec();
    expect(updated).toBeTruthy();
    expect(await verifyPassword('senha-nova-123', updated!.passwordHash)).toBe(true);
    expect(await verifyPassword('senha-antiga', updated!.passwordHash)).toBe(false);
  });

  it('adminCreatePasswordReset devolve URL recuperável para suporte', async () => {
    const passwordHash = await hashPassword('senha-segura');
    const user = await PlatformUserModel.create({
      email: 'support@test.com',
      passwordHash,
      displayName: 'Support',
      isSuperAdmin: false,
      memberships: [],
    });

    const result = await adminCreatePasswordReset(String(user._id), 'actor-admin');
    expect(result.resetUrl).toContain('/reset-password');
    expect(result.expiresAt).toBeTruthy();
    expect(result.emailed).toBe(true);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledOnce();
  });

  it('email desconhecido no forgot-password retorna sucesso genérico', async () => {
    const result = await requestPublicPasswordReset('nobody@test.com');
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });
});
