import { Document, Schema, Types, model } from 'mongoose';

/**
 * Credenciais de aplicação Discord cadastradas via plataforma.
 */
export interface IDiscordApplication extends Document {
  name: string;
  clientId: string;
  clientSecretEncrypted: string;
  botTokenEncrypted: string;
  isPlatformDefault: boolean;
  organizationId?: Types.ObjectId;
  isActive: boolean;
  botUserId?: string;
  botUsername?: string;
  botAvatarUrl?: string;
  lastValidatedAt?: Date;
  validationError?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const discordApplicationSchema = new Schema<IDiscordApplication>(
  {
    name: { type: String, required: true, trim: true },
    clientId: { type: String, required: true, trim: true },
    clientSecretEncrypted: { type: String, required: true },
    botTokenEncrypted: { type: String, required: true },
    isPlatformDefault: { type: Boolean, required: true, default: false },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: false, index: true },
    isActive: { type: Boolean, required: true, default: true },
    botUserId: { type: String, required: false, trim: true },
    botUsername: { type: String, required: false, trim: true },
    botAvatarUrl: { type: String, required: false, trim: true },
    lastValidatedAt: { type: Date, required: false },
    validationError: { type: String, required: false, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

discordApplicationSchema.index(
  { isPlatformDefault: 1 },
  { unique: true, partialFilterExpression: { isPlatformDefault: true } },
);

/** Model Mongoose para collection discord_applications. */
export const DiscordApplicationModel = model<IDiscordApplication>(
  'DiscordApplication',
  discordApplicationSchema,
);
