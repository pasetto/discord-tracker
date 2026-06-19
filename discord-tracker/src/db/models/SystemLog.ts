import { Schema, model, Document } from 'mongoose';

/**
 * Log de sistema para auditoria e diagnóstico.
 */
export interface ISystemLog extends Document {
  level: string;
  message: string;
  context: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const systemLogSchema = new Schema<ISystemLog>(
  {
    level: { type: String, required: true },
    message: { type: String, required: true },
    context: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ context: 1 });

/** Model Mongoose para collection system_logs. */
export const SystemLog = model<ISystemLog>('SystemLog', systemLogSchema);
