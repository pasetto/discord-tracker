import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrackedMemberOption } from '../../../core/members/tracked-members.service';

/**
 * Seletor de colaborador com busca por nome e preenchimento automático de IDs.
 */
@Component({
  selector: 'app-member-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <label class="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
      {{ label }}
      <input
        type="search"
        class="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        [placeholder]="placeholder"
        [(ngModel)]="searchTerm"
        (ngModelChange)="onSearchChange()"
        [disabled]="disabled || members.length === 0"
        [attr.list]="'member-options-' + inputId"
      />
      <datalist [id]="'member-options-' + inputId">
        <option *ngFor="let member of filteredMembers" [value]="member.displayName"></option>
      </datalist>
      <select
        class="mt-2 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        [ngModel]="selectedMemberId"
        (ngModelChange)="onSelectChange($event)"
        [disabled]="disabled || members.length === 0"
      >
        <option value="">{{ members.length === 0 ? 'Nenhum membro sincronizado' : 'Selecione um colaborador' }}</option>
        <option *ngFor="let member of members" [value]="member.id">
          {{ member.displayName }} ({{ member.discordId }})
        </option>
      </select>
      <span *ngIf="members.length === 0" class="text-xs text-warning-700">
        Sincronize os membros do Discord antes de continuar.
      </span>
    </label>
  `,
})
export class MemberSelectComponent implements OnChanges {
  /** Rótulo do campo. */
  @Input() label = 'Colaborador';

  /** Placeholder da busca por nome. */
  @Input() placeholder = 'Buscar por nome...';

  /** Desabilita interação do componente. */
  @Input() disabled = false;

  /** ID do membro rastreado selecionado. */
  @Input() selectedMemberId = '';

  /** Lista de membros disponíveis. */
  @Input() members: TrackedMemberOption[] = [];

  /** Emite membro selecionado com IDs preenchidos. */
  @Output() readonly memberSelected = new EventEmitter<TrackedMemberOption | null>();

  /** Identificador único para datalist no DOM. */
  readonly inputId = Math.random().toString(36).slice(2);

  searchTerm = '';
  filteredMembers: TrackedMemberOption[] = [];

  /**
   * Atualiza lista filtrada quando membros mudam.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['members']) {
      this.filteredMembers = [...this.members];
    }
  }

  /**
   * Filtra membros pelo termo digitado.
   */
  onSearchChange(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredMembers = [...this.members];
      return;
    }

    this.filteredMembers = this.members.filter((member) =>
      member.displayName.toLowerCase().includes(term) || member.username.toLowerCase().includes(term),
    );

    const exact = this.members.find((member) => member.displayName.toLowerCase() === term);
    if (exact) {
      this.onSelectChange(exact.id);
    }
  }

  /**
   * Propaga seleção do colaborador para o formulário pai.
   * @param memberId ID do membro rastreado
   */
  onSelectChange(memberId: string): void {
    this.selectedMemberId = memberId;
    const member = this.members.find((item) => item.id === memberId) ?? null;
    this.memberSelected.emit(member);
  }
}
