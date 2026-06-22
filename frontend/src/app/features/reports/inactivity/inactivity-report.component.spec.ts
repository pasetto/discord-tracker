import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InactivityReportComponent } from './inactivity-report.component';

describe('InactivityReportComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InactivityReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('deve criar o relatório de inatividade', () => {
    const fixture = TestBed.createComponent(InactivityReportComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
