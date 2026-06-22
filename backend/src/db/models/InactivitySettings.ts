import { Document, Schema, Types, model } from 'mongoose';

/**
 * Configurações de inatividade por organização e guild.
 */
export interface IInactivitySettings extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  inactiveAfterBusinessDays: number;
  zeroVoiceCollaborationDays: number;
  zeroCollaborationDays?: number;
  notifyManagerPush: boolean;
  notifyManagerEmail: boolean;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inactivitySettingsSchema = new Schema<IInactivitySettings>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    inactiveAfterBusinessDays: { type: Number, required: true, min: 1, default: 2 },
    zeroVoiceCollaborationDays: { type: Number, required: true, min: 1, default: 3 },
    zeroCollaborationDays: { type: Number, required: false, min: 1 },
    notifyManagerPush: { type: Boolean, required: true, default: true },
    notifyManagerEmail: { type: Boolean, required: true, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

inactivitySettingsSchema.index({ organizationId: 1, guildId: 1 }, { unique: true });

/** Model Mongoose para collection inactivity_settings. */
export const InactivitySettingsModel = model<IInactivitySettings>('InactivitySettings', inactivitySettingsSchema);
