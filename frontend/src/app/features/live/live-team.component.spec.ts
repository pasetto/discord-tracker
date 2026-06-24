import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { LiveTeamComponent } from './live-team.component';
import { AuthService } from '../../core/auth/auth.service';
import { LiveActivitySocketService } from '../../core/api/live-activity-socket.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

describe('LiveTeamComponent', () => {
  let fixture: ComponentFixture<LiveTeamComponent>;

  beforeEach(async () => {
    localStorage.setItem(
      'syntra.auth.user',
      JSON.stringify({ id: 'u1', email: 'test@test.com', displayName: 'Teste' }),
    );
    localStorage.setItem('syntra.auth.organization', JSON.stringify({ id: 'org-1', name: 'Org', slug: 'org' }));
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.auth.token', 'token-test');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [LiveTeamComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
        TenantContextService,
        {
          provide: LiveActivitySocketService,
          useValue: {
            snapshot$: new Subject().asObservable(),
            transition$: new Subject().asObservable(),
            error$: new Subject().asObservable(),
            connected$: new Subject<boolean>().asObservable(),
            connect: jasmine.createSpy('connect'),
            disconnect: jasmine.createSpy('disconnect'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LiveTeamComponent);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('deve criar o painel de time ao vivo', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'eCondos', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/absences/active').flush({ absences: [] });
    expect(fixture.componentInstance).toBeTruthy();
    httpMock.verify();
  });
});
