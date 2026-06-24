import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { GoalsReportComponent } from './goals-report.component';

describe('GoalsReportComponent', () => {
  let fixture: ComponentFixture<GoalsReportComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [GoalsReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GoalsReportComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/reports/goals').flush({
      report: { periodStart: '', periodEnd: '', generatedAt: '', entries: [] },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('renderiza relatório de metas com estado vazio', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(textContent).toContain('atualizar relatório');
    expect(textContent).toContain('nenhuma meta individual configurada');
    expect(textContent).toContain('configurar metas individuais');
  });
});
