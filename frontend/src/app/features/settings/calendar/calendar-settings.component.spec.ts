import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CalendarSettingsComponent } from './calendar-settings.component';

describe('CalendarSettingsComponent', () => {
  let fixture: ComponentFixture<CalendarSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarSettingsComponent);
    fixture.detectChanges();
  });

  it('renderiza cabeçalho de configurações de calendário', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(textContent).toContain('configurações de calendário');
  });

  it('não usa input type=date nativo para feriados', () => {
    const nativeDates = fixture.nativeElement.querySelectorAll('input[type="date"]');
    expect(nativeDates.length).toBe(0);
  });
});
