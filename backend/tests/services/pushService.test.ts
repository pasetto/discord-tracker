import { beforeEach, describe, expect, it, vi } from 'vitest';

const webPushMocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

const pushSubscriptionModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
  deleteOne: vi.fn(),
}));

const platformUserModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: webPushMocks.setVapidDetails,
    sendNotification: webPushMocks.sendNotification,
  },
}));

vi.mock('../../src/db/models/PushSubscription', () => ({
  PushSubscriptionModel: {
    find: pushSubscriptionModelMocks.find,
    deleteOne: pushSubscriptionModelMocks.deleteOne,
  },
}));

vi.mock('../../src/db/models/PlatformUser', () => ({
  PlatformUserModel: {
    find: platformUserModelMocks.find,
  },
}));

import { notifyManagersAboutMissingMembers } from '../../src/services/pushService';

describe('pushService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@syntra.app';
  });

  it('envia push para subscriptions dos gestores quando há membros missing', async () => {
    platformUserModelMocks.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439012' }]),
      }),
    });
    pushSubscriptionModelMocks.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          endpoint: 'https://push.example/subscription-1',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        },
      ]),
    });
    webPushMocks.sendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await notifyManagersAboutMissingMembers({
      organizationId: '507f1f77bcf86cd799439011',
      guildId: 'guild-1',
      missingMembers: [
        {
          discordId: 'discord-1',
          displayName: 'Pessoa Sumida',
          inactiveBusinessDays: 3,
        },
      ],
    });

    expect(webPushMocks.setVapidDetails).toHaveBeenCalledTimes(1);
    expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      disabled: false,
      managers: 1,
      subscriptions: 1,
      sent: 1,
      failed: 0,
    });
  });

  it('não envia notificação quando VAPID não está configurado', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;

    const result = await notifyManagersAboutMissingMembers({
      organizationId: '507f1f77bcf86cd799439011',
      guildId: 'guild-1',
      missingMembers: [
        {
          discordId: 'discord-1',
          displayName: 'Pessoa Sumida',
          inactiveBusinessDays: 3,
        },
      ],
    });

    expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      disabled: true,
      managers: 0,
      subscriptions: 0,
      sent: 0,
      failed: 0,
    });
  });

  it('remove subscription inválida quando endpoint expira', async () => {
    platformUserModelMocks.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439012' }]),
      }),
    });
    pushSubscriptionModelMocks.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          endpoint: 'https://push.example/expired',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        },
      ]),
    });
    webPushMocks.sendNotification.mockRejectedValue({ statusCode: 410 });

    await notifyManagersAboutMissingMembers({
      organizationId: '507f1f77bcf86cd799439011',
      guildId: 'guild-1',
      missingMembers: [
        {
          discordId: 'discord-1',
          displayName: 'Pessoa Sumida',
          inactiveBusinessDays: 4,
        },
      ],
    });

    expect(pushSubscriptionModelMocks.deleteOne).toHaveBeenCalledWith({
      endpoint: 'https://push.example/expired',
    });
  });
});
