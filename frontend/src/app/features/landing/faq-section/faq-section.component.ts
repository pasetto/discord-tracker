import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

/**
 * Item de FAQ da landing (desarma vigilância, timesheet e cartão).
 */
export interface LandingFaqItem {
  /** Pergunta exibida no accordion. */
  question: string;
  /** Resposta em texto corrido. */
  answer: string;
}

/**
 * FAQ mínimo P1 da landing pública.
 */
@Component({
  selector: 'app-faq-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq-section.component.html',
})
export class FaqSectionComponent {
  /** Índice da pergunta aberta; `null` = todas fechadas. */
  openIndex: number | null = 0;

  /** Perguntas e respostas do pack SYN-64. */
  readonly items: LandingFaqItem[] = [
    {
      question: 'Vocês leem as mensagens do time?',
      answer:
        'Não. Sinais de texto são metadados (ex.: houve atividade no canal). Conteúdo de mensagem, áudio e DMs não são armazenados.',
    },
    {
      question: 'Isso não vira vigilância?',
      answer:
        'O objetivo é visibilidade de colaboração e inatividade, com canais que você escolhe e calendário/PTO no contexto. Não é ferramenta para policiar o que as pessoas dizem.',
    },
    {
      question: 'Substitui Toggl / timesheet?',
      answer:
        'Substitui o timer manual como jeito de ver colaboração do time. Não é timesheet legal nem ponto eletrônico.',
    },
    {
      question: 'E se a pessoa está de férias?',
      answer:
        'Ausências planejadas e calendário de trabalho entram no contexto para reduzir falso “sumiu”.',
    },
    {
      question: 'Preciso de cartão para testar?',
      answer:
        'Não. Conta + período de teste da organização sem cartão. Cartão só na assinatura via Stripe.',
    },
  ];

  /**
   * Abre ou fecha um item do accordion.
   * @param index - Índice do item
   * @returns void
   */
  toggle(index: number): void {
    this.openIndex = this.openIndex === index ? null : index;
  }
}
