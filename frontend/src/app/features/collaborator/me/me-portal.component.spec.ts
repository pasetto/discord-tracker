import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MePortalComponent } from './me-portal.component';

describe('MePortalComponent', () => {
  let fixture: ComponentFixture<MePortalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MePortalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MePortalComponent);
    fixture.detectChanges();
  });

  it('renderiza transparência de sinais medidos sem conteúdo de mensagens', () => {
    const content = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(content).toContain('voz');
    expect(content).toContain('presença');
    expect(content).toContain('texto');
    expect(content).toContain('sem conteúdo');
  });

  it('renderiza link para exportação de dados LGPD', () => {
    const anchors = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    const hrefs = anchors.map((anchor) => anchor.getAttribute('href'));

    expect(hrefs).toContain('/api/v1/me/data-export');
  });
});
