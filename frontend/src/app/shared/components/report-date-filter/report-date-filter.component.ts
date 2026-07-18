import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  REPORT_DATE_PRESET_LABELS,
  ReportDatePreset,
  ReportDateRangeValue,
  formatReportDateRangeLabel,
  resolveReportDateRange,
} from '../../../core/reports/report-date-range.util';
import { DatePickerComponent } from '../form/date-picker/date-picker.component';

/**
 * Filtro reutilizável de período para telas de relatório (presets + intervalo customizado).
 */
@Component({
  selector: 'app-report-date-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  templateUrl: './report-date-filter.component.html',
})
export class ReportDateFilterComponent implements OnInit {
  /** Preset inicial exibido ao carregar a tela. */
  @Input() initialPreset: ReportDatePreset = 'this_week';

  /** Emite quando o usuário confirma um novo intervalo. */
  @Output() readonly rangeChange = new EventEmitter<ReportDateRangeValue>();

  selectedPreset: ReportDatePreset = 'this_week';
  customFrom = '';
  customTo = '';
  errorMessage = '';

  /** Lista de presets disponíveis (exceto custom). */
  readonly presetOptions = Object.entries(REPORT_DATE_PRESET_LABELS) as Array<[ReportDatePreset, string]>;

  /**
   * Sincroniza preset inicial exibido no select (sem disparar reload — o pai define o intervalo default).
   */
  ngOnInit(): void {
    this.selectedPreset = this.initialPreset;
  }

  /**
   * Rótulo legível do intervalo atualmente selecionado.
   */
  get currentRangeLabel(): string {
    try {
      return formatReportDateRangeLabel(
        resolveReportDateRange(this.selectedPreset, this.customFrom, this.customTo),
      );
    } catch {
      return 'Período inválido';
    }
  }

  /**
   * Reaplica preset selecionado e notifica ouvintes.
   */
  onPresetChange(): void {
    this.errorMessage = '';
    if (this.selectedPreset !== 'custom') {
      this.emitCurrentRange();
    }
  }

  /**
   * Aplica intervalo personalizado informado nos inputs date.
   */
  applyCustomRange(): void {
    this.errorMessage = '';
    try {
      const range = resolveReportDateRange('custom', this.customFrom, this.customTo);
      this.rangeChange.emit(range);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Período inválido.';
    }
  }

  /**
   * Emite intervalo calculado a partir do estado atual.
   * @param emitError Quando true, exibe erro de validação na UI
   */
  private emitCurrentRange(emitError = true): void {
    try {
      const range = resolveReportDateRange(this.selectedPreset, this.customFrom, this.customTo);
      this.rangeChange.emit(range);
    } catch (error) {
      if (emitError) {
        this.errorMessage = error instanceof Error ? error.message : 'Período inválido.';
      }
    }
  }
}
