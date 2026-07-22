import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SettingsHubComponent } from './settings-hub.component';

describe('SettingsHubComponent', () => {
  let fixture: ComponentFixture<SettingsHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsHubComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsHubComponent);
    fixture.detectChanges();
  });

  it('deve criar o hub de configurações', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve listar links de descoberta das settings principais', () => {
    const paths = fixture.componentInstance.items.map((item) => item.path);
    expect(paths).toEqual([
      '/app/settings/discord',
      '/app/settings/channels',
      '/app/settings/calendar',
      '/app/settings/absences',
      '/app/settings/goals',
      '/app/settings/inactivity',
      '/app/settings/team',
      '/app/settings/gamification',
    ]);
  });

  it('deve renderizar links com touch target mínimo de 44px', () => {
    const links = fixture.debugElement.queryAll(By.css('nav[aria-label="Hub de configurações"] a'));
    expect(links.length).toBe(8);
    for (const link of links) {
      expect(link.nativeElement.className).toContain('min-h-11');
      expect(link.attributes['ng-reflect-router-link'] || link.nativeElement.getAttribute('href')).toBeTruthy();
    }
  });

  it('não deve usar a palavra produtividade no hub', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.toLowerCase()).not.toContain('produtividad');
  });
});
