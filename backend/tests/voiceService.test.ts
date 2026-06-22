import { describe, it, expect } from 'vitest';
import { detectVoiceEvent } from '../src/services/voiceService';
import { VoiceState } from 'discord.js';

/**
 * Cria mock parcial de VoiceState para testes.
 */
function mockVoiceState(overrides: Partial<VoiceState> & { channelId?: string | null }): VoiceState {
  const channelId = overrides.channelId ?? null;
  return {
    channelId,
    channel:
      overrides.channel ??
      (channelId ? { id: channelId, name: 'Canal Teste' } : null),
    sessionId: overrides.sessionId ?? 'session-1',
    serverDeaf: overrides.serverDeaf ?? false,
    serverMute: overrides.serverMute ?? false,
    id: overrides.id ?? 'user-1',
    member: overrides.member ?? null,
    ...overrides,
  } as VoiceState;
}

describe('detectVoiceEvent', () => {
  it('detecta JOIN quando usuário entra em canal', () => {
    const oldState = mockVoiceState({ channelId: null });
    const newState = mockVoiceState({ channelId: '123' });

    expect(detectVoiceEvent(oldState, newState)).toBe('JOIN');
  });

  it('detecta DISCONNECT quando usuário sai de canal', () => {
    const oldState = mockVoiceState({ channelId: '123' });
    const newState = mockVoiceState({ channelId: null });

    expect(detectVoiceEvent(oldState, newState)).toBe('DISCONNECT');
  });

  it('detecta SWITCH quando troca de canal', () => {
    const oldState = mockVoiceState({ channelId: '123' });
    const newState = mockVoiceState({
      channelId: '456',
      channel: { id: '456', name: 'Outro Canal' } as VoiceState['channel'],
    });

    expect(detectVoiceEvent(oldState, newState)).toBe('SWITCH');
  });

  it('detecta AFK_AUTO quando movido para canal AFK', () => {
    const oldState = mockVoiceState({ channelId: '123' });
    const newState = mockVoiceState({
      channelId: '789',
      channel: { id: '789', name: 'AFK Room' } as VoiceState['channel'],
    });

    expect(detectVoiceEvent(oldState, newState)).toBe('AFK_AUTO');
  });

  it('retorna null quando não há mudança relevante', () => {
    const state = mockVoiceState({ channelId: '123' });
    expect(detectVoiceEvent(state, state)).toBe(null);
  });
});
