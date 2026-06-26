import { Schema, model, Document, Types } from 'mongoose';
import { VoiceSessionType } from '../../config/env';

/**
 * Documento de sessão de voz de um usuário.
 */
export interface IVoiceSession extends Document {
  organizationId?: Types.ObjectId;
  guildId?: string;
  userId: Types.ObjectId;
  channelId: string;
  channelName: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  isIgnoredChannel: boolean;
  sessionType: VoiceSessionType;
  createdAt: Date;
}

const voiceSessionSchema = new Schema<IVoiceSession>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: false, index: true },
    guildId: { type: String, required: false, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channelId: { type: String, required: true },
    channelName: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    isIgnoredChannel: { type: Boolean, required: true, default: false },
    sessionType: { type: String, enum: ['VOICE', 'AFK', 'LUNCH'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

voiceSessionSchema.index({ userId: 1, endedAt: 1 });
voiceSessionSchema.index({ organizationId: 1, guildId: 1, userId: 1, endedAt: 1 });
voiceSessionSchema.index({ organizationId: 1, guildId: 1, startedAt: 1 });
voiceSessionSchema.index({ startedAt: 1 });

/** Model Mongoose para collection voice_sessions. */
export const VoiceSession = model<IVoiceSession>('VoiceSession', voiceSessionSchema);
