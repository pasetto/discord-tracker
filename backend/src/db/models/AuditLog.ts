import { Document, Schema, Types, model } from 'mongoose';

/**
 * Documento de auditoria para rastreabilidade de ações sensíveis.
 */
export interface IAuditLog extends Document {
  organizationId?: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      required: true,
      index: true,
    },
    action: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: String, required: false, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, required: false, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ organizationId: 1, actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

/** Model Mongoose para collection audit_logs. */
export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
