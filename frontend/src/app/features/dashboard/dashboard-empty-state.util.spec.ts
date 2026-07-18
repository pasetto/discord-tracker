import { buildHealthyInactivityEmptyCopy, buildNoSyncedMembersCopy } from './dashboard-empty-state.util';

describe('dashboard-empty-state.util', () => {
  it('empty saudável cita sinais, calendário/PTO e inatividade (sem produtividade)', () => {
    const copy = buildHealthyInactivityEmptyCopy();
    expect(copy.title.toLowerCase()).toContain('inatividade');
    expect(copy.body.toLowerCase()).toContain('sinais');
    expect(copy.body.toLowerCase()).toContain('calendário');
    expect(copy.body.toLowerCase()).toContain('pto');
    expect(copy.body.toLowerCase()).toContain('sumiu');
    expect(copy.body.toLowerCase()).not.toContain('produtividade');
    expect(copy.body.toLowerCase()).not.toContain('bom sinal');
  });

  it('sem membros oferece CTA único de sincronização', () => {
    const copy = buildNoSyncedMembersCopy();
    expect(copy.ctaLabel).toBe('Sincronizar membros');
    expect(copy.ctaRoute).toBe('/app/settings/categories');
    expect(copy.body.toLowerCase()).toContain('sumiu');
  });
});
