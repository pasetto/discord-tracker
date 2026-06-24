import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MePortalComponent } from './me-portal.component';

describe('MePortalComponent', () => {
  let fixture: ComponentFixture<MePortalComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [MePortalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MePortalComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const membersReq = httpMock.expectOne((request) => request.url.includes('/tracked-users'));
    membersReq.flush({ members: [] });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renderiza transparência de sinais medidos sem conteúdo de mensagens', () => {
    const content = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(content).toContain('voz');
    expect(content).toContain('presença');
    expect(content).toContain('texto');
    expect(content).toContain('sem conteúdo');
  });

  it('carrega resumo de colaboração via API autenticada', () => {
    const component = fixture.componentInstance;
    component.loadCollaboration();

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
          voiceSessions: { totalCollaborationSeconds: 3600, totalCollaborationHours: 1 },
          presence: { totalTrackedSeconds: 7200, totalTrackedHours: 2 },
          text: { totalMetadataEvents: 5, contentStored: false },
        },
      },
    });

    fixture.detectChanges();
    expect(component.panel.collaboration?.trackedProfilesCount).toBe(1);
    expect((fixture.nativeElement.textContent as string).toLowerCase()).toContain('resumo de colaboração');
  });

  it('exibe ação para baixar export LGPD sem link cru de API', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const labels = buttons.map((button) => button.textContent?.trim());

    expect(labels.some((label) => label?.includes('Baixar export LGPD'))).toBeTrue();
    expect(fixture.nativeElement.querySelector('a[href*="/api/v1/me/"]')).toBeNull();
  });

  it('envia solicitação de PTO pelo portal /me', () => {
    const component = fixture.componentInstance;
    component.requestForm = {
      type: 'pto',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      note: 'Viagem pessoal',
    };

    component.submitAbsenceRequest();

    const postReq = httpMock.expectOne('/api/v1/me/absence-requests');
    expect(postReq.request.method).toBe('POST');
    postReq.flush({
      request: {
        id: 'req-1',
        guildId: 'guild-1',
        type: 'pto',
        status: 'pending_approval',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
      },
    });

    const absencesReq = httpMock.expectOne('/api/v1/me/absences');
    absencesReq.flush({
      absences: [
        {
          id: 'req-1',
          guildId: 'guild-1',
          type: 'pto',
          status: 'pending_approval',
          startDate: '2026-07-01',
          endDate: '2026-07-03',
        },
      ],
    });

    expect(component.requestMessage.toLowerCase()).toContain('solicitação enviada');
  });
});
