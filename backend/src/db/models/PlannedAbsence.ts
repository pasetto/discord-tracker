import { Document, Schema, Types, model } from 'mongoose';

/**
 * Tipos de ausência planejada aceitos no MVP.
 */
export type PlannedAbsenceType = 'vacation' | 'pto' | 'sick_leave' | 'other';

/**
 * Estados do ciclo de vida da ausência planejada.
 */
export type PlannedAbsenceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

/**
 * Documento de ausência planejada (férias/PTO/licença) por membro rastreado.
 */
export interface IPlannedAbsence extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  trackedUserId: Types.ObjectId;
  discordId: string;
  type: PlannedAbsenceType;
  startDate: Date;
  endDate: Date;
  note?: string;
  status: PlannedAbsenceStatus;
  createdBy: Types.ObjectId;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const plannedAbsenceSchema = new Schema<IPlannedAbsence>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    trackedUserId: { type: Schema.Types.ObjectId, ref: 'TrackedUser', required: true, index: true },
    discordId: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['vacation', 'pto', 'sick_leave', 'other'] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    note: { type: String, required: false, trim: true, maxlength: 500 },
    status: { type: String, required: true, enum: ['scheduled', 'active', 'completed', 'cancelled'], index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: false },
    cancelledAt: { type: Date, required: false },
  },
  { timestamps: true },
);

plannedAbsenceSchema.index({ organizationId: 1, guildId: 1, startDate: 1, endDate: 1 });
plannedAbsenceSchema.index({ trackedUserId: 1, status: 1 });
plannedAbsenceSchema.index({ organizationId: 1, guildId: 1, trackedUserId: 1, startDate: 1, endDate: 1 });

/** Model Mongoose para collection planned_absences. */
export const PlannedAbsenceModel = model<IPlannedAbsence>('PlannedAbsence', plannedAbsenceSchema);
