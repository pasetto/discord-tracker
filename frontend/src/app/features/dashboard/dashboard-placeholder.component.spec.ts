import { provideHttpClient } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';

import { Subject } from 'rxjs';

import { DashboardPlaceholderComponent } from './dashboard-placeholder.component';

import { AuthService } from '../../core/auth/auth.service';

import { LiveActivitySocketService } from '../../core/api/live-activity-socket.service';

import { TenantContextService } from '../../core/tenant/tenant-context.service';



describe('DashboardPlaceholderComponent', () => {

  const snapshotSubject = new Subject<{

    generatedAt: string;

    guildId: string;

    guildName: string;

    activeCount: number;

    activeMembers: unknown[];

    onlineRanking: unknown[];

    recentTransitions: unknown[];

  }>();



  beforeEach(async () => {

    localStorage.setItem(

      'syntra.auth.user',

      JSON.stringify({ id: 'u1', email: 'test@test.com', displayName: 'Teste' }),

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

            error$: new Subject().asObservable(),

            connected$: new Subject<boolean>().asObservable(),

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

    const fixture = TestBed.createComponent(DashboardPlaceholderComponent);

    fixture.detectChanges();

    const statusReq = httpMock.expectOne('/api/v1/org/org-1/discord/status');

    statusReq.flush({ botConnected: false, activeConnection: null });

    expect(fixture.componentInstance).toBeTruthy();

    httpMock.verify();

  });



  it('aplica snapshot via WebSocket quando guild está configurada', () => {

    localStorage.setItem('syntra.guildId', 'guild-1');

    const httpMock = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(DashboardPlaceholderComponent);

    fixture.detectChanges();



    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({

      botConnected: true,

      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },

    });

    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/inactivity/intraday').flush({
      report: {
        generatedAt: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        elapsedWorkPercent: 40,
        elapsedWorkSeconds: 3600,
        totalWorkSeconds: 32400,
        isBusinessDay: true,
        isWithinWorkHours: true,
        settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
        concernEntries: [],
      },
    });



    snapshotSubject.next({

      generatedAt: new Date().toISOString(),

      guildId: 'guild-1',

      guildName: 'eCondos',

      activeCount: 1,

      activeMembers: [

        {

          discordId: '1',

          displayName: 'Ana',

          status: 'ONLINE',

          voiceChannelId: 'v1',

          voiceChannelName: 'Geral',

          onlineSeconds: 3600,

          onlineSince: new Date().toISOString(),

          collaborationActiveSeconds: 1800,

          inactiveSeconds: 1800,

          isCollaborationActive: true,

          inIgnoredChannel: false,

          voiceSessionType: 'VOICE',

          channelsVisitedToday: ['Geral'],

        },

      ],

      onlineRanking: [],

      recentTransitions: [],

    });



    expect(fixture.componentInstance.activeMembers.length).toBe(1);

    httpMock.verify();

  });

});

