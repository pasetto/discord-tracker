# Metas — meta semanal, progresso e cores — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o cálculo de meta vs realizado para exibir a meta semanal configurada (ex.: 40h) em “Esta semana”, recalcular o progresso de forma coerente e aplicar cores cinza/verde/azul conforme mínimo diário acumulado e excedente.

**Architecture:** Separar no backend a meta semanal **configurada** (`weeklyGoalHours`) do mínimo acumulado no período (`periodMinimumHours`) e do denominador de progresso (`progressPercent` sempre contra a meta semanal inteira). O mínimo acumulado usa **dias úteis do calendário** (`WorkCalendar`: jornada + feriados) e desconta **PTO** por colaborador — mesmo critério de `inactivityService`. Extrair helper compartilhado no frontend para status visual (`below_minimum` | `on_track` | `exceeded`) reutilizado em Configurações → Metas e Relatórios → Metas Semanais.

**Tech Stack:** Node.js 22, TypeScript, Mongoose, Vitest, Angular 21, Tailwind CSS 4

**Evidência do bug (produção, 2026-07-01):** Em [disc.econdos.com.br/app/settings/goals](https://disc.econdos.com.br/app/settings/goals), colaboradores com template 40h/semana exibem **Meta: 17.14h** (quarta-feira = 3 dias úteis de 7 → `40 × 3/7`). Progresso inflado (ex.: Eduardo 16.54h → 96.5% em vez de ~41% sobre 40h). Mesma API alimenta Relatórios → Metas Semanais.

**Causa raiz:** `getGoalsWeeklyReport` em `goalsService.ts` sobrescreve `weeklyGoalHours` com `prorateWeeklyGoalHours(...)` e usa esse valor rateado também no `progressPercent` e no alerta de quinta-feira.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `backend/src/services/workCalendarService.ts` | `getWorkCalendarForGuild` + `countInclusiveBusinessDaysInPeriod` |
| `backend/tests/services/workCalendarService.test.ts` | Testes de contagem de dias úteis inclusivos |
| `backend/src/services/goalsService.ts` | Corrigir campos do relatório, progresso, calendário e PTO |
| `backend/tests/services/goalsService.test.ts` | Atualizar e ampliar casos de regressão |
| `backend/src/api/routes/export.ts` | CSV passa a exportar meta semanal real |
| `backend/src/api/routes/goals.ts` | Atualizar anotação OpenAPI dos novos campos |
| `frontend/src/app/core/goals/goal-progress.util.ts` | **Novo** — status e classes Tailwind |
| `frontend/src/app/core/goals/goal-progress.util.spec.ts` | **Novo** — testes unitários do helper |
| `frontend/src/app/features/settings/goals/goals-settings.component.ts` | Tipos + uso do helper |
| `frontend/src/app/features/settings/goals/goals-settings.component.html` | Barra de progresso + cores |
| `frontend/src/app/features/reports/goals/goals-report.component.ts` | Tipos + uso do helper |
| `frontend/src/app/features/reports/goals/goals-report.component.html` | Barra de progresso + cores |
| `frontend/src/app/features/reports/goals/goals-report.component.spec.ts` | Teste de cor por status |

---

## Regras de negócio (definitivas)

### Meta exibida (`weeklyGoalHours`)

| Preset / intervalo | Valor retornado | Exemplo (template 40h, quarta-feira) |
|--------------------|-----------------|--------------------------------------|
| `this_week`, `last_week`, `last_7_days` | Meta semanal **configurada** | **40h** |
| `today`, `yesterday` | Meta semanal **configurada** (rótulo UI pode acrescentar “semana”) | **40h** |
| `custom` com ≤ 6 dias | Meta semanal **configurada** | **40h** |
| `custom` com ≥ 7 dias | Meta semanal **configurada** | **40h** |

> A meta semanal **nunca** é rateada no campo exibido. Rateio só entra no mínimo acumulado e, se necessário no futuro, em campo separado `periodProratedGoalHours` (fora do escopo deste plano).

### Calendário de trabalho (`WorkCalendar`)

Fonte: `GET /org/:orgId/work-calendar` — jornada (`workWeek`) + feriados (`holidays`).

Resolução no backend (mesmo padrão de `inactivityService.resolveWorkCalendar`):

1. Buscar calendário com `{ organizationId, guildId }`, preferindo override por guild.
2. Fallback: calendário org-wide (`guildId` ausente).
3. Fallback final: `createDefaultWorkWeek()` + feriados vazios.

Dia útil: `isBusinessDay(calendar, date)` — weekday habilitado **e** não feriado (inclui recorrentes).

> **Não** usar `countInclusiveUtcDays` para metas — fins de semana e feriados cadastrados não entram no mínimo acumulado.

### Mínimo acumulado no período (`periodMinimumHours`)

**Por colaborador** (PTO individual):

```
businessDaysInPeriod = countInclusiveBusinessDaysInPeriod(
  calendar,
  periodStart,
  periodEnd,
  (date) => isOnPlannedAbsence(userAbsences, date)
)

periodMinimumHours = dailyMinimumHours × businessDaysInPeriod
```

- Se `dailyMinimumHours` for `null` ou `0` → `periodMinimumHours = null`.
- Se `businessDaysInPeriod === 0` (ex.: semana só com feriado/PTO) → `periodMinimumHours = null` (sem faixa cinza).
- Ex.: mínimo 7h/dia, seg–qua úteis (3 dias) → `21h`.
- Ex.: terça é feriado no calendário → seg+qua = 2 dias → `14h`.
- Ex.: colaborador em PTO na quarta → seg+ter = 2 dias → `14h`.

Campo auxiliar na resposta: `businessDaysInPeriod: number` — dias úteis efetivos do colaborador no intervalo (útil para UI/tooltip).

### Progresso (`progressPercent`)

```
progressPercent = (realizedHours / configuredWeeklyGoalHours) × 100
```

- **Sem teto em 100%** — excedente pode ser 120%, 150%, etc.
- Se não houver meta configurada → `0`.

### Alerta de quinta-feira (`shouldAlertLowProgress`)

Conforme design spec §6.14: abaixo de **50% da meta semanal** na quinta.

```typescript
shouldTriggerLowProgressThursdayAlert(referenceDate, progressPercent)
// progressPercent já calculado contra meta semanal inteira
```

### Status visual (frontend)

| Status | Condição | Cor (Tailwind) |
|--------|----------|----------------|
| `below_minimum` | `periodMinimumHours != null` **e** `realizedHours < periodMinimumHours` | `bg-gray-400 dark:bg-gray-500` |
| `on_track` | `realizedHours >= periodMinimumHours` (ou mínimo nulo) **e** `realizedHours < weeklyGoalHours` | `bg-success-500` |
| `exceeded` | `weeklyGoalHours != null` **e** `realizedHours >= weeklyGoalHours` | `bg-brand-500` (azul da marca) |
| `no_goal` | `weeklyGoalHours == null` | barra neutra `bg-gray-200` |

**Prioridade:** `exceeded` > `below_minimum` > `on_track` (se alguém passou da meta semanal, mostrar azul mesmo que tenha ficado abaixo do mínimo em dias anteriores — cenário raro).

### Barra de progresso

- Largura base: `min(realized / weeklyGoal × 100, 100)` para a parte preenchida.
- Quando `exceeded`: barra cheia azul + texto “+Xh acima da meta”.
- Quando `below_minimum`: barra cinza proporcional ao realizado (máx. 100%).

---

### Task 0: Utilitários de calendário reutilizáveis

**Files:**
- Modify: `backend/src/services/workCalendarService.ts`
- Modify: `backend/tests/services/workCalendarService.test.ts`

- [ ] **Step 1: Escrever testes que falham**

```typescript
// backend/tests/services/workCalendarService.test.ts
import { countInclusiveBusinessDaysInPeriod, getWorkCalendarForGuild } from '../../src/services/workCalendarService';

describe('countInclusiveBusinessDaysInPeriod', () => {
  const calendar = { /* workWeek seg–sex enabled, holidays: [{ date: '2026-07-01', ... }] */ };

  it('conta dias úteis inclusivos entre periodStart e periodEnd', () => {
    // seg 2026-06-30 → qua 2026-07-02 = 3 dias úteis
    expect(countInclusiveBusinessDaysInPeriod(calendar, from, to)).toBe(3);
  });

  it('exclui feriados cadastrados no calendário', () => {
    // qua 2026-07-01 é feriado → seg+ter = 2
    expect(countInclusiveBusinessDaysInPeriod(calendar, from, toWithHoliday)).toBe(2);
  });

  it('exclui dias cobertos por PTO via callback', () => {
    expect(countInclusiveBusinessDaysInPeriod(calendar, from, to, (d) => d.startsWith('2026-07-02'))).toBe(2);
  });

  it('retorna 0 quando intervalo inválido', () => {
    expect(countInclusiveBusinessDaysInPeriod(calendar, to, from)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
wsl npm run test --workspace=backend -- workCalendarService.test.ts
```

- [ ] **Step 3: Implementar funções**

```typescript
// backend/src/services/workCalendarService.ts

/**
 * Busca calendário da org/guild com fallback padrão.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @returns Jornada e feriados prontos para cálculo
 */
export async function getWorkCalendarForGuild(
  organizationId: Types.ObjectId,
  guildId: string,
): Promise<Pick<WorkCalendar, 'workWeek' | 'holidays'>> {
  const calendar = await WorkCalendarModel.findOne({
    organizationId,
    $or: [{ guildId }, { guildId: { $exists: false } }],
  })
    .sort({ guildId: -1 })
    .lean()
    .exec();

  if (!calendar) {
    return { workWeek: createDefaultWorkWeek(), holidays: [] };
  }
  return { workWeek: calendar.workWeek, holidays: calendar.holidays };
}

/**
 * Conta dias úteis inclusivos no intervalo [from, to], respeitando calendário e PTO.
 * Diferente de computeBusinessDaysBetween (inatividade), que é exclusivo em `from`.
 * @param calendar Calendário com jornada e feriados
 * @param from Início do período (inclusivo)
 * @param to Fim do período (inclusivo)
 * @param isExcludedDay Callback opcional — true para excluir dia (ex.: PTO)
 * @returns Quantidade de dias úteis no intervalo
 */
export function countInclusiveBusinessDaysInPeriod(
  calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'>,
  from: Date,
  to: Date,
  isExcludedDay: (date: Date) => boolean = () => false,
): number {
  const fromDay = startOfUtcDay(from);
  const toDay = startOfUtcDay(to);
  if (toDay.getTime() < fromDay.getTime()) {
    return 0;
  }

  let count = 0;
  for (let cursor = fromDay; cursor.getTime() <= toDay.getTime(); cursor = addUtcDays(cursor, 1)) {
    if (!isBusinessDay(calendar, cursor)) {
      continue;
    }
    if (isExcludedDay(cursor)) {
      continue;
    }
    count += 1;
  }
  return count;
}
```

Adicionar helper privado `startOfUtcDay` / `addUtcDays` local ou importar de `sessionTimeUtils`.

- [ ] **Step 4: Rodar testes e confirmar sucesso**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workCalendarService.ts backend/tests/services/workCalendarService.test.ts
git commit -m "feat(calendar): contagem inclusiva de dias úteis para metas"
```

> **Refactor opcional (YAGNI):** `inactivityService.resolveWorkCalendar` pode passar a delegar para `getWorkCalendarForGuild` num PR separado — não bloquear esta entrega.

---

### Task 1: Corrigir contrato da API em `goalsService`

**Files:**
- Modify: `backend/src/services/goalsService.ts`
- Test: `backend/tests/services/goalsService.test.ts`
- Uses: `getWorkCalendarForGuild`, `countInclusiveBusinessDaysInPeriod`, `isOnPlannedAbsence`

- [ ] **Step 1: Escrever testes que falham**

Adicionar/alterar em `goalsService.test.ts`:

```typescript
it('exibe meta semanal configurada (40h) e progresso contra ela no meio da semana', async () => {
  // ... seed: trackedUser + goal weeklyCollaborationHours: 40, dailyMinimumHours: 7
  // ... voice session: 16.54h no intervalo

  const report = await getGoalsWeeklyReport({
    organizationId: organizationId.toHexString(),
    guildId,
    from: new Date('2026-06-30T00:00:00.000Z'), // segunda
    to: new Date('2026-07-02T23:59:59.999Z'),   // quarta
    referenceDate: new Date('2026-07-02T12:00:00.000Z'),
    now: new Date('2026-07-02T12:00:00.000Z'),
  });

  expect(report.entries[0]?.weeklyGoalHours).toBe(40);
  expect(report.entries[0]?.periodMinimumHours).toBe(21); // 7 × 3 dias
  expect(report.entries[0]?.realizedHours).toBeCloseTo(16.54, 1);
  expect(report.entries[0]?.progressPercent).toBeCloseTo(41.35, 1);
});

it('permite progressPercent acima de 100% quando realizado excede meta semanal', async () => {
  // ... goal 32h, realized 40h
  expect(report.entries[0]?.progressPercent).toBeCloseTo(125, 1);
});

it('calcula periodMinimumHours null quando dailyMinimumHours ausente', async () => {
  // ... goal sem dailyMinimumHours
  expect(report.entries[0]?.periodMinimumHours).toBeNull();
});

it('desconta feriado do calendário no mínimo acumulado', async () => {
  // WorkCalendar com feriado na queda; seg–qua no período → 2 dias úteis × 7h = 14h
  expect(report.entries[0]?.businessDaysInPeriod).toBe(2);
  expect(report.entries[0]?.periodMinimumHours).toBe(14);
});

it('desconta PTO individual do mínimo acumulado', async () => {
  // PlannedAbsence active na quarta; seg–qua → 2 dias × 7h = 14h
  expect(report.entries[0]?.periodMinimumHours).toBe(14);
});
```

Atualizar teste existente `'retorna relatório semanal com meta, realizado e progresso'`:

```typescript
// Antes: weeklyGoalHours ≈ 4.57 (rateado)
// Depois:
expect(report.entries[0]?.weeklyGoalHours).toBe(8);
expect(report.entries[0]?.progressPercent).toBeCloseTo(25, 1); // 2h / 8h
```

Atualizar teste `'soma horas apenas dentro do intervalo customizado'`:

```typescript
// Antes: weeklyGoalHours = 1 (rateado)
// Depois:
expect(report.entries[0]?.weeklyGoalHours).toBe(7);
expect(report.entries[0]?.periodMinimumHours).toBeNull(); // sem mínimo diário no seed
expect(report.entries[0]?.progressPercent).toBeCloseTo(14.29, 1); // 1h / 7h
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
wsl npm run test --workspace=backend -- goalsService.test.ts
```

Expected: FAIL — `weeklyGoalHours` ainda rateado, `periodMinimumHours` undefined.

- [ ] **Step 3: Implementar correção mínima**

Em `GoalWeeklyReportEntry`, adicionar campos:

```typescript
/** Mínimo diário acumulado no período (dailyMinimum × dias úteis efetivos), ou null */
periodMinimumHours: number | null;
/** Dias úteis do colaborador no intervalo (calendário − feriados − PTO) */
businessDaysInPeriod: number;
```

No início de `getGoalsWeeklyReport`, carregar calendário e ausências:

```typescript
const [calendar, plannedAbsencesByDiscordId] = await Promise.all([
  getWorkCalendarForGuild(organizationId, input.guildId),
  loadPlannedAbsencesByDiscordId(organizationId, input.guildId, discordIds),
]);
```

Helper local `loadPlannedAbsencesByDiscordId` — copiar padrão de `inactivityService.getPlannedAbsencesByDiscordId` (status `scheduled` | `active`).

Alterar mapeamento por `trackedUser`:

```typescript
const configuredWeeklyGoal = goal?.weeklyCollaborationHours ?? null;
const dailyMinimum = goal?.dailyMinimumHours ?? null;
const userAbsences = plannedAbsencesByDiscordId.get(trackedUser.discordId) ?? [];

const businessDaysInPeriod = countInclusiveBusinessDaysInPeriod(
  calendar,
  periodStart,
  periodEnd,
  (date) => isOnPlannedAbsence(userAbsences, date),
);

const periodMinimumHours =
  dailyMinimum && dailyMinimum > 0 && businessDaysInPeriod > 0
    ? Number((dailyMinimum * businessDaysInPeriod).toFixed(2))
    : null;

const progressPercent =
  configuredWeeklyGoal && configuredWeeklyGoal > 0
    ? Number(((realizedHours / configuredWeeklyGoal) * 100).toFixed(2))
    : 0;

return {
  // ...
  weeklyGoalHours: configuredWeeklyGoal,
  periodMinimumHours,
  businessDaysInPeriod,
  dailyMinimumHours: dailyMinimum,
  realizedHours,
  progressPercent,
  shouldAlertLowProgress: configuredWeeklyGoal
    ? shouldTriggerLowProgressThursdayAlert(referenceDate, progressPercent)
    : false,
};
```

Remover `prorateWeeklyGoalHours` e import de `countInclusiveUtcDays` se não houver outros usos.

- [ ] **Step 4: Rodar testes e confirmar sucesso**

```bash
wsl npm run test --workspace=backend -- goalsService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/goalsService.ts backend/tests/services/goalsService.test.ts
git commit -m "fix(goals): meta semanal, mínimo por dias úteis e calendário"
```

---

### Task 2: Atualizar export CSV e OpenAPI

**Files:**
- Modify: `backend/src/api/routes/export.ts`
- Modify: `backend/src/api/routes/goals.ts`
- Test: `backend/tests/api/exportRoutes.test.ts`

- [ ] **Step 1: Atualizar teste de export se necessário**

Verificar mock em `exportRoutes.test.ts` — `weeklyGoalHours: 12` continua válido (agora é valor configurado, não rateado).

- [ ] **Step 2: Adicionar coluna `periodMinimumHours` no CSV (opcional mas útil)**

Em `export.ts`, incluir após `weeklyGoalHours`:

```typescript
'periodMinimumHours',
// ...
entry.periodMinimumHours ?? '',
```

- [ ] **Step 3: Documentar novos campos no Swagger**

No bloco `@openapi` de `GET .../reports/goals`, documentar:

```yaml
weeklyGoalHours:
  description: Meta semanal configurada do colaborador (horas)
periodMinimumHours:
  description: Mínimo diário × dias úteis efetivos (calendário − feriados − PTO)
businessDaysInPeriod:
  description: Dias úteis do colaborador no intervalo selecionado
progressPercent:
  description: Percentual sobre meta semanal (pode exceder 100)
```

- [ ] **Step 4: Rodar testes backend**

```bash
wsl npm run test --workspace=backend
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/routes/export.ts backend/src/api/routes/goals.ts backend/tests/api/exportRoutes.test.ts
git commit -m "docs(goals): documentar periodMinimumHours e meta semanal no export"
```

---

### Task 3: Helper compartilhado de status visual (frontend)

**Files:**
- Create: `frontend/src/app/core/goals/goal-progress.util.ts`
- Create: `frontend/src/app/core/goals/goal-progress.util.spec.ts`

- [ ] **Step 1: Escrever testes que falham**

```typescript
// frontend/src/app/core/goals/goal-progress.util.spec.ts
import { resolveGoalProgressStatus, goalProgressBarClass } from './goal-progress.util';

describe('goal-progress.util', () => {
  it('retorna below_minimum quando realizado abaixo do mínimo acumulado', () => {
    expect(resolveGoalProgressStatus({
      weeklyGoalHours: 40,
      periodMinimumHours: 21,
      realizedHours: 16.54,
    })).toBe('below_minimum');
  });

  it('retorna on_track entre mínimo e meta semanal', () => {
    expect(resolveGoalProgressStatus({
      weeklyGoalHours: 40,
      periodMinimumHours: 21,
      realizedHours: 25,
    })).toBe('on_track');
  });

  it('retorna exceeded quando realizado >= meta semanal', () => {
    expect(resolveGoalProgressStatus({
      weeklyGoalHours: 40,
      periodMinimumHours: 21,
      realizedHours: 42,
    })).toBe('exceeded');
  });

  it('retorna on_track quando periodMinimumHours é null', () => {
    expect(resolveGoalProgressStatus({
      weeklyGoalHours: 40,
      periodMinimumHours: null,
      realizedHours: 10,
    })).toBe('on_track');
  });

  it('mapeia status para classes Tailwind', () => {
    expect(goalProgressBarClass('below_minimum')).toContain('gray');
    expect(goalProgressBarClass('on_track')).toContain('success');
    expect(goalProgressBarClass('exceeded')).toContain('brand');
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
wsl npm run test --workspace=frontend -- --include='**/goal-progress.util.spec.ts'
```

- [ ] **Step 3: Implementar helper**

```typescript
// frontend/src/app/core/goals/goal-progress.util.ts

/** Status visual de progresso de meta individual. */
export type GoalProgressStatus = 'no_goal' | 'below_minimum' | 'on_track' | 'exceeded';

/** Entrada mínima para resolver status de meta. */
export interface GoalProgressInput {
  weeklyGoalHours: number | null;
  periodMinimumHours: number | null;
  realizedHours: number;
}

/**
 * Resolve status visual de meta vs realizado.
 * @param input Meta semanal, mínimo acumulado e horas realizadas
 * @returns Status para cor da barra e badges
 */
export function resolveGoalProgressStatus(input: GoalProgressInput): GoalProgressStatus {
  const { weeklyGoalHours, periodMinimumHours, realizedHours } = input;

  if (!weeklyGoalHours || weeklyGoalHours <= 0) {
    return 'no_goal';
  }
  if (realizedHours >= weeklyGoalHours) {
    return 'exceeded';
  }
  if (periodMinimumHours != null && realizedHours < periodMinimumHours) {
    return 'below_minimum';
  }
  return 'on_track';
}

/**
 * Retorna classe Tailwind da barra de progresso conforme status.
 * @param status Status resolvido
 * @returns Classe CSS da barra preenchida
 */
export function goalProgressBarClass(status: GoalProgressStatus): string {
  switch (status) {
    case 'below_minimum':
      return 'bg-gray-400 dark:bg-gray-500';
    case 'on_track':
      return 'bg-success-500';
    case 'exceeded':
      return 'bg-brand-500';
    default:
      return 'bg-gray-200 dark:bg-gray-700';
  }
}

/**
 * Calcula largura da barra (0–100) proporcional à meta semanal.
 * @param realizedHours Horas realizadas
 * @param weeklyGoalHours Meta semanal configurada
 * @returns Percentual de largura para CSS
 */
export function goalProgressBarWidth(realizedHours: number, weeklyGoalHours: number | null): number {
  if (!weeklyGoalHours || weeklyGoalHours <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (realizedHours / weeklyGoalHours) * 100));
}
```

- [ ] **Step 4: Rodar teste e confirmar sucesso**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/goals/
git commit -m "feat(frontend): helper de status visual para metas individuais"
```

---

### Task 4: Configurações → Metas (UI)

**Files:**
- Modify: `frontend/src/app/features/settings/goals/goals-settings.component.ts`
- Modify: `frontend/src/app/features/settings/goals/goals-settings.component.html`

- [ ] **Step 1: Estender DTO local**

```typescript
interface GoalsReportEntryDto {
  // ... campos existentes
  periodMinimumHours: number | null;
  businessDaysInPeriod: number;
}
```

- [ ] **Step 2: Adicionar métodos delegando ao helper**

```typescript
import {
  goalProgressBarClass,
  goalProgressBarWidth,
  resolveGoalProgressStatus,
  type GoalProgressStatus,
} from '../../../core/goals/goal-progress.util';

getGoalStatus(entry: GoalsReportEntryDto): GoalProgressStatus {
  return resolveGoalProgressStatus(entry);
}

getGoalBarClass(entry: GoalsReportEntryDto): string {
  return goalProgressBarClass(this.getGoalStatus(entry));
}

getGoalBarWidth(entry: GoalsReportEntryDto): number {
  return goalProgressBarWidth(entry.realizedHours, entry.weeklyGoalHours);
}
```

- [ ] **Step 3: Atualizar template**

Substituir bloco de cada `article` em “Meta vs realizado por categoria” por:

```html
<article *ngFor="let entry of group.entries" class="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
  <p class="font-semibold text-gray-800 dark:text-white/90">{{ entry.displayName }}</p>

  <div class="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
    <div
      class="h-full rounded-full transition-all"
      [ngClass]="getGoalBarClass(entry)"
      [style.width.%]="getGoalBarWidth(entry)"
    ></div>
  </div>

  <p class="mt-2 text-gray-600 dark:text-gray-300">
    Meta semanal: {{ entry.weeklyGoalHours ?? 'não aplicada' }}{{ entry.weeklyGoalHours ? 'h' : '' }}
    · Realizado: {{ entry.realizedHours }}h
    · Progresso: {{ entry.progressPercent }}%
  </p>
  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
    Dias úteis no período: {{ entry.businessDaysInPeriod }}
    · Mínimo acumulado: {{ entry.periodMinimumHours ?? '-' }}{{ entry.periodMinimumHours ? 'h' : '' }}
    · Mínimo diário: {{ entry.dailyMinimumHours ?? '-' }}h
  </p>
</article>
```

- [ ] **Step 4: Rodar testes frontend**

```bash
wsl npm run test --workspace=frontend
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/settings/goals/
git commit -m "feat(settings): barra colorida e meta semanal em metas por categoria"
```

---

### Task 5: Relatórios → Metas Semanais (UI)

**Files:**
- Modify: `frontend/src/app/features/reports/goals/goals-report.component.ts`
- Modify: `frontend/src/app/features/reports/goals/goals-report.component.html`
- Modify: `frontend/src/app/features/reports/goals/goals-report.component.spec.ts`

- [ ] **Step 1: Estender DTO e reutilizar helper** (mesmo padrão da Task 4)

- [ ] **Step 2: Atualizar `getProgressText`**

```typescript
getProgressText(entry: GoalReportEntryDto): string {
  if (!entry.weeklyGoalHours) {
    return `${entry.realizedHours.toFixed(2)}h realizadas (sem meta aplicada)`;
  }
  if (entry.realizedHours >= entry.weeklyGoalHours) {
    const excess = entry.realizedHours - entry.weeklyGoalHours;
    return `${entry.realizedHours.toFixed(2)}h / ${entry.weeklyGoalHours.toFixed(2)}h (+${excess.toFixed(2)}h acima)`;
  }
  return `${entry.realizedHours.toFixed(2)}h / ${entry.weeklyGoalHours.toFixed(2)}h`;
}
```

- [ ] **Step 3: Substituir barra fixa `bg-brand-500` por barra dinâmica**

Trocar em `goals-report.component.html`:

```html
<div
  class="h-full rounded-full transition-all"
  [ngClass]="getGoalBarClass(entry)"
  [style.width.%]="getGoalBarWidth(entry)"
></div>
```

- [ ] **Step 4: Ampliar spec com mock contendo `periodMinimumHours`**

```typescript
it('aplica classe cinza quando abaixo do mínimo acumulado', () => {
  // flush report com entry abaixo do mínimo
  // expect bar element classList to contain 'gray'
});
```

- [ ] **Step 5: Rodar testes frontend**

```bash
wsl npm run test --workspace=frontend
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/reports/goals/
git commit -m "feat(reports): cores de meta semanal e progresso sem teto de 100%"
```

---

### Task 6: Verificação final

- [ ] **Step 1: Testes completos**

```bash
wsl npm test
```

Expected: backend + frontend PASS

- [ ] **Step 2: Smoke manual**

1. Abrir `/app/settings/goals` → meta deve mostrar **40h** (não 17.14h) para categorias com template 40h.
2. Abrir `/app/reports/goals` → preset “Esta semana” → mesmos valores.
3. Colaborador com ~16h e meta 40h → barra **cinza** (abaixo de 21h = 7h × 3 dias úteis seg–qua).
4. Cadastrar feriado na quarta em Configurações → Calendário → mínimo acumulado cai para **14h** (2 dias).
5. Colaborador em PTO na quarta → mesmo efeito (14h de mínimo).
6. Colaborador com ≥ 40h → barra **azul** e texto de excedente.
7. Colaborador entre mínimo acumulado e meta → barra **verde**.

- [ ] **Step 3: Commit final se houver ajustes**

---

## Self-review (spec vs plano)

| Requisito do usuário | Task |
|----------------------|------|
| Meta 40h em “Esta semana”, não 17.14h | Task 1 |
| Respeitar calendário (jornada + feriados) | Task 0 + Task 1 |
| Descontar PTO no mínimo acumulado | Task 1 |
| Mesmo bug em Configurações e Relatórios | Tasks 4 e 5 (mesma API) |
| Cinza abaixo do mínimo | Tasks 3–5 |
| Verde dentro do mínimo / em progresso | Tasks 3–5 |
| Azul excedente | Tasks 3–5 |
| Progresso coerente | Task 1 |

**Ambiguidade resolvida:** “dentro do mínimo realizado” = realizado ≥ `periodMinimumHours` e < meta semanal → verde.

**Nota:** A meta semanal exibida (40h) permanece fixa; o calendário afeta **somente** o mínimo acumulado e o status cinza/verde — não rateia a meta semanal.

---

## Execução

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-goals-display-and-progress.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — subagente por task, revisão entre tasks

**2. Inline Execution** — executar nesta sessão com checkpoints

**Which approach?**
