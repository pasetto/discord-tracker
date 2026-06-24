import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TeamSettingsComponent } from './team-settings.component';

describe('TeamSettingsComponent', () => {
  let fixture: ComponentFixture<TeamSettingsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');

    await TestBed.configureTestingModule({
      imports: [TeamSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamSettingsComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: false,
      activeConnection: null,
    });
    httpMock.expectOne('/api/v1/org/org-1/team/invite-code').flush({ inviteCode: 'AB12CD34' });
    httpMock.expectOne('/api/v1/org/org-1/team/members').flush({ members: [] });
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renderiza código de convite da organização', () => {
    const content = (fixture.nativeElement.textContent as string).toUpperCase();
    expect(content).toContain('AB12CD34');
    expect(content).toContain('TIME E CONVITES');
  });
});
