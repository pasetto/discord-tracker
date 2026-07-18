import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Portuguese } from 'flatpickr/dist/l10n/pt';
import { LabelComponent } from '../label/label.component';

/**
 * Payload legado emitido por `dateChange` (demo TailAdmin).
 */
export interface DatePickerChangeEvent {
  selectedDates: Date[];
  dateStr: string;
  instance: flatpickr.Instance;
}

/**
 * Datepicker de produto baseado em flatpickr, com ngModel (Y-m-d) e display BR.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [LabelComponent],
  templateUrl: './date-picker.component.html',
  styles: ``,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent
  implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor
{
  /** Id do input (acessibilidade / label). */
  @Input() id!: string;

  /** Modo flatpickr (produto usa `single`). */
  @Input() mode: 'single' | 'multiple' | 'range' | 'time' = 'single';

  /** Valor inicial quando não há ngModel. */
  @Input() defaultDate?: string | Date | string[] | Date[];

  /** Rótulo opcional acima do campo. */
  @Input() label?: string;

  /** Placeholder do input de exibição. */
  @Input() placeholder = 'dd/mm/aaaa';

  /**
   * Quando true, calendário fica embutido (demo TailAdmin).
   * Produto usa popup (false).
   */
  @Input() staticCalendar = false;

  /** Emite payload legado para demos existentes. */
  @Output() dateChange = new EventEmitter<DatePickerChangeEvent>();

  @ViewChild('dateInput', { static: false }) dateInput!: ElementRef<HTMLInputElement>;

  private flatpickrInstance: flatpickr.Instance | undefined;
  private apiValue = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private disabled = false;

  /**
   * Inicializa o flatpickr após o input existir no DOM.
   * @returns {void}
   */
  ngAfterViewInit(): void {
    this.initFlatpickr();
  }

  /**
   * Reaplica `defaultDate` quando muda sem ngModel.
   * @param changes Mudanças de inputs Angular
   * @returns {void}
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultDate'] && !changes['defaultDate'].firstChange && this.flatpickrInstance) {
      const next = this.defaultDate ?? '';
      this.flatpickrInstance.setDate(next || '', false);
      this.apiValue = typeof next === 'string' ? next : this.flatpickrInstance.input.value;
    }
  }

  /**
   * Destroi a instância flatpickr ao desmontar.
   * @returns {void}
   */
  ngOnDestroy(): void {
    this.flatpickrInstance?.destroy();
    this.flatpickrInstance = undefined;
  }

  /**
   * ControlValueAccessor: aplica valor externo (Y-m-d).
   * @param value Data no formato API ou null
   * @returns {void}
   */
  writeValue(value: string | null): void {
    this.apiValue = value ?? '';
    if (this.flatpickrInstance) {
      this.flatpickrInstance.setDate(this.apiValue || '', false);
    }
  }

  /**
   * ControlValueAccessor: registra callback de mudança.
   * @param fn Callback do FormsModule
   * @returns {void}
   */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  /**
   * ControlValueAccessor: registra callback de touched.
   * @param fn Callback do FormsModule
   * @returns {void}
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * ControlValueAccessor: habilita/desabilita o input.
   * @param isDisabled Estado disabled
   * @returns {void}
   */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.flatpickrInstance) {
      if (isDisabled) {
        this.flatpickrInstance.close();
      }
      this.dateInput.nativeElement.disabled = isDisabled;
      const alt = this.flatpickrInstance.altInput;
      if (alt) {
        alt.disabled = isDisabled;
      }
    }
  }

  /**
   * Valor atual no formato da API (`Y-m-d`).
   * @returns String vazia ou data ISO date
   * @example
   * picker.getApiValue() // '2026-07-18'
   */
  getApiValue(): string {
    return this.apiValue;
  }

  /**
   * Aplica seleção vinda do picker (ou teste) e notifica ngModel.
   * @param dateStr Data `Y-m-d` ou string vazia
   * @returns {void}
   * @example
   * picker.writeValueFromPicker('2026-07-18')
   */
  writeValueFromPicker(dateStr: string): void {
    this.apiValue = dateStr;
    this.onChange(dateStr);
    this.onTouched();
  }

  /**
   * Cria a instância flatpickr com locale PT-BR e dateFormat API.
   * @returns {void}
   */
  private initFlatpickr(): void {
    const initial = this.apiValue || this.defaultDate || undefined;
    this.flatpickrInstance = flatpickr(this.dateInput.nativeElement, {
      mode: this.mode,
      static: this.staticCalendar,
      monthSelectorType: 'static',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      locale: Portuguese,
      allowInput: false,
      defaultDate: initial,
      onChange: (selectedDates, dateStr, instance) => {
        this.writeValueFromPicker(dateStr);
        this.dateChange.emit({ selectedDates, dateStr, instance });
      },
      onClose: () => this.onTouched(),
    });

    if (this.disabled) {
      this.setDisabledState(true);
    }
  }
}
