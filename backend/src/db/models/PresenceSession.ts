import { Schema, model, Document, Types } from 'mongoose';
import { PresenceStatus } from '../../config/env';

/**
 * Documento de sessão de presença de um usuário.
 */
export interface IPresenceSession extends Document {
  userId: Types.ObjectId;
  status: PresenceStatus;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

const presenceSessionSchema = new Schema<IPresenceSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['ONLINE', 'IDLE', 'DND', 'OFFLINE', 'INVISIBLE'],
      required: true,
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
  },
  { timestamps: false },
);

presenceSessionSchema.index({ userId: 1, endedAt: 1 });
presenceSessionSchema.index({ startedAt: 1 });

/** Model Mongoose para collection presence_sessions. */
export const PresenceSession = model<IPresenceSession>('PresenceSession', presenceSessionSchema);
