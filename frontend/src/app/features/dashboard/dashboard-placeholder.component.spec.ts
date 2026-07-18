import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardPlaceholderComponent } from './dashboard-placeholder.component';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { LiveActivitySocketService } from '../../core/api/live-activity-socket.service';
import { Subject } from 'rxjs';

describe('DashboardPlaceholderComponent', () => {
  let fixture: ComponentFixture<DashboardPlaceholderComponent>;
  let snapshotSubject: Subject<unknown>;
  let connectedSubject: Subject<boolean>;

  beforeEach(async () => {
    snapshotSubject = new Subject();
    connectedSubject = new Subject();

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
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('deve criar o dashboard', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();
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
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [{ id: '1', discordId: 'd-1', displayName: 'Dev Test', username: 'dev' }] });
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

  it('exibe empty state confiável com membros e zero alertas', () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();

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
        trackedMembersCount: 1,
        weeklyAverageHours: 0,
        dailyCollaboration: [],
        heatmap: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({
      members: [{ id: '1', discordId: 'd-1', displayName: 'Ana', username: 'ana' }],
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance.showTrustedEmptyState).toBeTrue();
    expect(fixture.componentInstance.healthyEmptyCopy.body).toContain('calendário/PTO');
    expect(fixture.componentInstance.healthyEmptyCopy.body.toLowerCase()).not.toContain('produtividade');
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('[data-testid="trusted-empty-state"]') as HTMLElement | null;
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain('calendário/PTO');
    httpMock.verify();
  });

  it('exibe CTA único para sincronizar quando não há membros', () => {
    localStorage.setItem('syntra.guildId', 'guild-1');
    const httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/weekly').flush({ report: { entries: [] } });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/intraday').flush({
      report: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        elapsedWorkPercent: 10,
        elapsedWorkSeconds: 900,
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
    fixture.detectChanges();

    expect(fixture.componentInstance.showSyncMembersEmptyState).toBeTrue();
    const syncEmpty = fixture.nativeElement.querySelector('[data-testid="sync-members-empty"]') as HTMLElement;
    expect(syncEmpty.textContent).toContain('Sincronizar membros');
    httpMock.verify();
  });
});
