import { Types } from 'mongoose';
import { brazilNationalHolidays2026To2028 } from '../data/brazilNationalHolidays2026-2028';
import {
  createDefaultWorkWeek,
  type IWorkCalendar,
  type WorkCalendar,
  type WorkCalendarHoliday,
  type WorkWeek,
  WorkCalendarModel,
} from '../db/models/WorkCalendar';

const UTC_DAY_TO_WORK_WEEK_KEY: Record<number, keyof WorkWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * Payload permitido para atualização do calendário da organização.
 */
export interface WorkCalendarUpdateInput {
  workWeek?: WorkWeek;
  holidays?: WorkCalendarHoliday[];
}

/**
 * Extrai uma string no formato YYYY-MM-DD em UTC para comparação de calendário.
 * @param value Data JavaScript a ser normalizada
 * @returns Data no formato ISO curto
 * @example
 * toIsoDateUtc(new Date('2026-12-25')) // "2026-12-25"
 */
function toIsoDateUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Converte o identificador textual em ObjectId válido do MongoDB.
 * @param value Valor recebido da rota/autenticação
 * @param label Nome do campo para mensagem de erro
 * @returns ObjectId pronto para persistência
 * @throws {Error} Quando o identificador não é um ObjectId válido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Remove duplicidades de feriado usando a data como chave única.
 * @param holidays Lista de feriados informada pelo cliente
 * @returns Lista consolidada preservando a última ocorrência de cada data
 */
function dedupeHolidays(holidays: WorkCalendarHoliday[]): WorkCalendarHoliday[] {
  const mapByDate = new Map<string, WorkCalendarHoliday>();
  for (const holiday of holidays) {
    mapByDate.set(holiday.date, holiday);
  }
  return [...mapByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Verifica se o dia informado é feriado no calendário (incluindo recorrência).
 * @param holidays Lista de feriados da organização
 * @param targetIsoDate Data alvo no formato YYYY-MM-DD
 * @returns true quando existe feriado aplicável
 */
function isHoliday(holidays: WorkCalendarHoliday[], targetIsoDate: string): boolean {
  const targetMonthDay = targetIsoDate.slice(5);
  return holidays.some((holiday) => {
    if (holiday.date === targetIsoDate) {
      return true;
    }
    return Boolean(holiday.recurring) && holiday.date.slice(5) === targetMonthDay;
  });
}

/**
 * Determina se uma data é dia útil para um calendário específico.
 * @param calendar Calendário com jornada e feriados da organização/guild
 * @param date Data analisada
 * @returns true quando o dia é útil conforme configuração
 * @example
 * isBusinessDay(calendar, new Date('2026-06-23')) // true
 */
export function isBusinessDay(calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'>, date: Date): boolean {
  const weekday = UTC_DAY_TO_WORK_WEEK_KEY[date.getUTCDay()];
  if (!calendar.workWeek[weekday].enabled) {
    return false;
  }

  const targetDate = toIsoDateUtc(date);
  if (isHoliday(calendar.holidays, targetDate)) {
    return false;
  }

  return true;
}

/**
 * Busca calendário da organização e cria o padrão quando não existir.
 * @param organizationId Identificador da organização (tenant)
 * @param userId Usuário autenticado que está alterando o recurso
 * @returns Documento de calendário pronto para uso na API
 */
export async function getOrCreateOrganizationWorkCalendar(
  organizationId: string,
  userId: string,
): Promise<IWorkCalendar> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const userObjectId = parseObjectId(userId, 'userId');

  const existing = await WorkCalendarModel.findOne({
    organizationId: organizationObjectId,
    guildId: { $exists: false },
  });
  if (existing) {
    return existing;
  }

  return WorkCalendarModel.create({
    organizationId: organizationObjectId,
    workWeek: createDefaultWorkWeek(),
    holidays: [],
    brNationalHolidaysSeeded: false,
    updatedBy: userObjectId,
  });
}

/**
 * Atualiza jornada e/ou feriados do calendário padrão da organização.
 * @param organizationId Identificador da organização (tenant)
 * @param userId Usuário autenticado responsável pela alteração
 * @param input Campos permitidos para atualização
 * @returns Documento atualizado após upsert
 */
export async function upsertOrganizationWorkCalendar(
  organizationId: string,
  userId: string,
  input: WorkCalendarUpdateInput,
): Promise<IWorkCalendar> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const userObjectId = parseObjectId(userId, 'userId');

  const toSet: Partial<IWorkCalendar> = {
    updatedBy: userObjectId,
  };

  // Campos default aplicados apenas na criação (upsert). Um mesmo caminho não
  // pode aparecer em $set e $setOnInsert ao mesmo tempo, senão o MongoDB lança
  // "Updating the path 'X' would create a conflict at 'X'". Por isso só caímos
  // no default quando o campo não veio no payload (e, portanto, não está em $set).
  const toSetOnInsert: Partial<IWorkCalendar> = {
    brNationalHolidaysSeeded: false,
  };

  if (input.workWeek) {
    toSet.workWeek = input.workWeek;
  } else {
    toSetOnInsert.workWeek = createDefaultWorkWeek();
  }

  if (input.holidays) {
    toSet.holidays = dedupeHolidays(input.holidays);
  } else {
    toSetOnInsert.holidays = [];
  }

  // organizationId é semeado automaticamente a partir da igualdade do filtro no
  // upsert; incluí-lo aqui também geraria conflito de caminho.
  return WorkCalendarModel.findOneAndUpdate(
    { organizationId: organizationObjectId, guildId: { $exists: false } },
    {
      $set: toSet,
      $setOnInsert: toSetOnInsert,
    },
    { new: true, upsert: true },
  );
}

/**
 * Faz seed dos feriados nacionais BR (2026-2028) no calendário da organização.
 * @param organizationId Identificador da organização (tenant)
 * @param userId Usuário autenticado responsável pela operação
 * @returns Calendário atualizado junto do total de feriados adicionados
 */
export async function seedBrazilNationalHolidays(
  organizationId: string,
  userId: string,
): Promise<{ calendar: IWorkCalendar; insertedCount: number }> {
  const calendar = await getOrCreateOrganizationWorkCalendar(organizationId, userId);
  const existingDates = new Set(calendar.holidays.map((holiday) => holiday.date));
  const holidaysToInsert = brazilNationalHolidays2026To2028.filter((holiday) => !existingDates.has(holiday.date));

  if (holidaysToInsert.length === 0) {
    calendar.brNationalHolidaysSeeded = true;
    calendar.updatedBy = parseObjectId(userId, 'userId');
    await calendar.save();
    return { calendar, insertedCount: 0 };
  }

  calendar.holidays = dedupeHolidays([...calendar.holidays, ...holidaysToInsert]);
  calendar.brNationalHolidaysSeeded = true;
  calendar.updatedBy = parseObjectId(userId, 'userId');
  await calendar.save();

  return { calendar, insertedCount: holidaysToInsert.length };
}
