import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CategoriesSettingsComponent } from './categories-settings.component';

describe('CategoriesSettingsComponent', () => {
  let fixture: ComponentFixture<CategoriesSettingsComponent>;
  let component: CategoriesSettingsComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [CategoriesSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CategoriesSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/categories').flush({ categories: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users').flush({ members: [] });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('exibe contadores de desativação e reativação após sync', () => {
    component.syncMembers();

    const syncRequest = httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/tracked-users/sync');
    expect(syncRequest.request.method).toBe('POST');
    syncRequest.flush({
      syncedCount: 10,
      deactivatedCount: 2,
      reactivatedCount: 1,
      members: [],
    });

    expect(component.successMessage).toContain('10 sincronizados');
    expect(component.successMessage).toContain('2 removidos do rastreamento');
    expect(component.successMessage).toContain('1 reativados');
  });
});
