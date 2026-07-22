import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AchievementsReportComponent } from './achievements-report.component';

describe('AchievementsReportComponent', () => {
  let fixture: ComponentFixture<AchievementsReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [AchievementsReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AchievementsReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne((request) => request.url.includes('/gamification/insights')).flush({
      insights: {
        available: true,
        presetPack: 'standard',
        generatedAt: '2026-06-24T12:00:00.000Z',
        members: [
          {
            discordId: '1',
            displayName: 'Ana',
            badgesEnabled: true,
            streaksEnabled: true,
            badges: [{ id: 'b1', name: 'Consistente', description: 'Presença estável', icon: '⭐' }],
            streak: { enabled: true, currentDays: 3, minHoursPerDay: 1 },
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

  it('renderiza conquistas em lista empilhada de cards (sem tabela)', () => {
    const stack = fixture.nativeElement.querySelector(
      '[data-testid="achievements-stacked-cards"]',
    ) as HTMLElement;
    expect(stack).toBeTruthy();
    expect(stack.querySelectorAll('article').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Ana');
    expect(fixture.nativeElement.textContent).toContain('Consistente');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
});
