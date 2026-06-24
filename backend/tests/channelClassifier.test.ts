import { describe, it, expect } from 'vitest';
import {
  classifyTextChannel,
  classifyVoiceChannel,
  mapDiscordPresenceStatus,
  secondsToHours,
  getDayBounds,
  getMonthBounds,
} from '../src/services/channelClassifier';

const rules = {
  ignored: [{ channelId: '1', channelName: 'lobby', channelType: 'voice' as const }],
  afk: [],
  lunch: [{ channelId: '2', channelName: 'Almoço', channelType: 'voice' as const }],
  productiveVoice: [],
  productiveText: [{ channelId: '10', channelName: 'dev-chat', channelType: 'text' as const }],
  ignoredText: [],
};

describe('classifyVoiceChannel', () => {
  it('classifica canal produtivo', () => {
    const result = classifyVoiceChannel('111', 'Reunião Geral', rules);
    expect(result.isIgnored).toBe(false);
    expect(result.sessionType).toBe('VOICE');
  });

  it('classifica canal Almoço como LUNCH', () => {
    const result = classifyVoiceChannel('2', 'Almoço', rules);
    expect(result.isIgnored).toBe(true);
    expect(result.sessionType).toBe('LUNCH');
  });

  it('classifica por ID ignorado', () => {
    const result = classifyVoiceChannel('1', 'Qualquer Nome', rules);
    expect(result.isIgnored).toBe(true);
    expect(result.sessionType).toBe('AFK');
  });

  it('canal não listado é VOICE colaborativo', () => {
    const result = classifyVoiceChannel('99', 'sync', rules);
    expect(result.sessionType).toBe('VOICE');
  });
});

describe('classifyTextChannel', () => {
  it('canal produtivo retorna true', () => {
    expect(classifyTextChannel('10', rules)).toBe(true);
  });

  it('canal fora da lista retorna false', () => {
    expect(classifyTextChannel('99', rules)).toBe(false);
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
