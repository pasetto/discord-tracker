import { Document, Schema, Types, model } from 'mongoose';
import type { VoiceEventType, VoiceSessionType } from '../../config/env';

/**
 * Registro de entrada, saída ou troca de canal de voz de um membro.
 */
export interface IVoiceChannelTransition extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  userId: Types.ObjectId;
  discordId: string;
  displayName: string;
  eventType: VoiceEventType;
  fromChannelId?: string;
  fromChannelName?: string;
  toChannelId?: string;
  toChannelName?: string;
  fromSessionType?: VoiceSessionType;
  toSessionType?: VoiceSessionType;
  fromIgnored: boolean;
  toIgnored: boolean;
  countsAsCollaboration: boolean;
  occurredAt: Date;
  createdAt: Date;
}

const voiceChannelTransitionSchema = new Schema<IVoiceChannelTransition>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    discordId: { type: String, required: true, trim: true, index: true },
    displayName: { type: String, required: true, trim: true },
    eventType: {
      type: String,
      required: true,
      enum: ['JOIN', 'LEAVE', 'SWITCH', 'MOVED', 'AFK_AUTO', 'RECONNECT', 'DISCONNECT'],
    },
    fromChannelId: { type: String, required: false, trim: true },
    fromChannelName: { type: String, required: false, trim: true },
    toChannelId: { type: String, required: false, trim: true },
    toChannelName: { type: String, required: false, trim: true },
    fromSessionType: { type: String, required: false, enum: ['VOICE', 'AFK', 'LUNCH'] },
    toSessionType: { type: String, required: false, enum: ['VOICE', 'AFK', 'LUNCH'] },
    fromIgnored: { type: Boolean, required: true, default: false },
    toIgnored: { type: Boolean, required: true, default: false },
    countsAsCollaboration: { type: Boolean, required: true, default: false },
    occurredAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

voiceChannelTransitionSchema.index({ organizationId: 1, guildId: 1, occurredAt: -1 });
voiceChannelTransitionSchema.index({ organizationId: 1, guildId: 1, discordId: 1, occurredAt: -1 });

/** Model Mongoose para histórico de passagem por canais de voz. */
export const VoiceChannelTransitionModel = model<IVoiceChannelTransition>(
  'VoiceChannelTransition',
  voiceChannelTransitionSchema,
);
