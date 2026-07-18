import { Injectable } from '@angular/core';

/**
 * Nome do evento disparado na primeira visão útil de inatividade (dashboard/relatório).
 * Stub de produto — sem pipeline de ads; apenas ponto de instrumentação testável.
 */
export const FIRST_USEFUL_INACTIVITY_VIEW = 'first_useful_inactivity_view' as const;

/** Eventos de produto conhecidos (extensível). */
export type ProductTelemetryEvent = typeof FIRST_USEFUL_INACTIVITY_VIEW | string;

/**
 * Payload opcional anexado a um evento de telemetria.
 */
export type ProductTelemetryProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Stub de telemetria de produto (sem backend de analytics no MVP).
 * Mantém fila em memória para testes e futura troca por provider real.
 */
@Injectable({ providedIn: 'root' })
export class ProductTelemetryService {
  private readonly events: Array<{ name: ProductTelemetryEvent; props?: ProductTelemetryProps; at: string }> = [];
  private firstUsefulInactivityViewSent = false;

  /**
   * Registra um evento nomeado com propriedades opcionais.
   * @param name Nome do evento (ex.: first_useful_inactivity_view)
   * @param props Propriedades opcionais do contexto
   * @returns {void}
   * @example
   * telemetry.track('first_useful_inactivity_view', { source: 'dashboard' });
   */
  track(name: ProductTelemetryEvent, props?: ProductTelemetryProps): void {
    this.events.push({ name, props, at: new Date().toISOString() });
  }

  /**
   * Dispara `first_useful_inactivity_view` no máximo uma vez por sessão de app.
   * @param source Origem da visão (dashboard | inactivity_report)
   * @param props Props extras opcionais
   * @returns true se o evento foi emitido nesta chamada
   */
  trackFirstUsefulInactivityView(
    source: 'dashboard' | 'inactivity_report',
    props?: ProductTelemetryProps,
  ): boolean {
    if (this.firstUsefulInactivityViewSent) {
      return false;
    }
    this.firstUsefulInactivityViewSent = true;
    this.track(FIRST_USEFUL_INACTIVITY_VIEW, { source, ...props });
    return true;
  }

  /**
   * Lista eventos registrados nesta sessão (útil para testes unitários).
   * @returns Cópia da fila de eventos
   */
  getRecordedEvents(): ReadonlyArray<{ name: ProductTelemetryEvent; props?: ProductTelemetryProps; at: string }> {
    return [...this.events];
  }

  /**
   * Limpa a fila e o flag one-shot (somente testes).
   * @returns {void}
   */
  resetForTests(): void {
    this.events.length = 0;
    this.firstUsefulInactivityViewSent = false;
  }
}
