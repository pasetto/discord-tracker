import {
  TEAM_PLAN_GATE_CTA,
  TEAM_PLAN_UPGRADE_FRAGMENT,
  TEAM_PLAN_UPGRADE_ROUTE,
  buildTeamPlanGateMessage,
  isPlanFeatureGateReason,
} from './team-plan-gate.util';

describe('team-plan-gate.util', () => {
  it('expõe CTA pt-BR e rota de upgrade existentes', () => {
    expect(TEAM_PLAN_GATE_CTA).toContain('Disponível no plano Team');
    expect(TEAM_PLAN_GATE_CTA).toContain('ranking e relatórios avançados');
    expect(TEAM_PLAN_UPGRADE_ROUTE).toBe('/landing');
    expect(TEAM_PLAN_UPGRADE_FRAGMENT).toBe('pricing');
  });

  it('monta mensagem de gate sem mencionar produtividade', () => {
    const message = buildTeamPlanGateMessage('Ranking');
    expect(message).toContain('Disponível no plano Team');
    expect(message.toLowerCase()).not.toContain('produtividade');
  });

  it('identifica razões de bloqueio por plano', () => {
    expect(isPlanFeatureGateReason('Ranking não está disponível no plano atual')).toBeTrue();
    expect(isPlanFeatureGateReason('Ranking não está habilitado nas configurações de gamificação')).toBeFalse();
  });
});
