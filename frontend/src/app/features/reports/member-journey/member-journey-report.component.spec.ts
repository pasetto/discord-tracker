import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MemberJourneyReportComponent } from './member-journey-report.component';

/** Resumo padrão usado como fixture nos testes. */
const JOURNEY_SUMMARY = {
  totalDays: 3,
  daysWithActivity: 2,
  avgEntryMinute: 615,
  avgExitMinute: 1110,
  avgEntryLabel: '10:15',
  avgExitLabel: '18:30',
  avgSpanHours: 8.25,
  voiceEntryCount: 0,
  collaborationEntryLabels: [] as string[],
  totalCollaborationMinutes: 0,
  avgDailyCollaborationHours: 0,
};

/** Relatório de jornada usado como fixture nos testes. */
const JOURNEY_REPORT = {
  trackedUserId: 'tu-1',
  discordId: 'd-1',
  displayName: 'Alpha',
  timezone: 'America/Sao_Paulo',
  signal: 'presence' as const,
  periodStart: '2026-06-22T03:00:00.000Z',
  periodEnd: '2026-06-25T02:59:59.999Z',
  generatedAt: '2026-06-25T12:00:00.000Z',
  days: [
    {
      date: '2026-06-22',
      weekday: 1,
      hasActivity: true,
      entryMinute: 570,
      exitMinute: 1080,
      entryLabel: '09:30',
      exitLabel: '18:00',
      spanMinutes: 510,
      sessions: [],
    },
    {
      date: '2026-06-23',
      weekday: 2,
      hasActivity: false,
      entryMinute: null,
      exitMinute: null,
      entryLabel: null,
      exitLabel: null,
      spanMinutes: 0,
      sessions: [],
    },
    {
      date: '2026-06-24',
      weekday: 3,
      hasActivity: true,
      entryMinute: 660,
      exitMinute: 1140,
      entryLabel: '11:00',
      exitLabel: '19:00',
      spanMinutes: 480,
      sessions: [],
    },
  ],
  weekdayPatterns: [
    {
      weekday: 1,
      label: 'Segunda',
      sampleDays: 1,
      avgEntryMinute: 570,
      avgExitMinute: 1080,
      avgEntryLabel: '09:30',
      avgExitLabel: '18:00',
      earliestEntryMinute: 570,
      latestEntryMinute: 570,
      entrySpreadMinutes: 0,
    },
    {
      weekday: 3,
      label: 'Quarta',
      sampleDays: 1,
      avgEntryMinute: 660,
      avgExitMinute: 1140,
      avgEntryLabel: '11:00',
      avgExitLabel: '19:00',
      earliestEntryMinute: 660,
      latestEntryMinute: 660,
      entrySpreadMinutes: 0,
    },
  ],
  summary: JOURNEY_SUMMARY,
};

/** Relatório de voz com duas sessões no mesmo dia. */
const VOICE_JOURNEY_REPORT = {
  ...JOURNEY_REPORT,
  signal: 'voice' as const,
  days: [
    {
      date: '2026-06-22',
      weekday: 1,
      hasActivity: true,
      entryMinute: 570,
      exitMinute: 1080,
      entryLabel: '09:30',
      exitLabel: '18:00',
      spanMinutes: 510,
      sessions: [
        {
          entryMinute: 570,
          exitMinute: 720,
          entryLabel: '09:30',
          exitLabel: '12:00',
          channelName: 'Geral',
          isIgnoredChannel: false,
          spanMinutes: 150,
        },
        {
          entryMinute: 760,
          exitMinute: 1080,
          entryLabel: '12:40',
          exitLabel: '18:00',
          channelName: 'Dev',
          isIgnoredChannel: false,
          spanMinutes: 320,
        },
      ],
    },
    {
      date: '2026-06-23',
      weekday: 2,
      hasActivity: false,
      entryMinute: null,
      exitMinute: null,
      entryLabel: null,
      exitLabel: null,
      spanMinutes: 0,
      sessions: [],
    },
    {
      date: '2026-06-24',
      weekday: 3,
      hasActivity: false,
      entryMinute: null,
      exitMinute: null,
      entryLabel: null,
      exitLabel: null,
      spanMinutes: 0,
      sessions: [],
    },
  ],
  summary: {
    ...JOURNEY_SUMMARY,
    daysWithActivity: 1,
    voiceEntryCount: 2,
    collaborationEntryLabels: ['09:30', '12:40'],
    totalCollaborationMinutes: 470,
    avgDailyCollaborationHours: 7.83,
  },
};

