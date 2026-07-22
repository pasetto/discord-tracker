import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { GridShapeComponent } from '../../components/common/grid-shape/grid-shape.component';
import { ThemeToggleTwoComponent } from '../../components/common/theme-toggle-two/theme-toggle-two.component';

/**
 * Layout compartilhado das rotas de autenticação (login, signup, convite).
 * Expõe logo tema-aware no mobile e painel de marca no desktop.
 */
@Component({
  selector: 'app-auth-page-layout',
  imports: [
    GridShapeComponent,
    RouterModule,
    ThemeToggleTwoComponent,
  ],
  templateUrl: './auth-page-layout.component.html',
  styles: ``,
})
export class AuthPageLayoutComponent {}
