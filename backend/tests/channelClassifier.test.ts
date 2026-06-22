import { describe, it, expect } from 'vitest';
import {
  classifyChannel,
  mapDiscordPresenceStatus,
  secondsToHours,
  getDayBounds,
  getMonthBounds,
} from '../src/services/channelClassifier';

describe('classifyChannel', () => {
  it('classifica canal produtivo', () => {
    const result = classifyChannel('111', 'Reunião Geral');
    expect(result.isIgnored).toBe(false);
    expect(result.sessionType).toBe('VOICE');
  });

  it('classifica canal AFK como ignorado', () => {
    const result = classifyChannel('222', 'AFK');
    expect(result.isIgnored).toBe(true);
    expect(result.sessionType).toBe('AFK');
  });

  it('classifica canal Almoço como LUNCH', () => {
    const result = classifyChannel('333', 'Almoço');
    expect(result.isIgnored).toBe(true);
    expect(result.sessionType).toBe('LUNCH');
  });

  it('classifica por ID ignorado', () => {
    const result = classifyChannel('AFK', 'Qualquer Nome');
    expect(result.isIgnored).toBe(true);
  });
});

describe('mapDiscordPresenceStatus', () => {
  it('mapeia status online', () => {
    expect(mapDiscordPresenceStatus('online')).toBe('ONLINE');
  });

  it('mapeia status idle', () => {
    expect(mapDiscordPresenceStatus('idle')).toBe('IDLE');
  });

  it('mapeia status dnd', () => {
    expect(mapDiscordPresenceStatus('dnd')).toBe('DND');
  });

  it('mapeia status invisible', () => {
    expect(mapDiscordPresenceStatus('invisible')).toBe('INVISIBLE');
  });

  it('mapeia status desconhecido como OFFLINE', () => {
    expect(mapDiscordPresenceStatus(null)).toBe('OFFLINE');
  });
});

describe('secondsToHours', () => {
  it('converte 3600 segundos para 1 hora', () => {
    expect(secondsToHours(3600)).toBe(1);
  });

  it('converte 5400 segundos para 1.5 horas', () => {
    expect(secondsToHours(5400)).toBe(1.5);
  });
});

describe('getDayBounds', () => {
  it('retorna início e fim do dia em America/Sao_Paulo', () => {
    const date = new Date('2026-06-19T15:30:00Z');
    const { start, end } = getDayBounds(date);

    expect(start.toISOString()).toBe('2026-06-19T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-20T03:00:00.000Z');
  });
});

describe('getMonthBounds', () => {
  it('retorna intervalo do mês em America/Sao_Paulo', () => {
    const { start, end } = getMonthBounds(2026, 6);

    expect(start.toISOString()).toBe('2026-06-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-01T03:00:00.000Z');
  });
});
