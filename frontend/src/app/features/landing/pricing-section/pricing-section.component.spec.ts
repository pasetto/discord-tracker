import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PricingSectionComponent } from './pricing-section.component';

describe('PricingSectionComponent', () => {
  let fixture: ComponentFixture<PricingSectionComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingSectionComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PricingSectionComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renderiza planos da API incluindo Business', () => {
    const request = httpMock.expectOne('/api/v1/pricing');
    request.flush({
      plans: [
        {
          slug: 'starter',
          name: 'Starter',
          description: 'Entrada',
          priceCents: 7900,
          currency: 'BRL',
          billingInterval: 'month',
          limits: { maxGuilds: 1, maxTrackedMembers: 25, dataRetentionDays: 90 },
          features: {},
          trialDays: 7,
          sortOrder: 1,
        },
        {
          slug: 'business',
          name: 'Business',
          description: 'Escala',
          priceCents: 29900,
          currency: 'BRL',
          billingInterval: 'month',
          limits: { maxGuilds: 3, maxTrackedMembers: 200, dataRetentionDays: 365 },
          features: { webhooks: true, apiAccess: true, exportCsv: true },
          trialDays: 7,
          sortOrder: 3,
        },
      ],
    });

    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Business');
    expect(content).toContain('R$ 299');
    expect(content).toContain('Webhooks de integração');
    expect(content).toContain('Criar conta');
    expect(content).not.toContain('Começar agora');
  });

  it('mostra mensagem de erro e mantém fallback quando a API falha', () => {
    const request = httpMock.expectOne('/api/v1/pricing');
    request.flush('erro', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toMatch(/não deu para carregar os planos/i);
    expect(fixture.nativeElement.querySelector('[data-testid="landing-pricing-error"]')).toBeTruthy();
    expect(content).toContain('Criar conta');
  });
});
