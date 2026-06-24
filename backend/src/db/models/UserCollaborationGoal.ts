import { Document, Schema, Types, model } from 'mongoose';

/**
 * Origem utilizada para criação/atualização de uma meta individual.
 */
export type UserCollaborationGoalSource = 'manual' | 'from_category_template' | 'copied';

/**
 * Meta efetiva de colaboração semanal, sempre vinculada a um TrackedUser.
 */
export interface IUserCollaborationGoal extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  trackedUserId: Types.ObjectId;
  weeklyCollaborationHours: number;
  dailyMinimumHours?: number;
  source: UserCollaborationGoalSource;
  setBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userCollaborationGoalSchema = new Schema<IUserCollaborationGoal>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    trackedUserId: { type: Schema.Types.ObjectId, ref: 'TrackedUser', required: true },
    weeklyCollaborationHours: { type: Number, required: true, min: 0 },
    dailyMinimumHours: { type: Number, required: false, min: 0 },
    source: { type: String, required: true, enum: ['manual', 'from_category_template', 'copied'] },
    setBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

userCollaborationGoalSchema.index({ organizationId: 1, guildId: 1, trackedUserId: 1 }, { unique: true });
userCollaborationGoalSchema.index({ organizationId: 1, guildId: 1, updatedAt: -1 });

/** Model Mongoose para collection user_collaboration_goals. */
export const UserCollaborationGoalModel = model<IUserCollaborationGoal>(
  'UserCollaborationGoal',
  userCollaborationGoalSchema,
);
