import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChannelsSettingsComponent } from './channels-settings.component';

describe('ChannelsSettingsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelsSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('deve criar o componente de canais', () => {
    const fixture = TestBed.createComponent(ChannelsSettingsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
