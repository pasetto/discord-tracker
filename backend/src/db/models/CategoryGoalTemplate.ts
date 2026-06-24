import { Document, Schema, Types, model } from 'mongoose';

/**
 * Template de meta semanal sugerida para uma categoria de membros em um guild.
 */
export interface ICategoryGoalTemplate extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  categoryId: Types.ObjectId;
  weeklyCollaborationHours: number;
  dailyMinimumHours?: number;
  setBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const categoryGoalTemplateSchema = new Schema<ICategoryGoalTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'MemberCategory', required: true },
    weeklyCollaborationHours: { type: Number, required: true, min: 0 },
    dailyMinimumHours: { type: Number, required: false, min: 0 },
    setBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

categoryGoalTemplateSchema.index({ organizationId: 1, guildId: 1, categoryId: 1 }, { unique: true });

/** Model Mongoose para collection category_goal_templates. */
export const CategoryGoalTemplateModel = model<ICategoryGoalTemplate>(
  'CategoryGoalTemplate',
  categoryGoalTemplateSchema,
);
