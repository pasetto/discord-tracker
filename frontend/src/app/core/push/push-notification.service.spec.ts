import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PushNotificationService);
  });

  it('ignora enable quando organizationId está vazio', async () => {
    await expectAsync(service.enableInactivityPushNotifications('')).toBeResolved();
  });

  it('ignora disable quando organizationId está vazio', async () => {
    await expectAsync(service.disableInactivityPushNotifications('')).toBeResolved();
  });

  it('retorna failed quando Notification API está ausente', async () => {
    const originalNotification = (window as unknown as { Notification?: typeof Notification }).Notification;
    delete (window as unknown as { Notification?: typeof Notification }).Notification;

    await expectAsync(service.getInactivityPushStatus()).toBeResolvedTo('failed');

    (window as unknown as { Notification?: typeof Notification }).Notification = originalNotification;
  });
});
