import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MobileBottomNavComponent } from './mobile-bottom-nav.component';

describe('MobileBottomNavComponent', () => {
  let fixture: ComponentFixture<MobileBottomNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileBottomNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileBottomNavComponent);
    fixture.detectChanges();
  });

  it('deve criar a navegação mobile', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve alinhar rotas com a sidebar desktop', () => {
    const labels = fixture.componentInstance.items.map((item) => item.label);
    expect(labels).toEqual(['Início', 'Ao vivo', 'Relatórios', 'Config']);
  });

  it('deve apontar Config para o hub de settings (não Discord)', () => {
    const configItem = fixture.componentInstance.items.find((item) => item.label === 'Config');
    expect(configItem?.route).toBe('/app/settings');
    expect(configItem?.matchPrefix).toBe('/app/settings');
  });

  it('deve destacar relatórios para qualquer rota do hub', () => {
    fixture.componentInstance.currentUrl = '/app/reports/absences';

    const reportsItem = fixture.componentInstance.items[2];
    expect(fixture.componentInstance.isActive(reportsItem)).toBeTrue();
  });

  it('deve destacar Config para qualquer rota de settings', () => {
    fixture.componentInstance.currentUrl = '/app/settings/calendar';

    const configItem = fixture.componentInstance.items[3];
    expect(fixture.componentInstance.isActive(configItem)).toBeTrue();
  });
});

