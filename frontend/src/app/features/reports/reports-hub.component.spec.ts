import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsHubComponent } from './reports-hub.component';

describe('ReportsHubComponent', () => {
  let fixture: ComponentFixture<ReportsHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsHubComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsHubComponent);
    fixture.detectChanges();
  });

  it('deve criar o hub de relatórios', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve expor abas de relatório incluindo gamificação', () => {
    expect(fixture.componentInstance.tabs.length).toBe(5);
    expect(fixture.componentInstance.tabs[0].label).toBe('Quem sumiu');
    expect(fixture.componentInstance.tabs.map((tab) => tab.path)).toEqual([
      'inactivity',
      'goals',
      'absences',
      'ranking',
      'achievements',
    ]);
  });
});
