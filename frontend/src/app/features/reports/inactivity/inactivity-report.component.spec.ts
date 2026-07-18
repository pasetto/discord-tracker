import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InactivityReportComponent } from './inactivity-report.component';

describe('InactivityReportComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [InactivityReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('deve criar o relatório de inatividade', () => {
    const fixture = TestBed.createComponent(InactivityReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/categories').flush({ categories: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne((request) =>
      request.url.includes('/reports/inactivity/weekly') && request.params.get('preset') === 'this_week',
    ).flush({
      report: {
        periodStart: '2026-06-18',
        periodEnd: '2026-06-24',
        generatedAt: '2026-06-24T12:00:00.000Z',
        entries: [],
        plannedAbsenceEntries: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ordena entradas de alerta por coluna selecionada', () => {
    const fixture = TestBed.createComponent(InactivityReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/categories').flush({ categories: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne((request) =>
      request.url.includes('/reports/inactivity/weekly') && request.params.get('preset') === 'this_week',
    ).flush({
      report: {
        periodStart: '2026-06-18',
        periodEnd: '2026-06-24',
        generatedAt: '2026-06-24T12:00:00.000Z',
        entries: [
          {
            trackedUserId: '1',
            discordId: 'a',
            displayName: 'Bruno',
            inactiveBusinessDays: 1,
            status: 'missing',
          },
          {
            trackedUserId: '2',
            discordId: 'b',
            displayName: 'Ana',
            inactiveBusinessDays: 3,
            status: 'low_voice_collaboration',
          },
        ],
        plannedAbsenceEntries: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });

    fixture.detectChanges();
    fixture.componentInstance.toggleSort('displayName');
    expect(fixture.componentInstance.sortedConcernEntries[0].displayName).toBe('Ana');
  });

  it('aplica classes de badge por status de inatividade', () => {
    const fixture = TestBed.createComponent(InactivityReportComponent);
    const component = fixture.componentInstance;

    expect(component.getStatusBadgeClass('missing')).toContain('error');
    expect(component.getStatusBadgeClass('low_voice_collaboration')).toContain('warning');
    expect(component.getStatusBadgeClass('returned')).toContain('success');
    expect(component.getStatusBadgeClass('on_planned_absence')).toContain('gray');
  });

  it('explica ausência planejada com tipo e janela', () => {
    const fixture = TestBed.createComponent(InactivityReportComponent);
    const component = fixture.componentInstance;

    expect(component.getAbsenceTypeLabel('pto')).toBe('PTO');
    expect(
      component.getPlannedAbsenceExplainLabel({
        trackedUserId: '1',
        discordId: 'd1',
        displayName: 'Ana',
        inactiveBusinessDays: 0,
        status: 'on_planned_absence',
        plannedAbsence: {
          type: 'vacation',
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-10T00:00:00.000Z',
        },
      }),
    ).toContain('Férias');
  });

  it('carrega histórico ao selecionar colaborador', () => {
    const fixture = TestBed.createComponent(InactivityReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/categories').flush({ categories: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne((request) =>
      request.url.includes('/reports/inactivity/weekly') && request.params.get('preset') === 'this_week',
    ).flush({
      report: {
        periodStart: '2026-06-18',
        periodEnd: '2026-06-24',
        generatedAt: '2026-06-24T12:00:00.000Z',
        entries: [
          {
            trackedUserId: 'user-1',
            discordId: '123',
            displayName: 'Ana',
            inactiveBusinessDays: 2,
            status: 'missing',
          },
        ],
        plannedAbsenceEntries: [],
      },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });

    fixture.componentInstance.selectMember({
      trackedUserId: 'user-1',
      discordId: '123',
      displayName: 'Ana',
      inactiveBusinessDays: 2,
      status: 'missing',
    });

    const historyReq = httpMock.expectOne(
      (req) => req.url.includes('/reports/inactivity/history') && req.params.get('trackedUserId') === 'user-1',
    );
    historyReq.flush({
      history: {
        trackedUserId: 'user-1',
        discordId: '123',
        displayName: 'Ana',
        timeline: [{ periodStart: '2026-06-18', periodEnd: '2026-06-24', generatedAt: '2026-06-24', status: 'missing', inactiveBusinessDays: 2 }],
      },
    });

    expect(fixture.componentInstance.memberHistory?.timeline.length).toBe(1);
  });
});
