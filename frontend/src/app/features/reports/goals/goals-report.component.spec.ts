import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { GoalsReportComponent } from './goals-report.component';

describe('GoalsReportComponent', () => {
  let fixture: ComponentFixture<GoalsReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalsReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalsReportComponent);
    fixture.detectChanges();
  });

  it('renderiza título de relatório de metas', () => {
    const textContent = (fixture.nativeElement.textContent as string).toLowerCase();

    expect(textContent).toContain('relatório de metas');
  });
});
