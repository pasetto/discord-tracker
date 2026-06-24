import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CaseStudyPageComponent } from './case-study-page.component';

describe('CaseStudyPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaseStudyPageComponent],
      providers: [
        provideRouter([
          { path: 'case-studies', component: CaseStudyPageComponent },
          { path: 'case-studies/:slug', component: CaseStudyPageComponent },
        ]),
      ],
    }).compileComponents();
  });

  it('lista cases na rota índice', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/case-studies', CaseStudyPageComponent);

    const content = harness.fixture.nativeElement.textContent as string;
    expect(content).toContain('Cases de times no Discord');
    expect(content).toContain('Dev shop remota');
  });

  it('exibe detalhe do case por slug', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/case-studies/dev-shop-remota', CaseStudyPageComponent);

    const content = harness.fixture.nativeElement.textContent as string;
    expect(content).toContain('Desafio');
    expect(content).toContain('Finalmente sabemos quem sumiu');
  });
});
