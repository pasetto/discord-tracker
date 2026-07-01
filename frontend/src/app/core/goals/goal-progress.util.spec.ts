import { goalProgressBarClass, resolveGoalProgressStatus } from './goal-progress.util';

describe('goal-progress.util', () => {
  it('retorna below_minimum quando realizado abaixo do mínimo acumulado', () => {
    expect(
      resolveGoalProgressStatus({
        weeklyGoalHours: 40,
        periodMinimumHours: 21,
        realizedHours: 16.54,
      }),
    ).toBe('below_minimum');
  });

  it('retorna on_track entre mínimo e meta semanal', () => {
    expect(
      resolveGoalProgressStatus({
        weeklyGoalHours: 40,
        periodMinimumHours: 21,
        realizedHours: 25,
      }),
    ).toBe('on_track');
  });

  it('retorna exceeded quando realizado >= meta semanal', () => {
    expect(
      resolveGoalProgressStatus({
        weeklyGoalHours: 40,
        periodMinimumHours: 21,
        realizedHours: 42,
      }),
    ).toBe('exceeded');
  });

  it('retorna on_track quando periodMinimumHours é null', () => {
    expect(
      resolveGoalProgressStatus({
        weeklyGoalHours: 40,
        periodMinimumHours: null,
        realizedHours: 10,
      }),
    ).toBe('on_track');
  });

  it('mapeia status para classes Tailwind', () => {
    expect(goalProgressBarClass('below_minimum')).toContain('gray');
    expect(goalProgressBarClass('on_track')).toContain('success');
    expect(goalProgressBarClass('exceeded')).toContain('brand');
  });
});
