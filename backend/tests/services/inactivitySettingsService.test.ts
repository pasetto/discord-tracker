import { describe, expect, it } from 'vitest';
import { getInactivityThresholdSettings } from '../../src/services/inactivityService';

describe('getInactivityThresholdSettings', () => {
  it('aplica defaults quando documento não existe (sem breaking change)', () => {
    const settings = getInactivityThresholdSettings(undefined);

    expect(settings.inactiveAfterBusinessDays).toBe(2);
    expect(settings.zeroVoiceCollaborationDays).toBe(3);
    expect(settings.lateStartThresholdPercent).toBe(30);
    expect(settings.minCollaborationPercentOfElapsed).toBe(20);
    expect(settings.notifyManagerPush).toBe(true);
    expect(settings.notifyIntradayPush).toBe(true);
    expect(settings.notifyManagerEmail).toBe(false);
  });

  it('preserva campos legados e mescla novos campos intradiários', () => {
    const settings = getInactivityThresholdSettings({
      inactiveAfterBusinessDays: 3,
      zeroVoiceCollaborationDays: 4,
      lateStartThresholdPercent: 40,
      minCollaborationPercentOfElapsed: 25,
      notifyManagerPush: false,
      notifyIntradayPush: false,
      notifyManagerEmail: true,
    });

    expect(settings.inactiveAfterBusinessDays).toBe(3);
    expect(settings.lateStartThresholdPercent).toBe(40);
    expect(settings.minCollaborationPercentOfElapsed).toBe(25);
    expect(settings.notifyIntradayPush).toBe(false);
  });
});
