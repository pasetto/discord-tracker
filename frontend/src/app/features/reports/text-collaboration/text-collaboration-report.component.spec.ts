import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TextCollaborationReportComponent } from './text-collaboration-report.component';

describe('TextCollaborationReportComponent', () => {
  let fixture: ComponentFixture<TextCollaborationReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [TextCollaborationReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TextCollaborationReportComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('deve carregar relatório de sinais de texto', () => {
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });

    const reportRequest = httpMock.expectOne((req) =>
      req.url.includes('/reports/text-collaboration') && req.params.get('preset') === 'last_7_days',
    );

    reportRequest.flush({
      report: {
        from: '2026-06-24T00:00:00.000Z',
        to: '2026-06-24T23:59:59.999Z',
        generatedAt: '2026-06-24T12:00:00.000Z',
        entries: [
          {
            discordId: 'u-1',
            displayName: 'Ana',
            categoryId: null,
            eventsCount: 3,
            lastOccurredAt: '2026-06-24T11:00:00.000Z',
          },
        ],
      },
    });

    fixture.detectChanges();
    expect(fixture.componentInstance.report?.entries[0]?.displayName).toBe('Ana');
    expect(fixture.componentInstance.totalEvents).toBe(3);
  });

  it('expõe cards mobile e tabela desktop com classes de breakpoint md', () => {
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock
      .expectOne((req) => req.url.includes('/reports/text-collaboration'))
      .flush({
        report: {
          from: '2026-06-24T00:00:00.000Z',
          to: '2026-06-24T23:59:59.999Z',
          generatedAt: '2026-06-24T12:00:00.000Z',
          entries: [
            {
              discordId: 'u-1',
              displayName: 'Ana',
              categoryId: null,
              eventsCount: 3,
              lastOccurredAt: '2026-06-24T11:00:00.000Z',
            },
          ],
        },
      });
    fixture.detectChanges();

    const mobile = fixture.nativeElement.querySelector('[data-testid="text-collab-mobile-cards"]') as HTMLElement;
    const desktop = fixture.nativeElement.querySelector('[data-testid="text-collab-desktop-table"]') as HTMLElement;
    expect(mobile).toBeTruthy();
    expect(desktop).toBeTruthy();
    expect(mobile.className).toContain('md:hidden');
    expect(desktop.className).toContain('md:block');
    expect(mobile.textContent).toContain('Ana');
    expect(mobile.textContent).toContain('3 sinal(is)');
    expect(desktop.querySelector('table')).toBeTruthy();
  });
});
