import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DashboardPlaceholderComponent } from './dashboard-placeholder.component';

describe('DashboardPlaceholderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPlaceholderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('deve criar o dashboard', () => {
    const fixture = TestBed.createComponent(DashboardPlaceholderComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
