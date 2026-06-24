import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MeDataService } from './me-data.service';

describe('MeDataService', () => {
  let service: MeDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MeDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('carrega resumo de colaboração do colaborador autenticado', () => {
    service.loadCollaborationSummary().subscribe((response) => {
      expect(response.summary.discordId).toBe('123');
    });

    const req = httpMock.expectOne('/api/v1/me/collaboration');
    expect(req.request.method).toBe('GET');
    req.flush({
      summary: {
        organizationId: 'org-1',
        discordId: '123',
        trackedProfilesCount: 1,
        guildIds: ['guild-1'],
        lastPresenceAt: null,
        lastTextMetadataAt: null,
        signals: {
          voiceSessions: { totalCollaborationSeconds: 0, totalCollaborationHours: 0 },
          presence: { totalTrackedSeconds: 0, totalTrackedHours: 0 },
          text: { totalMetadataEvents: 0, contentStored: false },
        },
      },
    });
  });

  it('carrega ausências planejadas do colaborador', () => {
    service.loadAbsences().subscribe((response) => {
      expect(response.absences.length).toBe(1);
    });

    const req = httpMock.expectOne('/api/v1/me/absences');
    req.flush({ absences: [{ id: 'a1', guildId: 'guild-1', type: 'vacation', status: 'active', startDate: '', endDate: '' }] });
  });

  it('carrega export LGPD dos dados do colaborador', () => {
    service.loadDataExport().subscribe((response) => {
      expect(response.exportData['kind']).toBe('lgpd');
    });

    const req = httpMock.expectOne('/api/v1/me/data-export');
    req.flush({ exportData: { kind: 'lgpd' } });
  });

  it('carrega gamificação com guildId opcional', () => {
    service.loadGamification('guild-1').subscribe((response) => {
      expect(response.insights.discordId).toBe('123');
    });

    const req = httpMock.expectOne('/api/v1/me/gamification?guildId=guild-1');
    req.flush({
      insights: {
        discordId: '123',
        displayName: 'Ana',
        badgesEnabled: true,
        streaksEnabled: true,
        badges: [],
        streak: { enabled: true, currentDays: 0, minHoursPerDay: 1, lastQualifiedDate: null },
      },
    });
  });

  it('vincula perfil Discord do colaborador autenticado', () => {
    service.linkDiscordProfile('discord-1').subscribe((response) => {
      expect(response.discordId).toBe('discord-1');
    });

    const req = httpMock.expectOne('/api/v1/me/discord-link');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ discordId: 'discord-1' });
    req.flush({ accessToken: 'token', discordId: 'discord-1', displayName: 'Ana' });
  });
});
