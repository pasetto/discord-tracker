import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Item de descoberta no hub de configurações. */
export interface SettingsHubItem {
  /** Rótulo curto do link. */
  label: string;
  /** Rota absoluta da setting. */
  path: string;
  /** Descrição em uma linha para orientar o gestor. */
  description: string;
}

/**
 * Hub mobile/desktop de descoberta das configurações do tenant.
 * Substitui o redirect direto para Discord em `/app/settings`.
 */
@Component({
  selector: 'app-settings-hub',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './settings-hub.component.html',
})
export class SettingsHubComponent {
  /** Links principais de descoberta (ordem alinhada ao aceite SYN-72). */
  readonly items: SettingsHubItem[] = [
    {
      label: 'Discord',
      path: '/app/settings/discord',
      description: 'Conectar bot e escolher o servidor monitorado',
    },
    {
      label: 'Canais',
      path: '/app/settings/channels',
      description: 'Regras de canais de voz e texto colaborativos',
    },
    {
      label: 'Calendário',
      path: '/app/settings/calendar',
      description: 'Jornada de trabalho e feriados do time',
    },
    {
      label: 'PTO / Ausências',
      path: '/app/settings/absences',
      description: 'Cadastrar férias, PTO e licenças',
    },
    {
      label: 'Metas',
      path: '/app/settings/goals',
      description: 'Metas individuais de horas colaborativas',
    },
    {
      label: 'Inatividade',
      path: '/app/settings/inactivity',
      description: 'Limiares de quem sumiu e alertas',
    },
    {
      label: 'Time',
      path: '/app/settings/team',
      description: 'Convites, membros e papéis da organização',
    },
    {
      label: 'Gamificação',
      path: '/app/settings/gamification',
      description: 'Ranking, badges e streaks (sujeito ao plano)',
    },
  ];
}
