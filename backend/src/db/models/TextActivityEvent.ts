import { Document, Schema, Types, model } from 'mongoose';

/**
 * Tipos de sinal de texto aceitos no monitoramento.
 */
export type TextActivityEventType = 'message' | 'thread_reply' | 'reaction';

/**
 * Documento de atividade textual baseado apenas em metadados.
 */
export interface ITextActivityEvent extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  discordId: string;
  channelId: string;
  eventType: TextActivityEventType;
  occurredAt: Date;
  createdAt: Date;
}

const textActivityEventSchema = new Schema<ITextActivityEvent>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    discordId: { type: String, required: true, trim: true },
    channelId: { type: String, required: true, trim: true },
    eventType: { type: String, enum: ['message', 'thread_reply', 'reaction'], required: true },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

textActivityEventSchema.index({ organizationId: 1, guildId: 1, discordId: 1, occurredAt: -1 });
textActivityEventSchema.index({ organizationId: 1, guildId: 1, channelId: 1, occurredAt: -1 });

/** Model Mongoose para collection text_activity_events. */
export const TextActivityEventModel = model<ITextActivityEvent>('TextActivityEvent', textActivityEventSchema);
