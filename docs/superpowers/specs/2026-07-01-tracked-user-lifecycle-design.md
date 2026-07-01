# Ciclo de vida do membro rastreado — desativação ao sair do Discord

**Data:** 2026-07-01  
**Status:** Aprovado

## Problema

Membros que **saíram do servidor Discord** permanecem em `tracked_users` e continuam aparecendo em relatórios operacionais (quem sumiu, ranking, conquistas, metas, etc.).

**Causa raiz:** `syncTrackedUsersFromDiscordGuild` só faz upsert; não existe desativação, evento `guildMemberRemove` nem flag de status no modelo.

## Objetivo

Sincronizar o conjunto de membros monitorados com os membros **atualmente presentes** no servidor Discord, **sem apagar** dados históricos (sessões, snapshots, metas, categorias).

## Decisões de produto

| Decisão | Escolha |
|---------|---------|
| Gatilho de remoção | Saída do servidor Discord (kick/ban/saiu) |
| Preservação de histórico | Sim — soft delete, nunca hard delete no MVP |
| Reentrada no servidor | Reativação **automática**, mantendo histórico e categoria |
| Remoção manual pelo gestor | Fora do escopo deste MVP |
| UI de membros inativos | Fora do escopo — só feedback no sync |

## Modelo de dados

### Campos novos em `TrackedUser`

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `isActive` | `boolean` | `true` | `false` = não participa de relatórios operacionais |
| `removedAt` | `Date?` | — | Timestamp da desativação |
| `removedReason` | `'left_guild'` | — | Motivo (extensível no futuro) |

Documentos existentes sem `isActive` tratados como `true` via default do schema.

**Não alterar:** `categoryId`, metas, snapshots, sessões — permanecem vinculados ao mesmo `_id`.

## Comportamento da sincronização

`POST /org/:orgId/guilds/:guildId/tracked-users/sync` e sync no `ready` do bot:

1. Lista membros humanos atuais do Discord.
2. **Upsert** cada membro (como hoje) + garante `isActive: true`.
3. **Reativa** registros existentes inativos que voltaram ao servidor.
4. **Desativa** registros ativos cujo `discordId` não está mais no servidor.

Resposta ampliada:

```json
{
  "syncedCount": 42,
  "deactivatedCount": 3,
  "reactivatedCount": 1,
  "members": []
}
```

## Eventos do bot

| Evento | Ação |
|--------|------|
| `guildMemberRemove` | Desativar `TrackedUser` do tenant/guild (`left_guild`) |
| `guildMemberAdd` | Reativar se existir; senão upsert |
| `presence` / `voice` / `upsertTrackedUser` | Sempre `isActive: true` ao persistir |

Handlers registrados apenas para guilds monitorados (`listEnabledMonitoredGuilds`).

## Filtro em relatórios operacionais

Helper central `findActiveTrackedUsers(organizationId, guildId)` retorna apenas `isActive: true`.

Aplicar em:

- `intradayInactivityService` — quem sumiu hoje
- `inactivityService.generateWeeklyInactivitySnapshot` — snapshot semanal
- `gamificationRankingService`
- `gamificationInsightsService`
- `goalsService` — listagens operacionais
- `trackedUserService.listTrackedUsers` — UI de categorias
- `textCollaborationReportService` — lookup com `isActive: true`
- `listTrackedGuildIdsByOrganization` — crons só em guilds com membros ativos

**Exceções (permite inativo):**

- `getInactivityHistory(trackedUserId)` — histórico por membro
- `memberJourneyService` — consulta por ID específico
- Snapshots **já persistidos** — não reprocessar

**Portal `/me`:** vincular Discord e gamificação exige `isActive: true`.

## UI (frontend)

- `TrackedMembersService` / tela de categorias: exibir contadores do sync (`deactivatedCount`, `reactivatedCount`).
- Lista de membros: apenas ativos (vem da API).

## Migração / dados existentes

Sem script separado: primeira sync pós-deploy (manual ou `ready` do bot) desativa fantasmas automaticamente.

## Testes obrigatórios

- Sync desativa quem saiu e reativa quem voltou.
- `guildMemberRemove` desativa imediatamente.
- `guildMemberAdd` reativa membro existente.
- Ranking e inatividade não incluem inativos.
- Histórico de membro inativo permanece acessível.
- `upsertTrackedUser` reativa ao receber evento do bot.
- Tenant isolation preservado.

## Fora de escopo

- Remoção manual pelo gestor (`removedReason: 'manual'`)
- Tela de auditoria de membros inativos
- Purge/LGPD de dados após retenção
- Hard delete de `TrackedUser`
