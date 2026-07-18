import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Breakpoint Tailwind `xl` (px): abaixo disso o toggle do header abre o drawer mobile.
 * @constant
 */
export const SIDEBAR_DESKTOP_BREAKPOINT_PX = 1280;

/**
 * Estado compartilhado da sidebar (expandida / drawer mobile / hover).
 */
@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isExpandedSubject = new BehaviorSubject<boolean>(true);
  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);
  private isHoveredSubject = new BehaviorSubject<boolean>(false);

  isExpanded$ = this.isExpandedSubject.asObservable();
  isMobileOpen$ = this.isMobileOpenSubject.asObservable();
  isHovered$ = this.isHoveredSubject.asObservable();

  /**
   * Define se a sidebar desktop está expandida.
   * @param val true para expandida
   * @returns {void}
   */
  setExpanded(val: boolean): void {
    this.isExpandedSubject.next(val);
  }

  /**
   * Alterna expansão da sidebar desktop.
   * @returns {void}
   */
  toggleExpanded(): void {
    this.isExpandedSubject.next(!this.isExpandedSubject.value);
  }

  /**
   * Abre ou fecha o drawer mobile.
   * @param val true para aberto
   * @returns {void}
   */
  setMobileOpen(val: boolean): void {
    this.isMobileOpenSubject.next(val);
  }

  /**
   * Alterna o drawer mobile (hambúrguer).
   * @returns {void}
   */
  toggleMobileOpen(): void {
    this.isMobileOpenSubject.next(!this.isMobileOpenSubject.value);
  }

  /**
   * Indica se o drawer mobile está aberto agora.
   * @returns true quando aberto
   */
  isMobileOpen(): boolean {
    return this.isMobileOpenSubject.value;
  }

  /**
   * Define hover na sidebar colapsada (desktop).
   * @param val true quando o ponteiro está sobre a sidebar
   * @returns {void}
   */
  setHovered(val: boolean): void {
    this.isHoveredSubject.next(val);
  }
}
