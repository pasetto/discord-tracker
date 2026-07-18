import { Document, Schema, Types, model } from 'mongoose';
import { PlannedAbsenceType } from './PlannedAbsence';

/**
 * Status possíveis para entrada de relatório de inatividade.
 */
export type InactivityStatus = 'missing' | 'low_voice_collaboration' | 'returned' | 'on_planned_absence' | 'active';

/**
 * Ausência planejada associada ao status de inatividade (tipo + janela).
 * `startDate` pode estar ausente em snapshots legados gerados antes de SYN-38.
 */
export interface InactivityPlannedAbsenceReference {
  type: PlannedAbsenceType;
  startDate?: Date;
  endDate: Date;
}

/**
 * Entrada persistida no snapshot de inatividade semanal.
 */
export interface InactivitySnapshotEntry {
  trackedUserId: Types.ObjectId;
  discordId: string;
  displayName: string;
  categoryId?: Types.ObjectId;
  categoryName?: string;
  lastSeenAt: Date;
  lastVoiceCollaborationAt?: Date;
  lastTextActivityAt?: Date;
  lastPresenceAt: Date;
  inactiveBusinessDays: number;
  status: InactivityStatus;
  plannedAbsence?: InactivityPlannedAbsenceReference;
}

/**
 * Snapshot semanal de inatividade por organização e guild.
 */
export interface IInactivitySnapshot extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  periodStart: Date;
  periodEnd: Date;
  entries: InactivitySnapshotEntry[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inactivityPlannedAbsenceReferenceSchema = new Schema<InactivityPlannedAbsenceReference>(
  {
    type: { type: String, required: true, enum: ['vacation', 'pto', 'sick_leave', 'other'] },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: true },
  },
  { _id: false },
);

const inactivitySnapshotEntrySchema = new Schema<InactivitySnapshotEntry>(
  {
    trackedUserId: { type: Schema.Types.ObjectId, ref: 'TrackedUser', required: true },
    discordId: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'MemberCategory', required: false },
    categoryName: { type: String, required: false, trim: true },
    lastSeenAt: { type: Date, required: true },
    lastVoiceCollaborationAt: { type: Date, required: false },
    lastTextActivityAt: { type: Date, required: false },
    lastPresenceAt: { type: Date, required: true },
    inactiveBusinessDays: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ['missing', 'low_voice_collaboration', 'returned', 'on_planned_absence', 'active'],
    },
    plannedAbsence: { type: inactivityPlannedAbsenceReferenceSchema, required: false },
  },
  { _id: false },
);

const inactivitySnapshotSchema = new Schema<IInactivitySnapshot>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    entries: { type: [inactivitySnapshotEntrySchema], required: true, default: [] },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

inactivitySnapshotSchema.index({ organizationId: 1, guildId: 1, periodStart: -1 }, { unique: true });
inactivitySnapshotSchema.index({ organizationId: 1, guildId: 1, generatedAt: -1 });
inactivitySnapshotSchema.index({ organizationId: 1, guildId: 1, 'entries.status': 1 });

/** Model Mongoose para collection inactivity_snapshots. */
export const InactivitySnapshotModel = model<IInactivitySnapshot>('InactivitySnapshot', inactivitySnapshotSchema);
