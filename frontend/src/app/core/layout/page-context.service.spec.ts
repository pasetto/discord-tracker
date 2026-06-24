import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PageContextService } from './page-context.service';

@Component({ standalone: true, template: '' })
class DummyPageComponent {}

describe('PageContextService', () => {
  it('resolve título a partir dos metadados de rota', async () => {
    TestBed.configureTestingModule({
      providers: [PageContextService, provideRouter([])],
    });

    const service = TestBed.inject(PageContextService);
    const router = TestBed.inject(Router);

    router.resetConfig([
      {
        path: 'app/dashboard',
        component: DummyPageComponent,
        data: { pageTitle: 'Início', breadcrumbLabel: 'Início' },
      },
    ]);

    await router.navigateByUrl('/app/dashboard');
    service.refresh();

    let resolvedTitle = '';
    service.context$.subscribe((ctx) => {
      resolvedTitle = ctx.title;
    });

    expect(resolvedTitle).toBe('Início');
  });
});
