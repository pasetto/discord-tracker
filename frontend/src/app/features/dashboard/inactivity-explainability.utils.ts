/**
 * Tipo de ausência planejada alinhado ao backend.
 */
export type PlannedAbsenceTypeDto = 'vacation' | 'pto' | 'sick_leave' | 'other';

/**
 * Status intradiário completo (concern + não-concern).
 */
export type IntradayFullStatus =
  | 'not_started'
  | 'low_collaboration_today'
  | 'on_planned_absence'
  | 'outside_work_day'
  | 'outside_work_hours'
  | 'ok';

/**
 * Referência de ausência no DTO de explicabilidade.
 */
export interface PlannedAbsenceRefDto {
  type: PlannedAbsenceTypeDto;
  startDate?: string;
  endDate: string;
}

/**
 * Entrada mínima para montar chips “por que NÃO é sumiu”.
 */
export interface IntradayExplainabilityEntry {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  status: IntradayFullStatus;
  plannedAbsence?: PlannedAbsenceRefDto;
}

/**
 * Item legível de explicabilidade para a UI.
 */
export interface ExplainabilityListItem {
  id: string;
  displayName: string;
  status: IntradayFullStatus;
  message: string;
}

/** Statuses que explicam por que o colaborador não entra em “quem sumiu”. */
const NON_CONCERN_STATUSES: ReadonlySet<IntradayFullStatus> = new Set([
  'outside_work_day',
  'outside_work_hours',
  'on_planned_absence',
]);

/**
 * Converte tipo técnico de ausência em rótulo pt-BR.
 * @param type Tipo retornado pela API
 * @returns Label amigável
 */
export function getAbsenceTypeLabel(type: PlannedAbsenceTypeDto): string {
  const labels: Record<PlannedAbsenceTypeDto, string> = {
    pto: 'PTO',
    vacation: 'Férias',
    sick_leave: 'Atestado',
    other: 'Outra ausência',
  };
  return labels[type];
}

/**
 * Formata janela de ausência em dd/MM/yyyy – dd/MM/yyyy (UTC).
 * @param absence Datas ISO da ausência
 * @returns Janela legível ou string vazia
 */
export function formatAbsenceWindow(
  absence: Pick<PlannedAbsenceRefDto, 'startDate' | 'endDate'>,
): string {
  const end = formatUtcDate(absence.endDate);
  if (!end) {
    return '';
  }
  const start = absence.startDate ? formatUtcDate(absence.startDate) : '';
  if (!start) {
    return `até ${end}`;
  }
  return `${start} – ${end}`;
}

/**
 * Monta mensagem de explicabilidade para um status intradiário não-concern.
 * @param status Status técnico
 * @param plannedAbsence Ausência opcional (quando on_planned_absence)
 * @returns Frase legível para o gestor
 */
export function getIntradayExplainabilityLabel(
  status: IntradayFullStatus,
  plannedAbsence?: PlannedAbsenceRefDto,
): string {
  switch (status) {
    case 'outside_work_day':
      return 'Fora do dia útil / feriado — não conta como “sumiu”';
    case 'outside_work_hours':
      return 'Fora da jornada configurada — ainda cedo demais para alerta';
    case 'on_planned_absence': {
      if (!plannedAbsence) {
        return 'Ausência planejada — não entra no alerta de quem sumiu';
      }
      const typeLabel = getAbsenceTypeLabel(plannedAbsence.type);
      const window = formatAbsenceWindow(plannedAbsence);
      return window
        ? `Ausência planejada (${typeLabel}) · ${window}`
        : `Ausência planejada (${typeLabel})`;
    }
    case 'not_started':
      return 'Sem colaboração hoje';
    case 'low_collaboration_today':
      return 'Colaboração baixa hoje';
    default:
      return 'Dentro do esperado';
  }
}

/**
 * Filtra entradas não-concern e monta lista de explicabilidade para a UI.
 * @param entries Entradas intradiárias (allEntries)
 * @returns Itens legíveis (máx. 12)
 */
export function getNonConcernExplainabilityEntries(
  entries: IntradayExplainabilityEntry[],
): ExplainabilityListItem[] {
  return entries
    .filter((entry) => NON_CONCERN_STATUSES.has(entry.status))
    .map((entry) => ({
      id: entry.trackedUserId || entry.discordId,
      displayName: entry.displayName,
      status: entry.status,
      message: getIntradayExplainabilityLabel(entry.status, entry.plannedAbsence),
    }))
    .slice(0, 12);
}

/**
 * Formata ISO date em dd/MM/yyyy UTC.
 * @param iso Data ISO
 * @returns Data formatada ou vazia
 */
function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
