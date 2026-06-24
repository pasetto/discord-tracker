import { Document, Schema, Types, model } from 'mongoose';

/**
 * Documento de categoria de membro por organização e guild.
 */
export interface IMemberCategory extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  name: string;
  slug: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const memberCategorySchema = new Schema<IMemberCategory>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    color: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

memberCategorySchema.index({ organizationId: 1, guildId: 1, slug: 1 }, { unique: true });
memberCategorySchema.index({ organizationId: 1, guildId: 1, name: 1 }, { unique: true });

/** Model Mongoose para collection member_categories. */
export const MemberCategoryModel = model<IMemberCategory>('MemberCategory', memberCategorySchema);
