# Inatividade híbrida — alerta intradiário + relatório semanal

**Data:** 2026-06-24  
**Status:** Implementado

## Objetivo

Complementar o relatório semanal "quem sumiu" com alertas **intradiários** baseados na jornada configurada em `WorkCalendar`, sem breaking change na API semanal existente.

## Campos adicionais em `InactivitySettings`

| Campo | Default | Descrição |
|-------|---------|-----------|
| `lateStartThresholdPercent` | 30 | % da jornada já decorrida sem sinal → alerta "ainda não apareceu" |
| `minCollaborationPercentOfElapsed` | 20 | % mínimo de colaboração em voz vs. tempo útil já passado |

Campos legados (`inactiveAfterBusinessDays`, `zeroVoiceCollaborationDays`) permanecem para o relatório semanal.

## Status intradiários

| Status | Critério |
|--------|----------|
| `not_started` | Dia útil, após `lateStartThresholdPercent`, sem presença/voz/texto |
| `low_collaboration_today` | Apareceu, mas colaboração em voz < `minCollaborationPercentOfElapsed` |
| `on_planned_absence` | PTO/férias ativa |
| `outside_work_day` / `outside_work_hours` | Fora da jornada |
| `ok` | Dentro dos critérios |

## API

- `GET /guilds/:guildId/reports/inactivity/intraday` — alerta do dia
- `GET /guilds/:guildId/reports/inactivity/history?trackedUserId=` — timeline semanal por membro
- `GET/PUT /guilds/:guildId/inactivity-settings` — limiares semanal + intradiário

## UI

- Dashboard: widgets "Quem sumiu hoje" + "Quem sumiu esta semana"
- `/settings/inactivity` — configuração unificada
- `/reports/inactivity` — histórico semanal (inalterado, enriquecido)
- `/reports/absences` — ausências ativas

## Webhook e push

Cron diário enfileira `member.inactivity.detected` quando há membros `missing`. Push respeita `notifyManagerPush`.
