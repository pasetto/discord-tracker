import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const workCalendarModelMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock('../../src/db/models/WorkCalendar', async () => {
  const actual = await vi.importActual<typeof import('../../src/db/models/WorkCalendar')>(
    '../../src/db/models/WorkCalendar',
  );

  return {
    ...actual,
    WorkCalendarModel: workCalendarModelMocks,
  };
});

import {
  getOrCreateOrganizationWorkCalendar,
  seedBrazilNationalHolidays,
  upsertOrganizationWorkCalendar,
} from '../../src/services/workCalendarService';

describe('workCalendarService persistence', () => {
  const organizationId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('getOrCreate retorna calendário existente quando encontrado', async () => {
    const existingCalendar = { _id: 'calendar-1' };
    workCalendarModelMocks.findOne.mockResolvedValue(existingCalendar);

    const result = await getOrCreateOrganizationWorkCalendar(organizationId, userId);

    expect(result).toBe(existingCalendar);
    expect(workCalendarModelMocks.create).not.toHaveBeenCalled();
  });

  it('getOrCreate cria calendário padrão quando não existe', async () => {
    workCalendarModelMocks.findOne.mockResolvedValue(null);
    workCalendarModelMocks.create.mockResolvedValue({ _id: 'created-calendar' });

    const result = await getOrCreateOrganizationWorkCalendar(organizationId, userId);

    expect(result).toEqual({ _id: 'created-calendar' });
    expect(workCalendarModelMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        holidays: [],
        brNationalHolidaysSeeded: false,
      }),
    );
  });

  it('upsertOrganizationWorkCalendar normaliza feriados duplicados', async () => {
    const duplicateHoliday = { date: '2026-12-25', name: 'Natal antigo', type: 'national_br' as const };
    const updatedHoliday = { date: '2026-12-25', name: 'Natal atualizado', type: 'national_br' as const };

    workCalendarModelMocks.findOneAndUpdate.mockResolvedValue({ _id: 'calendar-2' });

    const result = await upsertOrganizationWorkCalendar(organizationId, userId, {
      holidays: [duplicateHoliday, updatedHoliday],
    });

    expect(result).toEqual({ _id: 'calendar-2' });
    expect(workCalendarModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          holidays: [updatedHoliday],
        }),
      }),
      { new: true, upsert: true },
    );
  });

  it('upsertOrganizationWorkCalendar não repete workWeek entre $set e $setOnInsert', async () => {
    const workWeek = {
      monday: { enabled: true, startTime: '08:00', endTime: '17:00' },
      tuesday: { enabled: true, startTime: '08:00', endTime: '17:00' },
      wednesday: { enabled: true, startTime: '08:00', endTime: '17:00' },
      thursday: { enabled: true, startTime: '08:00', endTime: '17:00' },
      friday: { enabled: true, startTime: '08:00', endTime: '17:00' },
      saturday: { enabled: false },
      sunday: { enabled: false },
    };

    workCalendarModelMocks.findOneAndUpdate.mockResolvedValue({ _id: 'calendar-3' });

    await upsertOrganizationWorkCalendar(organizationId, userId, { workWeek });

    const [, update] = workCalendarModelMocks.findOneAndUpdate.mock.calls[0];
    expect(update.$set.workWeek).toEqual(workWeek);
    // workWeek veio no payload, então não pode existir em $setOnInsert (evita conflito de caminho).
    expect(update.$setOnInsert).not.toHaveProperty('workWeek');
    // organizationId é semeado pelo filtro no upsert; não deve aparecer no $setOnInsert.
    expect(update.$setOnInsert).not.toHaveProperty('organizationId');
  });

  it('upsertOrganizationWorkCalendar aplica workWeek default no insert quando ausente no payload', async () => {
    workCalendarModelMocks.findOneAndUpdate.mockResolvedValue({ _id: 'calendar-4' });

    await upsertOrganizationWorkCalendar(organizationId, userId, {
      holidays: [{ date: '2026-12-25', name: 'Natal', type: 'national_br' as const }],
    });

    const [, update] = workCalendarModelMocks.findOneAndUpdate.mock.calls[0];
    // holidays veio no payload → fica em $set; workWeek ausente → default só no insert.
    expect(update.$set).not.toHaveProperty('workWeek');
    expect(update.$setOnInsert).toHaveProperty('workWeek');
    expect(update.$setOnInsert).not.toHaveProperty('holidays');
  });

  it('seedBrazilNationalHolidays marca seed e insere apenas feriados faltantes', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const existingCalendar = {
      holidays: [
        { date: '2026-01-01', name: 'Confraternização Universal', type: 'national_br' as const },
        { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'national_br' as const },
        { date: '2026-04-21', name: 'Tiradentes', type: 'national_br' as const },
        { date: '2026-05-01', name: 'Dia do Trabalho', type: 'national_br' as const },
        { date: '2026-09-07', name: 'Independência', type: 'national_br' as const },
        { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'national_br' as const },
        { date: '2026-11-02', name: 'Finados', type: 'national_br' as const },
        { date: '2026-11-15', name: 'Proclamação da República', type: 'national_br' as const },
        { date: '2026-12-25', name: 'Natal', type: 'national_br' as const },
        { date: '2027-01-01', name: 'Confraternização Universal', type: 'national_br' as const },
        { date: '2027-03-26', name: 'Sexta-feira Santa', type: 'national_br' as const },
        { date: '2027-04-21', name: 'Tiradentes', type: 'national_br' as const },
        { date: '2027-05-01', name: 'Dia do Trabalho', type: 'national_br' as const },
        { date: '2027-09-07', name: 'Independência', type: 'national_br' as const },
        { date: '2027-10-12', name: 'Nossa Senhora Aparecida', type: 'national_br' as const },
        { date: '2027-11-02', name: 'Finados', type: 'national_br' as const },
        { date: '2027-11-15', name: 'Proclamação da República', type: 'national_br' as const },
        { date: '2027-12-25', name: 'Natal', type: 'national_br' as const },
        { date: '2028-01-01', name: 'Confraternização Universal', type: 'national_br' as const },
        { date: '2028-04-14', name: 'Sexta-feira Santa', type: 'national_br' as const },
        { date: '2028-04-21', name: 'Tiradentes', type: 'national_br' as const },
        { date: '2028-05-01', name: 'Dia do Trabalho', type: 'national_br' as const },
        { date: '2028-09-07', name: 'Independência', type: 'national_br' as const },
        { date: '2028-10-12', name: 'Nossa Senhora Aparecida', type: 'national_br' as const },
        { date: '2028-11-02', name: 'Finados', type: 'national_br' as const },
        { date: '2028-11-15', name: 'Proclamação da República', type: 'national_br' as const },
        { date: '2028-12-25', name: 'Natal', type: 'national_br' as const },
      ],
      brNationalHolidaysSeeded: false,
      updatedBy: null,
      save: saveMock,
    };
    workCalendarModelMocks.findOne.mockResolvedValue(existingCalendar);

    const result = await seedBrazilNationalHolidays(organizationId, userId);

    expect(result.insertedCount).toBeGreaterThan(0);
    expect(existingCalendar.brNationalHolidaysSeeded).toBe(true);
    expect(existingCalendar.updatedBy).toBeInstanceOf(Types.ObjectId);
    expect(existingCalendar.holidays.length).toBeGreaterThan(27);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
