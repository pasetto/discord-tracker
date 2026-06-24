import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardPlaceholderComponent } from './dashboard-placeholder.component';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

describe('DashboardPlaceholderComponent', () => {
  let fixture: ComponentFixture<DashboardPlaceholderComponent>;

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

  it('carrega alertas de inatividade quando guild está configurada', () => {
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

    expect(fixture.componentInstance.weeklyConcernCount).toBe(1);
    httpMock.verify();
  });

  it('aplica classes de badge intradiário', () => {
    fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    expect(fixture.componentInstance.getIntradayStatusBadgeClass('not_started')).toContain('error');
    expect(fixture.componentInstance.getIntradayStatusBadgeClass('low_collaboration_today')).toContain('warning');
  });
});
