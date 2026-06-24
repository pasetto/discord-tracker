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
      req.url === '/api/v1/org/org-1/guilds/guild-1/reports/text-collaboration'
      && req.params.has('from')
      && req.params.has('to'));

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
});
