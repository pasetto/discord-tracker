/**
 * Copy e rota do paywall Team para features gated por plano.
 * Sem nova surface de billing — reutiliza a seção de preços da landing.
 */

/** CTA pt-BR exigido para gates de feature (ranking etc.). */
export const TEAM_PLAN_GATE_CTA =
  'Disponível no plano Team — ranking e relatórios avançados para o time.' as const;

/** Rota da landing com preços (upgrade/billing existente). */
export const TEAM_PLAN_UPGRADE_ROUTE = '/landing' as const;

/** Fragmento da âncora de pricing na landing. */
export const TEAM_PLAN_UPGRADE_FRAGMENT = 'pricing' as const;

/**
 * Mensagem completa do gate de ranking/gamificação por plano.
 * @param _featureLabel Nome amigável da feature (reservado; CTA já é autoexplicativo)
 * @returns Texto exibido no bloqueio por plano
 * @example
 * buildTeamPlanGateMessage('Ranking')
 * // 'Disponível no plano Team — ranking e relatórios avançados para o time.'
 */
export function buildTeamPlanGateMessage(_featureLabel: string): string {
  return TEAM_PLAN_GATE_CTA;
}

/**
 * Detecta se a razão de indisponibilidade veio do plano (não de toggle local).
 * @param reason Mensagem retornada pela API
 * @returns true quando o bloqueio é de plano
 */
export function isPlanFeatureGateReason(reason: string | undefined | null): boolean {
  if (!reason) {
    return false;
  }
  const normalized = reason.toLowerCase();
  return normalized.includes('plano atual') || normalized.includes('não está disponível no plano');
}
