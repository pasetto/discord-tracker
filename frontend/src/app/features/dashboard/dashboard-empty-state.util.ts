/**
 * Copy dos empty states do dashboard de inatividade / quem sumiu.
 */

/** Empty state quando há membros rastreados e zero alertas. */
export interface DashboardHealthyEmptyCopy {
  title: string;
  body: string;
}

/** Empty state quando ainda não há membros sincronizados. */
export interface DashboardNoMembersCopy {
  title: string;
  body: string;
  ctaLabel: string;
  ctaRoute: string;
}

/**
 * Copy confiável para 0 concerns com membros rastreados (sinais + calendário/PTO).
 * @returns Título e corpo do empty state saudável
 */
export function buildHealthyInactivityEmptyCopy(): DashboardHealthyEmptyCopy {
  return {
    title: 'Ninguém em alerta de inatividade agora.',
    body:
      'Os sinais de voz/texto e o calendário/PTO já foram aplicados — quem está em feriado, fora da jornada ou em ausência planejada não conta como “sumiu”.',
  };
}

/**
 * Copy com CTA único para sincronizar membros do Discord.
 * @returns Título, corpo e CTA para sync
 */
export function buildNoSyncedMembersCopy(): DashboardNoMembersCopy {
  return {
    title: 'Sincronize os membros do Discord',
    body: 'Sem colaboradores rastreados ainda não dá para saber quem sumiu. Importe o time uma vez e volte ao dashboard.',
    ctaLabel: 'Sincronizar membros',
    ctaRoute: '/app/settings/categories',
  };
}
