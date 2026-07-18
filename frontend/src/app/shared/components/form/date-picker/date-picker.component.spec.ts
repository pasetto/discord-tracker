import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DatePickerComponent } from './date-picker.component';

/**
 * Host mínimo para validar [(ngModel)] no datepicker de produto.
 */
@Component({
  standalone: true,
  imports: [FormsModule, DatePickerComponent],
  template: `<app-date-picker id="spec-date" [(ngModel)]="value" placeholder="dd/mm/aaaa" />`,
})
class DatePickerHostComponent {
  value = '';
}

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<DatePickerHostComponent>;
  let host: DatePickerHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatePickerHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DatePickerHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('não usa input type=date nativo', () => {
    const nativeDates = fixture.nativeElement.querySelectorAll('input[type="date"]');
    expect(nativeDates.length).toBe(0);
  });

  it('propaga valor Y-m-d via ngModel quando o flatpickr seleciona uma data', async () => {
    const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
      .componentInstance as DatePickerComponent;

    picker.writeValueFromPicker('2026-07-18');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.value).toBe('2026-07-18');
  });

  it('aplica writeValue do ngModel no flatpickr (Y-m-d)', async () => {
    host.value = '2026-01-15';
    fixture.detectChanges();
    await fixture.whenStable();

    const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
      .componentInstance as DatePickerComponent;

    expect(picker.getApiValue()).toBe('2026-01-15');
  });
});
