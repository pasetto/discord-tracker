import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RankingReportComponent } from './ranking-report.component';

describe('RankingReportComponent', () => {
  let fixture: ComponentFixture<RankingReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [RankingReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RankingReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne((request) =>
      request.url.includes('/gamification/ranking') && request.params.get('preset') === 'this_week',
    ).flush({
      report: {
        available: true,
        period: 'weekly',
        periodStart: '2026-06-16T00:00:00.000Z',
        periodEnd: '2026-06-24T23:59:59.999Z',
        metric: 'productive_hours',
        visibility: 'guild',
        anonymousMode: false,
        showExactHours: true,
        generatedAt: '2026-06-24T12:00:00.000Z',
        entries: [
          {
            position: 1,
            discordId: '1',
            displayName: 'Ana',
            isViewer: false,
            metricValue: 12,
            metricLabel: '12.0 h',
            productiveHours: 12,
            voiceHours: 10,
            onlineHours: 20,
            collaborationScore: 100,
          },
        ],
      },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('renderiza tabela de ranking quando disponível', () => {
    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Ana');
    expect(content).toContain('12.0 h');
  });

  it('exibe CTA Disponível no plano Team… quando ranking é gated pelo plano', () => {
    fixture.componentInstance.loadReport();
    httpMock.expectOne((request) => request.url.includes('/gamification/ranking')).flush({
      report: {
        available: false,
        reason: 'Ranking não está disponível no plano atual',
        period: 'weekly',
        periodStart: '2026-06-16T00:00:00.000Z',
        periodEnd: '2026-06-24T23:59:59.999Z',
        metric: 'productive_hours',
        visibility: 'guild',
        anonymousMode: false,
        showExactHours: true,
        generatedAt: '2026-06-24T12:00:00.000Z',
        entries: [],
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.isLockedByPlan).toBeTrue();
    const block = fixture.nativeElement.querySelector('[data-testid="ranking-unavailable"]') as HTMLElement;
    expect(block.textContent).toContain('Disponível no plano Team');
    expect(fixture.nativeElement.querySelector('[data-testid="ranking-team-upgrade"]')).toBeTruthy();
  });
});
