import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AbsencesSettingsComponent } from './absences-settings.component';

describe('AbsencesSettingsComponent', () => {
  let fixture: ComponentFixture<AbsencesSettingsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [AbsencesSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AbsencesSettingsComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences').flush({ absences: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absence-requests?status=pending_approval').flush({ requests: [] });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renderiza seção de cadastro de PTO e ausências', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(textContent).toContain('cadastrar pto e ausências');
    expect(textContent).toContain('solicitações pendentes');
    expect(textContent).toContain('sincronizar membros');
    expect(textContent).toContain('lista de ausências');
    expect(textContent).not.toContain('trackeduserid');
  });

  it('usa datepicker em vez de input type=date', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[type="date"]').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-date-picker').length).toBeGreaterThan(0);
  });
});
