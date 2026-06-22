import { Document, Schema, Types, model } from 'mongoose';

/**
 * Papel de acesso de um usuário da plataforma dentro de uma organização.
 */
export type MembershipRole = 'owner' | 'admin' | 'manager' | 'viewer';

/**
 * Vínculo de um usuário da plataforma com uma organização.
 */
export interface IPlatformMembership {
  organizationId: Types.ObjectId;
  role: MembershipRole;
  invitedAt: Date;
  acceptedAt?: Date;
}

/**
 * Usuário autenticado da plataforma Syntra (gestor/admin).
 */
export interface IPlatformUser extends Document {
  discordId: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  memberships: IPlatformMembership[];
  createdAt: Date;
  updatedAt: Date;
}

const platformMembershipSchema = new Schema<IPlatformMembership>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, enum: ['owner', 'admin', 'manager', 'viewer'], required: true },
    invitedAt: { type: Date, required: true },
    acceptedAt: { type: Date, required: false },
  },
  { _id: false },
);

const platformUserSchema = new Schema<IPlatformUser>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: false, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, required: false, trim: true },
    isSuperAdmin: { type: Boolean, required: true, default: false },
    memberships: { type: [platformMembershipSchema], default: [] },
  },
  { timestamps: true },
);

platformUserSchema.index({ 'memberships.organizationId': 1, 'memberships.role': 1 });

/** Model Mongoose para collection platform_users. */
export const PlatformUserModel = model<IPlatformUser>('PlatformUser', platformUserSchema);
