import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuditLogModel } from '../../src/db/models/AuditLog';
import { createAuditLog, listAuditTrailExportStub } from '../../src/services/auditLogService';

describe('auditLogService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AuditLogModel.syncIndexes();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await AuditLogModel.deleteMany({});
  });

  it('persiste evento de auditoria com contexto multitenant', async () => {
    const organizationId = new mongoose.Types.ObjectId().toHexString();
    const actorId = new mongoose.Types.ObjectId().toHexString();

    const createdLog = await createAuditLog({
      organizationId,
      actorId,
      action: 'report.exported',
      resourceType: 'report',
      resourceId: 'weekly-2026-06-22',
      metadata: {
        format: 'csv',
        scope: 'inactivity',
      },
      ip: '127.0.0.1',
    });

    expect(createdLog.organizationId?.toHexString()).toBe(organizationId);
    expect(createdLog.actorId.toHexString()).toBe(actorId);
    expect(createdLog.action).toBe('report.exported');
    expect(createdLog.resourceType).toBe('report');
    expect(createdLog.resourceId).toBe('weekly-2026-06-22');
    expect(createdLog.metadata).toMatchObject({ format: 'csv', scope: 'inactivity' });
  });

  it('lista stub de trilha LGPD ordenado e limitado', async () => {
    const organizationId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    await AuditLogModel.create([
      {
        organizationId,
        actorId,
        action: 'report.viewed',
        resourceType: 'member',
        resourceId: 'discord-111',
        metadata: { section: 'weekly' },
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
      },
      {
        organizationId,
        actorId,
        action: 'report.exported',
        resourceType: 'report',
        resourceId: 'weekly-2026-06-22',
        metadata: { format: 'json', includeAbsences: true },
        createdAt: new Date('2026-06-22T10:00:00.000Z'),
      },
      {
        organizationId: new mongoose.Types.ObjectId(),
        actorId,
        action: 'report.exported',
        resourceType: 'report',
        resourceId: 'should-not-appear',
        metadata: { format: 'csv' },
        createdAt: new Date('2026-06-23T10:00:00.000Z'),
      },
    ]);

    const entries = await listAuditTrailExportStub({
      organizationId: organizationId.toHexString(),
      actorId: actorId.toHexString(),
      limit: 2,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      action: 'report.exported',
      resourceType: 'report',
      resourceId: 'weekly-2026-06-22',
      metadataKeys: ['format', 'includeAbsences'],
    });
    expect(entries[1]).toMatchObject({
      action: 'report.viewed',
      resourceType: 'member',
      resourceId: 'discord-111',
      metadataKeys: ['section'],
    });
  });

  it('aceita log de escopo global sem organizationId', async () => {
    const actorId = new mongoose.Types.ObjectId().toHexString();

    const createdLog = await createAuditLog({
      actorId,
      action: 'plan.updated',
      resourceType: 'plan',
      metadata: { source: 'super-admin' },
    });

    expect(createdLog.organizationId).toBeUndefined();
    expect(createdLog.action).toBe('plan.updated');
  });

  it('falha quando actorId for inválido', async () => {
    await expect(
      createAuditLog({
        actorId: 'actor-invalido',
        action: 'report.exported',
        resourceType: 'report',
      }),
    ).rejects.toThrow('actorId inválido');
  });
});
