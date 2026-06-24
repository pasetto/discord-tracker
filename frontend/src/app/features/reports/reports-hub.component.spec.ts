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

  it('deve expor três abas de relatório', () => {
    expect(fixture.componentInstance.tabs.length).toBe(3);
    expect(fixture.componentInstance.tabs[0].label).toBe('Quem sumiu');
  });
});
