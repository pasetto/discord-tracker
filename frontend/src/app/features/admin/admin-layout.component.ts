import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Layout do painel super admin da plataforma (fora do app tenant).
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {
  /** Links do menu administrativo da plataforma. */
  readonly navItems = [
    { label: 'Visão geral', path: '/admin' },
    { label: 'Planos', path: '/admin/plans' },
    { label: 'Usuários', path: '/admin/users' },
    { label: 'Organizações', path: '/admin/organizations' },
    { label: 'Bot Discord', path: '/admin/discord' },
  ];
}