describe('MemberJourneyReportComponent', () => {
  let fixture: ComponentFixture<MemberJourneyReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [MemberJourneyReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MemberJourneyReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({
      members: [{ id: 'tu-1', discordId: 'd-1', displayName: 'Alpha', username: 'alpha' }],
    });
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('seleciona o primeiro membro e carrega a jornada com sinal de voz por padrão', () => {
    const request = httpMock.expectOne(
      (req) =>
        req.url.includes('/reports/member-journey') &&
        req.params.get('trackedUserId') === 'tu-1' &&
        req.params.get('signal') === 'voice' &&
        req.params.get('preset') === 'last_7_days',
    );
    request.flush({ report: VOICE_JOURNEY_REPORT });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Entradas em colaboração');
    expect(text).toContain('09:30, 12:40');
    expect(fixture.componentInstance.signal).toBe('voice');
  });

  it('constrói a série do gráfico apenas com dias que têm atividade (presença)', () => {
    httpMock
      .expectOne((req) => req.url.includes('/reports/member-journey') && req.params.get('signal') === 'voice')
      .flush({ report: VOICE_JOURNEY_REPORT });
    fixture.detectChanges();

    fixture.componentInstance.onSignalChange('presence');

    httpMock
      .expectOne((req) => req.url.includes('/reports/member-journey') && req.params.get('signal') === 'presence')
      .flush({ report: JOURNEY_REPORT });
    fixture.detectChanges();

    const series = fixture.componentInstance.chartSeries;
    expect(series).toHaveSize(1);
    const data = series[0].data as Array<{ y: number[] }>;
    expect(data).toHaveSize(2);
    expect(data[0].y).toEqual([570, 1080]);
    expect(data[1].y).toEqual([660, 1140]);
  });

  it('monta uma barra por sessão de voz no carregamento inicial', () => {
    httpMock
      .expectOne((req) => req.url.includes('/reports/member-journey') && req.params.get('signal') === 'voice')
      .flush({ report: VOICE_JOURNEY_REPORT });
    fixture.detectChanges();

    expect(fixture.componentInstance.signal).toBe('voice');

    const data = fixture.componentInstance.chartSeries[0].data as Array<{ y: number[]; fillColor: string }>;
    expect(data).toHaveSize(2);
    expect(data[0].y).toEqual([570, 720]);
    expect(data[1].y).toEqual([760, 1080]);
    expect(data[0].fillColor).toBe('#465fff');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Entradas em colaboração');
    expect(text).toContain('09:30, 12:40');
  });

  it('envia includeIgnoredChannels ao marcar o checkbox em modo voz', () => {
    httpMock
      .expectOne((req) => req.url.includes('/reports/member-journey') && req.params.get('signal') === 'voice')
      .flush({ report: VOICE_JOURNEY_REPORT });
    fixture.detectChanges();
    fixture.componentInstance.includeIgnoredChannels = true;
    fixture.componentInstance.onIncludeIgnoredChange();

    const ignoredRequest = httpMock.expectOne(
      (req) =>
        req.url.includes('/reports/member-journey') &&
        req.params.get('includeIgnoredChannels') === 'true',
    );
    ignoredRequest.flush({ report: VOICE_JOURNEY_REPORT });
    fixture.detectChanges();

    expect(fixture.componentInstance.includeIgnoredChannels).toBeTrue();
  });
});
