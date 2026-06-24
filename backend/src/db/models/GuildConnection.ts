import { Document, Schema, Types, model } from 'mongoose';

/**
 * Documento de conexão entre organização e servidor Discord monitorado.
 */
export interface IGuildConnection extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  guildName: string;
  iconUrl?: string;
  botInstalledAt: Date;
  isActive: boolean;
  timezone?: string;
  isMonitoringEnabled: boolean;
  selectedAt?: Date;
  selectedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const guildConnectionSchema = new Schema<IGuildConnection>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    guildName: { type: String, required: true, trim: true },
    iconUrl: { type: String, required: false, trim: true },
    botInstalledAt: { type: Date, required: true },
    isActive: { type: Boolean, required: true, default: true },
    timezone: { type: String, required: false, trim: true },
    isMonitoringEnabled: { type: Boolean, required: true, default: false },
    selectedAt: { type: Date, required: false },
    selectedBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: false },
  },
  { timestamps: true },
);

guildConnectionSchema.index({ organizationId: 1, guildId: 1 }, { unique: true });
guildConnectionSchema.index({ organizationId: 1, isActive: 1 });

/** Model Mongoose para collection guild_connections. */
export const GuildConnectionModel = model<IGuildConnection>('GuildConnection', guildConnectionSchema);
