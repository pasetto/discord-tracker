import { routes } from './app.routes';

describe('app routes — settings hub', () => {
  /**
   * Localiza a rota `/app/settings` na árvore principal.
   * @returns Rota de settings ou undefined
   */
  function findSettingsRoute() {
    const appRoute = routes.find((route) => route.path === 'app');
    return appRoute?.children?.find((route) => route.path === 'settings');
  }

  it('deve carregar o hub em /app/settings em vez de redirecionar para Discord', () => {
    const settings = findSettingsRoute();
    expect(settings).toBeTruthy();

    const defaultChild = settings?.children?.find((child) => child.path === '');
    expect(defaultChild).toBeTruthy();
    expect(defaultChild?.redirectTo).toBeUndefined();
    expect(defaultChild?.loadComponent).toBeTruthy();
  });
});
