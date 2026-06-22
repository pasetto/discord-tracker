import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GoalsSettingsComponent } from './goals-settings.component';

describe('GoalsSettingsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalsSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('deve criar o componente de metas', () => {
    const fixture = TestBed.createComponent(GoalsSettingsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
