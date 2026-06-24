import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CASE_STUDIES, CaseStudy, findCaseStudyBySlug } from './case-studies.data';

/**
 * Página pública de listagem ou detalhe de case studies.
 */
@Component({
  selector: 'app-case-study-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './case-study-page.component.html',
})
export class CaseStudyPageComponent implements OnInit {
  studies: CaseStudy[] = CASE_STUDIES;
  selected: CaseStudy | null = null;
  notFound = false;

  constructor(private readonly route: ActivatedRoute) {}

  /**
   * Carrega case por slug da rota ou exibe listagem.
   */
  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) {
        this.selected = null;
        this.notFound = false;
        return;
      }

      const study = findCaseStudyBySlug(slug);
      this.selected = study ?? null;
      this.notFound = !study;
    });
  }
}
