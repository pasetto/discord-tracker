import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ChannelsSettingsComponent } from './channels-settings.component';

const emptyRules = {
  ignored: [],
  afk: [],
  lunch: [],
  productiveVoice: [],
  productiveText: [],
  ignoredText: [],
};

describe('ChannelsSettingsComponent', () => {
  let fixture: ComponentFixture<ChannelsSettingsComponent>;
  let component: ChannelsSettingsComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.setItem('syntra.orgId', 'org-1');
    localStorage.setItem('syntra.guildId', 'guild-1');

    await TestBed.configureTestingModule({
      imports: [ChannelsSettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChannelsSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: true,
      activeConnection: { guildId: 'guild-1', guildName: 'Servidor', isMonitoringEnabled: true },
    });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/channels/discord').flush({ channels: [] });
    httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/channels').flush({ rules: emptyRules });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('deve criar o componente de canais', () => {
    expect(component).toBeTruthy();
  });

  it('deve ocultar cabeçalho quando estiver embutido', () => {
    fixture.componentInstance.embedded = true;
    fixture.detectChanges();

    const header = fixture.debugElement.query(By.css('header'));
    expect(header).toBeNull();
  });

  it('carrega canais de voz e texto com regras salvas', () => {
    component.loadChannelData();

    const channelsReq = httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/channels/discord');
    const rulesReq = httpMock.expectOne('/api/v1/org/org-1/guilds/guild-1/channels');

    channelsReq.flush({
      channels: [
        { channelId: 'v1', channelName: 'Reunião', channelType: 'voice' },
        { channelId: 't1', channelName: 'geral', channelType: 'text' },
      ],
    });

    rulesReq.flush({
      rules: {
        ...emptyRules,
        productiveVoice: [{ channelId: 'v1', channelName: 'Reunião', channelType: 'voice' }],
      },
    });

    expect(component.voiceChannels.length).toBe(1);
    expect(component.textChannels.length).toBe(1);
    expect(component.getSelection('v1').productiveVoice).toBe(true);
    expect(component.errorMessage).toBe('');
  });
});
