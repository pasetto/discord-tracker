import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { InactivitySettingsComponent } from './inactivity-settings.component';

describe('InactivitySettingsComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InactivitySettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            hasGuild: true,
            guildName: 'Servidor Teste',
            getGuildApiBaseUrl: () => '/api/v1/org/org-1/guilds/guild-1',
            refresh: () => of(undefined),
          },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve criar e carregar configurações de inatividade', () => {
    const fixture = TestBed.createComponent(InactivitySettingsComponent);
    fixture.detectChanges();

    const request = httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/inactivity-settings');
    expect(request.request.method).toBe('GET');
    request.flush({
      settings: {
        guildId: 'guild-1',
        inactiveAfterBusinessDays: 2,
        zeroVoiceCollaborationDays: 3,
        lateStartThresholdPercent: 30,
        minCollaborationPercentOfElapsed: 20,
        notifyManagerPush: true,
        notifyManagerEmail: false,
        notifyIntradayPush: true,
      },
    });

    fixture.detectChanges();
    expect(fixture.componentInstance.settings?.lateStartThresholdPercent).toBe(30);
  });
});
