import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { GamificationSettingsComponent } from './gamification-settings.component';

describe('GamificationSettingsComponent', () => {
  let fixture: ComponentFixture<GamificationSettingsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [GamificationSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GamificationSettingsComponent);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor Teste', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/gamification').flush({
      settings: {
        enabled: true,
        ranking: { enabled: true },
        badges: { enabled: true },
        streaks: { enabled: true },
      },
      planFeatures: { gamification: true, ranking: true },
      plan: { name: 'Team', slug: 'team' },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  it('renderiza os toggles principais de gamificação', () => {
    const content = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(content).toContain('gamificação habilitada');
    expect(content).toContain('ranking habilitado');
    expect(content).toContain('badges habilitados');
    expect(content).toContain('streaks habilitadas');
  });
});
