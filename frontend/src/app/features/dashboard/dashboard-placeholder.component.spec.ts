import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardPlaceholderComponent } from './dashboard-placeholder.component';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { LiveActivitySocketService } from '../../core/api/live-activity-socket.service';
import { OnboardingProgressService } from '../../core/onboarding/onboarding-progress.service';
import { PushNotificationService } from '../../core/push/push-notification.service';
import { Subject } from 'rxjs';

describe('DashboardPlaceholderComponent', () => {
  let fixture: ComponentFixture<DashboardPlaceholderComponent>;
  let snapshotSubject: Subject<unknown>;
  let connectedSubject: Subject<boolean>;
  let pushStatusSpy: jasmine.Spy;

  beforeEach(async () => {
    snapshotSubject = new Subject();
    connectedSubject = new Subject();
    pushStatusSpy = jasmine.createSpy('getInactivityPushStatus').and.resolveTo('failed');

    localStorage.setItem(
      'syntra.auth.user',
      JSON.stringify({ id: 'u1', email: 'test@test.com', displayName: 'Eduardo Pereira' }),
    );
    localStorage.setItem('syntra.auth.organization', JSON.stringify({ id: 'org-1', name: 'Org', slug: 'org' }));
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.auth.token', 'token-test');

    await TestBed.configureTestingModule({
      imports: [DashboardPlaceholderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
        TenantContextService,
        OnboardingProgressService,
        {
          provide: LiveActivitySocketService,
          useValue: {
            snapshot$: snapshotSubject.asObservable(),
            transition$: new Subject().asObservable(),
            connected$: connectedSubject.asObservable(),
            error$: new Subject().asObservable(),
            connect: jasmine.createSpy('connect'),
            disconnect: jasmine.createSpy('disconnect'),
          },
        },
        {
          provide: PushNotificationService,
          useValue: {
            getInactivityPushStatus: pushStatusSpy,
            enableInactivityPushNotifications: jasmine.createSpy('enableInactivityPushNotifications'),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Responde o GET de progresso de onboarding (se ainda pendente).
   * @param httpMock Controlador de HTTP de teste
   * @param completed Se o onboarding já foi finalizado
   */
  function flushOnboardingRequest(httpMock: HttpTestingController, completed = false): void {
    const requests = httpMock.match('/api/v1/org/org-1/onboarding');
    for (const request of requests) {
      request.flush({
        onboarding: {
          currentStep: completed ? 8 : 1,
          completedSteps: completed ? [1, 2, 3, 4, 5, 6, 7, 8] : [1],
          botConnected: completed,
          guildSelected: completed,
          channelsConfigured: completed,
          calendarConfigured: completed,
          categoriesConfigured: completed,
          membersAssigned: completed,
          completedAt: completed ? '2026-07-01T12:00:00.000Z' : undefined,
        },
      });
    }
  }

  /**
   * Aguarda a Promise do status de push e atualiza a view.
   * @returns Promise resolvida após o spy e detectChanges
   */
  async function settlePushStatus(): Promise<void> {
    const pending = pushStatusSpy.calls.mostRecent()?.returnValue as Promise<unknown> | undefined;
    if (pending) {
      await pending;
    }
    fixture.detectChanges();
  }

  /**
   * Descarta requisições HTTP padrão do dashboard com guild configurada.
   * @param httpMock Controlador de HTTP de teste
   * @param options Opções do cenário de onboarding
   */
  function flushGuildDashboardRequests(
    httpMock: HttpTestingController,
    options: { onboardingComplete?: boolean } = {},
  ): void {
    flushOnboardingRequest(httpMock, options.onboardingComplete ?? false);
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/weekly').flush({ report: { entries: [] } });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/intraday').flush({
      report: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        elapsedWorkPercent: 40,
        elapsedWorkSeconds: 3600,
        totalWorkSeconds: 9000,
        isBusinessDay: true,
        isWithinWorkHours: true,
        settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
        concernEntries: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/goals?preset=this_week').flush({
      report: { periodStart: '', periodEnd: '', entries: [] },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/dashboard/overview').flush({
      overview: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        periodStart: '2026-06-26',
        periodEnd: '2026-07-02',
        trackedMembersCount: 0,
        weeklyAverageHours: 0,
        dailyCollaboration: [],
        heatmap: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });
  }

  it('deve criar o dashboard', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();
    flushOnboardingRequest(httpMock, false);
    const statusReq = httpMock.expectOne('/api/v1/org/org-1/discord/status');
    statusReq.flush({ botConnected: false, activeConnection: null });
    expect(fixture.componentInstance).toBeTruthy();
    httpMock.verify();
  });

  it('carrega alertas e metas quando guild está configurada', () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();

    flushOnboardingRequest(httpMock, false);
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/weekly').flush({
      report: {
        entries: [{ displayName: 'Ana', status: 'missing', inactiveBusinessDays: 2 }],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/intraday').flush({
      report: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        elapsedWorkPercent: 40,
        elapsedWorkSeconds: 3600,
        totalWorkSeconds: 9000,
        isBusinessDay: true,
        isWithinWorkHours: true,
        settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
        concernEntries: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/goals?preset=this_week').flush({
      report: { periodStart: '', periodEnd: '', entries: [] },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/dashboard/overview').flush({
      overview: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        periodStart: '2026-06-26',
        periodEnd: '2026-07-02',
        trackedMembersCount: 0,
        weeklyAverageHours: 0,
        dailyCollaboration: [],
        heatmap: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });

    expect(fixture.componentInstance.weeklyConcernEntries.length).toBe(1);
    httpMock.verify();
  });

  it('exibe saudação personalizada e lista de atenção intradiária', () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();

    flushOnboardingRequest(httpMock, false);
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/weekly').flush({ report: { entries: [] } });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/intraday').flush({
      report: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        elapsedWorkPercent: 40,
        elapsedWorkSeconds: 3600,
        totalWorkSeconds: 9000,
        isBusinessDay: true,
        isWithinWorkHours: true,
        settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
        concernEntries: [
          {
            trackedUserId: 'tu-1',
            discordId: 'd-1',
            displayName: 'Dev Test',
            status: 'not_started',
            elapsedWorkPercent: 40,
            collaborationPercentOfElapsed: 0,
            collaborationSecondsInWorkWindow: 0,
            elapsedWorkSeconds: 3600,
            hasAppearedToday: false,
          },
        ],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/goals?preset=this_week').flush({
      report: { periodStart: '', periodEnd: '', entries: [] },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/dashboard/overview').flush({
      overview: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        periodStart: '2026-06-26',
        periodEnd: '2026-07-02',
        trackedMembersCount: 1,
        weeklyAverageHours: 0,
        dailyCollaboration: [],
        heatmap: [],
      },
    });
    httpMock
      .expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users')
      .flush({ members: [{ id: '1', discordId: 'd-1', displayName: 'Dev Test', username: 'dev' }] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });

    fixture.detectChanges();

    expect(fixture.componentInstance.userFirstName).toBe('Eduardo');
    expect(fixture.componentInstance.attentionItems[0].displayName).toBe('Dev Test');
    httpMock.verify();
  });

  it('aplica classes de severidade na lista de atenção', () => {
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    expect(fixture.componentInstance.getAttentionMessageClass('critical')).toContain('error');
    expect(fixture.componentInstance.getAttentionMessageClass('warning')).toContain('warning');
  });

  it('tip de push menciona navegador/PWA e não Discord', async () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    pushStatusSpy.and.resolveTo('subscribed');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();
    flushGuildDashboardRequests(httpMock);
    await settlePushStatus();

    const tip = fixture.nativeElement.querySelector('[data-testid="dashboard-push-tip"]') as HTMLElement;
    expect(tip).toBeTruthy();
    const tipText = tip.textContent ?? '';
    expect(tipText.toLowerCase()).not.toContain('discord');
    expect(tipText.toLowerCase()).toMatch(/pwa|navegador/);
    expect(tipText.toLowerCase()).not.toContain('produtividade');
    expect(tipText).toContain('inscrito');
    expect(tip.querySelector('a[href="/app/settings/inactivity"]')).toBeTruthy();
    httpMock.verify();
  });

  it('exibe estado de permissão negada no tip de push', async () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    pushStatusSpy.and.resolveTo('denied');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();
    flushGuildDashboardRequests(httpMock);
    await settlePushStatus();

    const status = fixture.nativeElement.querySelector('[data-testid="dashboard-push-status"]') as HTMLElement;
    expect(status?.textContent ?? '').toContain('permissão negada');
    httpMock.verify();
  });

  it('exibe checklist de primeiro valor após onboarding sem missing/concernEntries', async () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();
    flushGuildDashboardRequests(httpMock, { onboardingComplete: true });
    await settlePushStatus();

    expect(fixture.componentInstance.showFirstValueChecklist).toBeTrue();
    const checklist = fixture.nativeElement.querySelector(
      '[data-testid="first-value-checklist"]',
    ) as HTMLElement;
    expect(checklist).toBeTruthy();
    const text = (checklist.textContent ?? '').toLowerCase();
    expect(text).not.toContain('produtividade');
    expect(text).toContain('canais colaborativos');
    expect(text).toContain('calendário');
    expect(text).toContain('pto');
    expect(text).toContain('navegador');
    expect(text).toContain('dia útil');
    expect(checklist.querySelector('a[href="/app/settings/channels"]')).toBeTruthy();
    expect(checklist.querySelector('a[href="/app/settings/calendar"]')).toBeTruthy();
    expect(checklist.querySelector('a[href="/app/settings/absences"]')).toBeTruthy();
    expect(checklist.querySelector('a[href="/app/settings/inactivity"]')).toBeTruthy();

    const ptoItem = fixture.componentInstance.firstValueChecklistItems.find((item) => item.id === 'pto');
    expect(ptoItem?.done).toBeTrue();
    expect(fixture.componentInstance.activeAbsences.length).toBe(0);
    httpMock.verify();
  });

  it('oculta checklist de primeiro valor quando há missing semanal', async () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();

    flushOnboardingRequest(httpMock, true);
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/weekly').flush({
      report: {
        entries: [{ displayName: 'Ana', status: 'missing', inactiveBusinessDays: 2 }],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/intraday').flush({
      report: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        elapsedWorkPercent: 40,
        elapsedWorkSeconds: 3600,
        totalWorkSeconds: 9000,
        isBusinessDay: true,
        isWithinWorkHours: true,
        settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
        concernEntries: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/goals?preset=this_week').flush({
      report: { periodStart: '', periodEnd: '', entries: [] },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/dashboard/overview').flush({
      overview: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        periodStart: '2026-06-26',
        periodEnd: '2026-07-02',
        trackedMembersCount: 1,
        weeklyAverageHours: 0,
        dailyCollaboration: [],
        heatmap: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });
    await settlePushStatus();

    expect(fixture.componentInstance.showFirstValueChecklist).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-testid="first-value-checklist"]')).toBeNull();
    httpMock.verify();
  });
});
