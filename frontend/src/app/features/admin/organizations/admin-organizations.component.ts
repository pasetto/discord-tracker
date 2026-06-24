import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AdminApiService, type AdminOrganization } from '../../../core/admin/admin-api.service';

/**
 * Listagem de organizações (tenants) no painel super admin.
 */
@Component({
  selector: 'app-admin-organizations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-organizations.component.html',
})
export class AdminOrganizationsComponent implements OnInit {
  loading = false;
  errorMessage = '';
  organizations: AdminOrganization[] = [];
  total = 0;

  constructor(private readonly adminApi: AdminApiService) {}

  /**
   * Carrega tenants ao iniciar.
   */
  ngOnInit(): void {
    this.loading = true;
    this.adminApi.listOrganizations(100, 0).subscribe({
      next: ({ organizations, total }) => {
        this.organizations = organizations;
        this.total = total;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Falha ao carregar organizações.';
        this.loading = false;
      },
    });
  }
}
