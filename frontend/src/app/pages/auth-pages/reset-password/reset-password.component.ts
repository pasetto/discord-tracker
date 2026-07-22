import { Component } from '@angular/core';
import { AuthPageLayoutComponent } from '../../../shared/layout/auth-page-layout/auth-page-layout.component';
import { ResetPasswordFormComponent } from '../../../shared/components/auth/reset-password-form/reset-password-form.component';

/**
 * Página pública para concluir reset de senha.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [AuthPageLayoutComponent, ResetPasswordFormComponent],
  template: `
    <app-auth-page-layout>
      <app-reset-password-form class="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar" />
    </app-auth-page-layout>
  `,
})
export class ResetPasswordComponent {}
