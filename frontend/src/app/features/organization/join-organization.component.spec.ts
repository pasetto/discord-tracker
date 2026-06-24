import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { JoinOrganizationComponent } from './join-organization.component';

describe('JoinOrganizationComponent', () => {
  let fixture: ComponentFixture<JoinOrganizationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinOrganizationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'app/dashboard', redirectTo: '' }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinOrganizationComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('valida código de convite e exibe organização', () => {
    fixture.componentInstance.inviteCode = 'AB12CD34';
    fixture.componentInstance.previewInvite();

    const req = httpMock.expectOne('/api/v1/public/invite-codes/AB12CD34');
    req.flush({
      organizationId: 'org-2',
      organizationName: 'Acme Corp',
      inviteCode: 'AB12CD34',
    });
    fixture.detectChanges();

    expect((fixture.nativeElement.textContent as string)).toContain('Acme Corp');
  });
});
