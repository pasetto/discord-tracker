import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Aba do hub unificado de relatórios. */
interface ReportsTab {
  label: string;
  path: string;
  description: string;
}

/**
 * Hub de relatórios com navegação por abas (inatividade, metas, ausências).
 */
@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './reports-hub.component.html',
})
export class ReportsHubComponent {
  /** Abas disponíveis no hub de relatórios. */
  readonly tabs: ReportsTab[] = [
    {
      label: 'Quem sumiu',
      path: 'inactivity',
      description: 'Colaboradores sem sinais recentes de colaboração',
    },
    {
      label: 'Sinais de texto',
      path: 'text-collaboration',
      description: 'Volume de sinais textuais por colaborador no período',
    },
    {
      label: 'Metas semanais',
      path: 'goals',
      description: 'Progresso das metas individuais do time',
    },
    {
      label: 'Padrões por pessoa',
      path: 'member-journey',
      description: 'Horário de entrada e saída por colaborador',
    },
    {
      label: 'Ausências em andamento',
      path: 'absences',
      description: 'Férias, PTO e licenças ativas no momento',
    },
    {
      label: 'Ranking',
      path: 'ranking',
      description: 'Top colaboradores conforme gamificação configurada',
    },
    {
      label: 'Conquistas',
      path: 'achievements',
      description: 'Badges e streaks do time',
    },
  ];
}
