import { Document, Schema, Types, model } from 'mongoose';
import type { IntradayInactivityStatus } from '../../services/intradayInactivityService';

/**
 * Status intradiário que pode gerar alerta para gestores.
 */
export type IntradayAlertStatus = Extract<IntradayInactivityStatus, 'not_started' | 'low_collaboration_today'>;

/**
 * Registro de deduplicação de alertas intradiários por colaborador e status.
 */
export interface IIntradayAlertDispatch extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  trackedUserId: Types.ObjectId;
  localDate: string;
  status: IntradayAlertStatus;
  firstDetectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const intradayAlertDispatchSchema = new Schema<IIntradayAlertDispatch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true, index: true },
    trackedUserId: { type: Schema.Types.ObjectId, ref: 'TrackedUser', required: true, index: true },
    localDate: { type: String, required: true, trim: true },
    status: { type: String, required: true, enum: ['not_started', 'low_collaboration_today'] },
    firstDetectedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

intradayAlertDispatchSchema.index(
  {
    organizationId: 1,
    guildId: 1,
    trackedUserId: 1,
    localDate: 1,
    status: 1,
  },
  { unique: true, name: 'uniq_intraday_alert_dispatch' },
);

/** Model Mongoose para collection intraday_alert_dispatches. */
export const IntradayAlertDispatchModel = model<IIntradayAlertDispatch>(
  'IntradayAlertDispatch',
  intradayAlertDispatchSchema,
);
