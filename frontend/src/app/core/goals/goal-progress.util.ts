/** Status visual de progresso de meta individual. */
export type GoalProgressStatus = 'no_goal' | 'below_minimum' | 'on_track' | 'exceeded';

/** Entrada mínima para resolver status de meta. */
export interface GoalProgressInput {
  weeklyGoalHours: number | null;
  periodMinimumHours: number | null;
  realizedHours: number;
}

/**
 * Resolve status visual de meta vs realizado.
 * @param input Meta semanal, mínimo acumulado e horas realizadas
 * @returns Status para cor da barra e badges
 */
export function resolveGoalProgressStatus(input: GoalProgressInput): GoalProgressStatus {
  const { weeklyGoalHours, periodMinimumHours, realizedHours } = input;

  if (!weeklyGoalHours || weeklyGoalHours <= 0) {
    return 'no_goal';
  }
  if (realizedHours >= weeklyGoalHours) {
    return 'exceeded';
  }
  if (periodMinimumHours != null && realizedHours < periodMinimumHours) {
    return 'below_minimum';
  }
  return 'on_track';
}

/**
 * Retorna classe Tailwind da barra de progresso conforme status.
 * @param status Status resolvido
 * @returns Classe CSS da barra preenchida
 */
export function goalProgressBarClass(status: GoalProgressStatus): string {
  switch (status) {
    case 'below_minimum':
      return 'bg-gray-400 dark:bg-gray-500';
    case 'on_track':
      return 'bg-success-500';
    case 'exceeded':
      return 'bg-brand-500';
    default:
      return 'bg-gray-200 dark:bg-gray-700';
  }
}

/**
 * Calcula largura da barra (0–100) proporcional à meta semanal.
 * @param realizedHours Horas realizadas
 * @param weeklyGoalHours Meta semanal configurada
 * @returns Percentual de largura para CSS
 */
export function goalProgressBarWidth(realizedHours: number, weeklyGoalHours: number | null): number {
  if (!weeklyGoalHours || weeklyGoalHours <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (realizedHours / weeklyGoalHours) * 100));
}
