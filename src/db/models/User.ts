import { Schema, model, Document, Types } from 'mongoose';

/**
 * Documento de usuário Discord rastreado pelo sistema.
 */
export interface IUser extends Document {
  discordId: string;
  username: string;
  displayName: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true },
);

/** Model Mongoose para collection users. */
export const User = model<IUser>('User', userSchema);
