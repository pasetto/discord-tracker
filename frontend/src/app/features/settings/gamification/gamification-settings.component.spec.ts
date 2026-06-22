import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { GamificationSettingsComponent } from './gamification-settings.component';

describe('GamificationSettingsComponent', () => {
  let fixture: ComponentFixture<GamificationSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamificationSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GamificationSettingsComponent);
    fixture.detectChanges();
  });

  it('renderiza os toggles principais de gamificação', () => {
    const content = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(content).toContain('gamificação habilitada');
    expect(content).toContain('ranking habilitado');
    expect(content).toContain('badges habilitados');
    expect(content).toContain('streaks habilitadas');
  });
});
