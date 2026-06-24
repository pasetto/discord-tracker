import { Document, Schema, Types, model } from 'mongoose';

/**
 * Tipo de feriado aceito no calendário da organização.
 */
export type WorkCalendarHolidayType = 'national_br' | 'company_custom';

/**
 * Chave válida de dia da semana para a jornada configurável.
 */
export type WorkWeekDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * Configuração de um dia da semana no calendário de trabalho.
 */
export interface WorkDaySchedule {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
}

/**
 * Jornada semanal completa utilizada para cálculo de dia útil.
 */
export interface WorkWeek {
  monday: WorkDaySchedule;
  tuesday: WorkDaySchedule;
  wednesday: WorkDaySchedule;
  thursday: WorkDaySchedule;
  friday: WorkDaySchedule;
  saturday: WorkDaySchedule;
  sunday: WorkDaySchedule;
}

/**
 * Feriado configurado para excluir dias do cálculo de colaboração.
 */
export interface WorkCalendarHoliday {
  date: string;
  name: string;
  type: WorkCalendarHolidayType;
  recurring?: boolean;
}

/**
 * Shape base do calendário de trabalho usado por serviços e testes.
 */
export interface WorkCalendar {
  organizationId?: Types.ObjectId | string;
  guildId?: string;
  workWeek: WorkWeek;
  holidays: WorkCalendarHoliday[];
  brNationalHolidaysSeeded: boolean;
  updatedBy?: Types.ObjectId | string;
}

/**
 * Documento persistido do calendário de trabalho por organização/guild.
 */
export interface IWorkCalendar extends Document, WorkCalendar {
  organizationId: Types.ObjectId;
  guildId?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Retorna a jornada padrão do MVP (seg-sex habilitado, fim de semana desabilitado).
 * @returns Jornada semanal padrão para novas organizações
 * @example
 * const defaultWeek = createDefaultWorkWeek();
 */
export function createDefaultWorkWeek(): WorkWeek {
  return {
    monday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    tuesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    wednesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    thursday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    friday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    saturday: { enabled: false },
    sunday: { enabled: false },
  };
}

const workDayScheduleSchema = new Schema<WorkDaySchedule>(
  {
    enabled: { type: Boolean, required: true },
    startTime: { type: String, required: false, trim: true },
    endTime: { type: String, required: false, trim: true },
  },
  { _id: false },
);

const workWeekSchema = new Schema<WorkWeek>(
  {
    monday: { type: workDayScheduleSchema, required: true },
    tuesday: { type: workDayScheduleSchema, required: true },
    wednesday: { type: workDayScheduleSchema, required: true },
    thursday: { type: workDayScheduleSchema, required: true },
    friday: { type: workDayScheduleSchema, required: true },
    saturday: { type: workDayScheduleSchema, required: true },
    sunday: { type: workDayScheduleSchema, required: true },
  },
  { _id: false },
);

const workCalendarHolidaySchema = new Schema<WorkCalendarHoliday>(
  {
    date: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['national_br', 'company_custom'] },
    recurring: { type: Boolean, required: false, default: false },
  },
  { _id: false },
);

const workCalendarSchema = new Schema<IWorkCalendar>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: false, trim: true },
    workWeek: { type: workWeekSchema, required: true, default: () => createDefaultWorkWeek() },
    holidays: { type: [workCalendarHolidaySchema], required: true, default: [] },
    brNationalHolidaysSeeded: { type: Boolean, required: true, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

workCalendarSchema.index({ organizationId: 1, guildId: 1 }, { unique: true });
workCalendarSchema.index({ organizationId: 1, guildId: 1, 'holidays.date': 1 });

/** Model Mongoose para collection work_calendars. */
export const WorkCalendarModel = model<IWorkCalendar>('WorkCalendar', workCalendarSchema);
