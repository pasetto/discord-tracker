import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ChannelsSettingsComponent } from './channels-settings.component';

describe('ChannelsSettingsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelsSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('deve criar o componente de canais', () => {
    const fixture = TestBed.createComponent(ChannelsSettingsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve ocultar cabeçalho quando estiver embutido', () => {
    const fixture = TestBed.createComponent(ChannelsSettingsComponent);
    fixture.componentInstance.embedded = true;
    fixture.detectChanges();

    const header = fixture.debugElement.query(By.css('header'));
    expect(header).toBeNull();
  });
});
