import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';

/** Item de breadcrumb exibido no cabeçalho da página. */
export interface PageBreadcrumb {
  label: string;
  path?: string;
}

/** Contexto visual da página ativa (título e trilha de navegação). */
export interface PageContext {
  title: string;
  breadcrumbs: PageBreadcrumb[];
}

/**
 * Resolve título e breadcrumbs a partir dos metadados de rota Angular.
 */
@Injectable({ providedIn: 'root' })
export class PageContextService {
  private readonly contextSubject = new BehaviorSubject<PageContext>({
    title: 'Syntra',
    breadcrumbs: [],
  });

  /** Contexto atual da página para o header. */
  readonly context$ = this.contextSubject.asObservable();

  constructor(private readonly router: Router) {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.contextSubject.next(this.resolveFromRoute(this.router.routerState.snapshot.root));
    });
  }

  /**
   * Inicializa contexto na primeira renderização do layout autenticado.
   */
  refresh(): void {
    this.contextSubject.next(this.resolveFromRoute(this.router.routerState.snapshot.root));
  }

  /**
   * Percorre a árvore de rotas acumulando metadados de página.
   * @param root Snapshot raiz após navegação
   * @returns Contexto resolvido para exibição
   */
  private resolveFromRoute(root: ActivatedRouteSnapshot): PageContext {
    let title = 'Syntra';
    const breadcrumbs: PageBreadcrumb[] = [];
    let current: ActivatedRouteSnapshot | null = root;

    while (current) {
      if (current.data['pageTitle']) {
        title = current.data['pageTitle'] as string;
      }

      const crumbLabel = current.data['breadcrumbLabel'] as string | undefined;
      if (crumbLabel) {
        breadcrumbs.push({
          label: crumbLabel,
          path: current.routeConfig?.path ? this.buildPath(current) : undefined,
        });
      }

      current = current.firstChild;
    }

    return { title, breadcrumbs };
  }

  /**
   * Monta caminho absoluto simplificado para breadcrumb clicável.
   * @param snapshot Snapshot da rota do breadcrumb
   * @returns URL absoluta parcial
   */
  private buildPath(snapshot: ActivatedRouteSnapshot): string | undefined {
    const segments: string[] = [];
    let node: ActivatedRouteSnapshot | null = snapshot;

    while (node) {
      if (node.routeConfig?.path && !node.routeConfig.path.includes(':')) {
        segments.push(node.routeConfig.path);
      }
      node = node.parent;
    }

    const path = `/${segments.reverse().join('/')}`.replace(/\/+/g, '/');
    return path.startsWith('/app') ? path : undefined;
  }
}
