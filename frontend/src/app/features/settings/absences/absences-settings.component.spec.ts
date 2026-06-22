import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AbsencesSettingsComponent } from './absences-settings.component';

describe('AbsencesSettingsComponent', () => {
  let fixture: ComponentFixture<AbsencesSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AbsencesSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AbsencesSettingsComponent);
    fixture.detectChanges();
  });

  it('renderiza seção de ausências planejadas', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(textContent).toContain('ausências planejadas');
  });
});
