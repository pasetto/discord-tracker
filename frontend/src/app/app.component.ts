import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { PushNotificationService } from './core/push/push-notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'Syntra | Colaboracao no Discord';

  constructor(
    private readonly authService: AuthService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Habilita inscrição de Web Push ao iniciar app autenticado.
   * @returns {void} Não retorna valor.
   */
  ngOnInit(): void {
    const organizationId = localStorage.getItem('syntra.orgId') ?? '';
    if (!this.authService.hasToken() || !organizationId) {
      return;
    }

    void this.pushNotificationService.enableInactivityPushNotifications(organizationId);
  }
}
