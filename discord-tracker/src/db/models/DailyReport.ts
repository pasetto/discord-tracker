import { Schema, model, Document, Types } from 'mongoose';

/**
 * Relatório diário agregado por usuário.
 */
export interface IDailyReport extends Document {
  userId: Types.ObjectId;
  date: Date;
  productiveSeconds: number;
  voiceSeconds: number;
  idleSeconds: number;
  offlineSeconds: number;
  afkSeconds: number;
  lunchSeconds: number;
}

const dailyReportSchema = new Schema<IDailyReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    productiveSeconds: { type: Number, default: 0 },
    voiceSeconds: { type: Number, default: 0 },
    idleSeconds: { type: Number, default: 0 },
    offlineSeconds: { type: Number, default: 0 },
    afkSeconds: { type: Number, default: 0 },
    lunchSeconds: { type: Number, default: 0 },
  },
  { timestamps: false },
);

dailyReportSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ date: 1 });

/** Model Mongoose para collection daily_reports. */
export const DailyReport = model<IDailyReport>('DailyReport', dailyReportSchema);
