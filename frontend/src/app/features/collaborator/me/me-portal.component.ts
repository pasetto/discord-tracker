import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

/**
 * Link de acesso para endpoints de dados próprios do colaborador.
 */
interface MeDataLink {
  label: string;
  href: string;
  description: string;
}

/**
 * Item de transparência LGPD sobre quais sinais são monitorados.
 */
interface MeasurementTransparencyItem {
  title: string;
  details: string;
}

/**
 * Portal do colaborador para transparência e acesso aos dados próprios em `/me`.
 */
@Component({
  selector: 'app-me-portal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './me-portal.component.html',
})
export class MePortalComponent {
  /**
   * Lista de sinais monitorados pela plataforma sem conteúdo sensível.
   */
  readonly measuredSignals: MeasurementTransparencyItem[] = [
    {
      title: 'Sinais de voz',
      details: 'Tempo agregado de colaboração em voz por sessão/canal (sem gravação de áudio).',
    },
    {
      title: 'Sinais de presença',
      details: 'Status e duração de presença (online/idle/dnd/offline) para cálculo de colaboração.',
    },
    {
      title: 'Texto (metadados)',
      details: 'Eventos de mensagem/reação por canal e horário, sem conteúdo textual armazenado.',
    },
  ];

  /**
   * Endpoints de autoatendimento para consulta e export dos próprios dados.
   */
  readonly dataLinks: MeDataLink[] = [
    {
      label: 'Resumo de colaboração',
      href: '/api/v1/me/collaboration',
      description: 'Mostra consolidado dos sinais de colaboração da conta autenticada.',
    },
    {
      label: 'Ausências planejadas',
      href: '/api/v1/me/absences',
      description: 'Lista férias/PTO/licenças vinculadas ao seu perfil rastreado.',
    },
    {
      label: 'Export LGPD (JSON)',
      href: '/api/v1/me/data-export',
      description: 'Exporta seus dados rastreados em JSON sem conteúdo de mensagens.',
    },
  ];
}
