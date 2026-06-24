import { Document, Schema, Types, model } from 'mongoose';

/**
 * Tipo de canal aceito no seletor de regras.
 */
export type ChannelType = 'voice' | 'text';

/**
 * Seleção de canal persistida como snapshot da UI.
 */
export interface ChannelSelection {
  channelId: string;
  channelName: string;
  channelType: ChannelType;
}

/**
 * Conjunto de regras de classificação de canais por guild.
 */
export interface ChannelRuleSet {
  ignored: ChannelSelection[];
  afk: ChannelSelection[];
  lunch: ChannelSelection[];
  productiveVoice: ChannelSelection[];
  productiveText: ChannelSelection[];
  ignoredText: ChannelSelection[];
}

/**
 * Documento de regras de canal por organização e guild.
 */
export interface IChannelRule extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  rules: ChannelRuleSet;
  createdAt: Date;
  updatedAt: Date;
}

const channelSelectionSchema = new Schema<ChannelSelection>(
  {
    channelId: { type: String, required: true, trim: true },
    channelName: { type: String, required: true, trim: true },
    channelType: { type: String, required: true, enum: ['voice', 'text'] },
  },
  { _id: false },
);

const channelRuleSetSchema = new Schema<ChannelRuleSet>(
  {
    ignored: { type: [channelSelectionSchema], default: [] },
    afk: { type: [channelSelectionSchema], default: [] },
    lunch: { type: [channelSelectionSchema], default: [] },
    productiveVoice: { type: [channelSelectionSchema], default: [] },
    productiveText: { type: [channelSelectionSchema], default: [] },
    ignoredText: { type: [channelSelectionSchema], default: [] },
  },
  { _id: false },
);

const channelRuleSchema = new Schema<IChannelRule>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    rules: { type: channelRuleSetSchema, required: true, default: () => ({}) },
  },
  { timestamps: true },
);

channelRuleSchema.index({ organizationId: 1, guildId: 1 }, { unique: true });
channelRuleSchema.index({ guildId: 1 });

/** Model Mongoose para collection channel_rules. */
export const ChannelRuleModel = model<IChannelRule>('ChannelRule', channelRuleSchema);
