import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { GoalsReportComponent } from './goals-report.component';

describe('GoalsReportComponent', () => {
  let fixture: ComponentFixture<GoalsReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [GoalsReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GoalsReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne((request) =>
      request.url.includes('/reports/goals') && request.params.get('preset') === 'this_week',
    ).flush({
      report: { periodStart: '', periodEnd: '', generatedAt: '', entries: [] },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('renderiza relatório de metas com estado vazio', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(textContent).toContain('atualizar relatório');
    expect(textContent).toContain('nenhuma meta individual configurada');
    expect(textContent).toContain('configurar metas individuais');
  });
});

describe('GoalsReportComponent com dados', () => {
  let fixture: ComponentFixture<GoalsReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [GoalsReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GoalsReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne((request) =>
      request.url.includes('/reports/goals') && request.params.get('preset') === 'this_week',
    ).flush({
      report: {
        periodStart: '2026-06-30T00:00:00.000Z',
        periodEnd: '2026-07-02T23:59:59.999Z',
        generatedAt: '2026-07-02T12:00:00.000Z',
        entries: [
          {
            trackedUserId: 'u1',
            discordId: 'd1',
            displayName: 'Colaborador',
            weeklyGoalHours: 40,
            dailyMinimumHours: 7,
            periodMinimumHours: 21,
            businessDaysInPeriod: 3,
            realizedHours: 10,
            progressPercent: 25,
            shouldAlertLowProgress: false,
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

  it('aplica classe cinza quando abaixo do mínimo acumulado', () => {
    const bar = fixture.nativeElement.querySelector('.bg-gray-400');
    expect(bar).toBeTruthy();
  });

  it('lista metas em cards empilhados sem tabela densa', () => {
    const stack = fixture.nativeElement.querySelector('[data-testid="goals-stacked-cards"]') as HTMLElement;
    expect(stack).toBeTruthy();
    expect(stack.querySelectorAll('article').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
});
