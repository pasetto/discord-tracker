import { beforeEach, describe, expect, it, vi } from 'vitest';

const webhookEndpointModelMocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}));

const webhookDeliveryModelMocks = vi.hoisted(() => ({
  insertMany: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock('../../src/db/models/WebhookEndpoint', () => ({
  WebhookEndpointModel: webhookEndpointModelMocks,
}));

vi.mock('../../src/db/models/WebhookDelivery', () => ({
  WebhookDeliveryModel: webhookDeliveryModelMocks,
}));

import {
  calculateNextRetryAt,
  enqueueWebhookDeliveries,
  processWebhookDelivery,
} from '../../src/services/webhookService';

describe('webhookService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it('enfileira entregas para endpoints ativos inscritos no evento', async () => {
    webhookEndpointModelMocks.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439011',
          organizationId: '507f1f77bcf86cd799439001',
          isActive: true,
          events: ['member.inactivity.detected'],
        },
      ]),
    });
    webhookDeliveryModelMocks.insertMany.mockResolvedValue([]);

    const createdCount = await enqueueWebhookDeliveries({
      organizationId: '507f1f77bcf86cd799439001',
      event: 'member.inactivity.detected',
      payload: { discordId: '123', inactiveBusinessDays: 3 },
    });

    expect(createdCount).toBe(1);
    expect(webhookDeliveryModelMocks.insertMany).toHaveBeenCalledTimes(1);
    const queuedDelivery = webhookDeliveryModelMocks.insertMany.mock.calls[0][0][0];
    expect(String(queuedDelivery.organizationId)).toBe('507f1f77bcf86cd799439001');
    expect(queuedDelivery).toMatchObject({
      endpointId: '507f1f77bcf86cd799439011',
      event: 'member.inactivity.detected',
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
    });
  });

  it('assina payload com HMAC-SHA256 e envia headers obrigatórios', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T15:00:00.000Z'));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: vi.fn().mockResolvedValue('ok'),
    });
    vi.stubGlobal('fetch', fetchMock);

    webhookDeliveryModelMocks.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439101',
        organizationId: '507f1f77bcf86cd799439001',
        endpointId: '507f1f77bcf86cd799439011',
        event: 'member.inactivity.detected',
        payload: { message: 'payload-test' },
        attempts: 1,
        maxAttempts: 5,
        status: 'delivering',
      }),
    });
    webhookEndpointModelMocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        organizationId: '507f1f77bcf86cd799439001',
        url: 'https://hooks.example.com/syntra',
        secret: 'top-secret',
        isActive: true,
      }),
    });
    webhookDeliveryModelMocks.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
    webhookEndpointModelMocks.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    const result = await processWebhookDelivery('507f1f77bcf86cd799439101');

    expect(result).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.example.com/syntra');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Syntra-Event': 'member.inactivity.detected',
        'X-Syntra-Delivery-Id': '507f1f77bcf86cd799439101',
      }),
      body: JSON.stringify({ message: 'payload-test' }),
    });

    const signature = fetchMock.mock.calls[0][1].headers['X-Syntra-Signature'] as string;
    expect(signature.startsWith('sha256=')).toBe(true);
    expect(signature.length).toBe('sha256='.length + 64);
  });

  it('calcula agenda de retry exponencial com teto de 5 tentativas', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');

    expect(calculateNextRetryAt(1, now)?.toISOString()).toBe('2026-06-22T12:01:00.000Z');
    expect(calculateNextRetryAt(2, now)?.toISOString()).toBe('2026-06-22T12:05:00.000Z');
    expect(calculateNextRetryAt(3, now)?.toISOString()).toBe('2026-06-22T12:30:00.000Z');
    expect(calculateNextRetryAt(4, now)?.toISOString()).toBe('2026-06-22T14:00:00.000Z');
    expect(calculateNextRetryAt(5, now)?.toISOString()).toBe('2026-06-23T12:00:00.000Z');
    expect(calculateNextRetryAt(6, now)).toBeUndefined();
  });
});
