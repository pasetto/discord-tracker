import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthPageLayoutComponent } from '../../../shared/layout/auth-page-layout/auth-page-layout.component';
import { SignupFormComponent } from '../../../shared/components/auth/signup-form/signup-form.component';

/** Preview público de organização pelo código de convite. */
interface InvitePreviewDto {
  organizationId: string;
  organizationName: string;
  inviteCode: string;
}

/**
 * Página de cadastro com suporte a convite via query `code`.
 */
@Component({
  selector: 'app-sign-up',
  imports: [AuthPageLayoutComponent, SignupFormComponent],
  templateUrl: './sign-up.component.html',
  styles: ``,
})
export class SignUpComponent implements OnInit {
  inviteCode = '';
  inviteOrganizationName = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly httpClient: HttpClient,
  ) {}

  /**
   * Propaga código de convite da URL para o formulário.
   */
  ngOnInit(): void {
    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    if (!codeFromQuery) {
      return;
    }

    this.inviteCode = codeFromQuery.toUpperCase();
    this.httpClient.get<InvitePreviewDto>(`/api/v1/public/invite-codes/${this.inviteCode}`).subscribe({
      next: (response) => {
        this.inviteOrganizationName = response.organizationName;
      },
    });
  }
}
