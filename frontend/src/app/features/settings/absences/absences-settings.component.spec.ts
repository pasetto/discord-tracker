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
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renderiza seção de ausências planejadas', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(textContent).toContain('ausências planejadas');
    expect(textContent).toContain('sincronizar membros');
    expect(textContent).not.toContain('trackeduserid');
  });
});
