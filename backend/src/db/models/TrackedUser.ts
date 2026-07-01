import { Document, Schema, Types, model } from 'mongoose';

/** Motivo registrado ao desativar um membro rastreado. */
export type TrackedUserRemovedReason = 'left_guild';

/**
 * Documento do membro Discord rastreado por tenant/guild.
 */
export interface ITrackedUser extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  discordId: string;
  username: string;
  displayName: string;
  categoryId?: Types.ObjectId;
  categoryAssignedBy?: Types.ObjectId;
  categoryAssignedAt?: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastTextActivityAt?: Date;
  isActive: boolean;
  removedAt?: Date;
  removedReason?: TrackedUserRemovedReason;
  createdAt: Date;
  updatedAt: Date;
}

const trackedUserSchema = new Schema<ITrackedUser>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    discordId: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'MemberCategory', required: false },
    categoryAssignedBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: false },
    categoryAssignedAt: { type: Date, required: false },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    lastTextActivityAt: { type: Date, required: false },
    isActive: { type: Boolean, required: true, default: true, index: true },
    removedAt: { type: Date, required: false },
    removedReason: { type: String, enum: ['left_guild'], required: false },
  },
  { timestamps: true },
);

trackedUserSchema.index({ organizationId: 1, guildId: 1, discordId: 1 }, { unique: true });
trackedUserSchema.index({ organizationId: 1, guildId: 1, categoryId: 1 });
trackedUserSchema.index({ organizationId: 1, guildId: 1, lastSeenAt: -1 });

/** Model Mongoose para collection tracked_users. */
export const TrackedUserModel = model<ITrackedUser>('TrackedUser', trackedUserSchema);
