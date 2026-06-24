import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AbsencesReportComponent } from './absences-report.component';

describe('AbsencesReportComponent', () => {
  let fixture: ComponentFixture<AbsencesReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [AbsencesReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AbsencesReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renderiza página de ausências ativas', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(textContent).toContain('ausência(s) ativa(s)');
    expect(textContent).toContain('cadastrar pto');
    expect(textContent).toContain('cadastrar ausência planejada');
  });

  it('exibe ausências retornadas pela API', () => {
    fixture.componentInstance.absences = [
      {
        _id: 'a1',
        trackedUserId: 'm1',
        discordId: '123',
        type: 'vacation',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        status: 'active',
      },
    ];
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent as string;
    expect(textContent).toContain('123');
  });
});
