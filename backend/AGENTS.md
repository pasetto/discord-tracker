# AGENTS.md — Backend (Syntra API + Bot)

## Stack

- **Runtime:** Node.js ≥ 22
- **Linguagem:** TypeScript (strict)
- **HTTP:** Koa + `@koa/router`
- **Discord:** discord.js v14
- **Banco:** MongoDB + Mongoose
- **Testes:** Vitest + Supertest + mongodb-memory-server
- **Docs:** JSDoc + swagger-jsdoc + koa-swagger-ui
- **Logs:** Pino
- **Métricas:** prom-client (`/metrics`)
- **Realtime:** WebSocket em `/api/v1/ws/live` (`liveActivitySocket`)

## Estrutura de pastas

```
backend/src/
├── api/
│   ├── routes/              # Handlers por domínio (finos)
│   ├── middleware/          # jwtAuth, tenant, superAdmin, cors
│   ├── websocket/           # Live activity
│   └── server.ts
├── bot/                     # Discord client, events, recovery
├── config/
├── db/models/               # Schemas Mongoose multitenant
├── repositories/            # Acesso a dados
├── services/                # Lógica de negócio
├── workers/                 # Crons (inatividade, webhooks)
├── utils/
└── index.ts
```

## Mapa de rotas API (`/api/v1`)

### Públicas

| Prefixo | Arquivo | Notas |
|---------|---------|-------|
| `/auth/*` | `auth.ts` | login, register, refresh |
| `/public/*` | `public.ts` | config pública |
| `/health` | `health.ts` | healthcheck legado |
| `/health/live` | `health.ts` | liveness (processo vivo) |
| `/health/ready` | `health.ts` | readiness (PM2 `wait_ready`, Docker, LB) |
| `/health/alerts` | `health.ts` | SMTP/VAPID prontidão (booleans seguros) |
| `/webhooks/stripe` | `webhooks/stripe.ts` | Stripe events |
| `/admin/discord/bootstrap` | `adminDiscord.ts` | só dev — primeiro cadastro bot |

### Autenticadas (JWT)

| Prefixo | Middleware | Arquivo principal |
|---------|------------|-------------------|
| `/me/*` | jwtAuth | `me.ts` — portal colaborador, LGPD |
| `/org/:orgId/*` | jwtAuth + tenant | ver tabela abaixo |
| `/admin/*` | jwtAuth + superAdmin | `adminPlans`, `adminUsers`, `adminOrganizations`, `adminDiscord` |

### Por tenant (`/org/:orgId`)

| Recurso | Rotas (exemplos) | Service |
|---------|------------------|---------|
| Discord tenant | `/discord/*` | `discordSettings`, `discordGuildChannelService` |
| Canais | `/guilds/:guildId/channels` | `channelClassifier` + `ChannelRule` |
| Categorias | `/guilds/:guildId/categories` | models + repositories |
| Membros rastreados | `/guilds/:guildId/tracked-users` | `trackedUserService` |
| Calendário | `/work-calendar` | `workCalendarService` |
| Ausências PTO | `/guilds/:guildId/absences` | `plannedAbsenceService` |
| Inatividade | `/guilds/:guildId/inactivity/*` | `inactivityService` |
| Metas | `/guilds/:guildId/goals`, `/reports/goals` | `goalsService` |
| Gamificação | `/guilds/:guildId/gamification` | `gamificationService` |
| Ranking gamificado | `.../gamification/ranking` | `gamificationRankingService` |
| Conquistas | `.../gamification/insights` | `gamificationInsightsService` |
| Dashboard live | `/guilds/:guildId/dashboard/live` | `dashboardLiveService` |
| Onboarding | `/onboarding/*` | progresso 8 passos |
| Billing | `/billing/*` | `billingService` |
| Push | `/push/*` | web-push |
| Webhooks outbound | `/webhooks/*` | worker + HMAC |
| Export CSV | `/export/*` | relatórios |

### Super Admin (`/admin`)

| Rota | Service |
|------|---------|
| `GET/POST/PATCH /admin/plans` | `adminPlanService` |
| `GET/PATCH /admin/users` | `adminPlatformService` |
| `GET /admin/organizations` | `adminPlatformService` |
| `/admin/discord/*` | `discordApplicationService` |

## Serviços de gamificação

| Arquivo | Responsabilidade |
|---------|------------------|
| `gamificationService.ts` | CRUD settings; enforcement de `Plan.features` |
| `gamificationRankingService.ts` | Ranking por métrica/período/visibilidade |
| `gamificationInsightsService.ts` | Badges (on-read) + streaks |

Model: `GamificationSettings` — `enabled`, `ranking.*`, `badges.presetPack`, `streaks.minProductiveHoursPerDay`.

**Badges por pacote:**

- `minimal`: Madrugador, Colaborador
- `standard`: + Campeão de voz
- `full`: + Sinal de texto, Presença constante

## Convenções de código

### JSDoc (obrigatório)

Todo **export** (função, classe, interface, tipo, constante pública) deve ter JSDoc completo com `@param`, `@returns`, `@throws` quando aplicável.

### Rotas API

- Handlers finos — delegar para `services/`
- Cada rota: bloco `@openapi` para Swagger
- Erros: `{ error: string }` (padronizar gradualmente)

### Multitenant

```typescript
// CORRETO — organizationId do contexto tenant (JWT + middleware)
const organizationId = ctx.state.organizationId;
await Model.find({ organizationId, guildId });

// PROIBIDO — confiar em orgId do body sem membership
```

### BotManager / DiscordApplication

- Token de `DiscordApplication` no MongoDB — **nunca** `DISCORD_TOKEN` em produção
- `NODE_ENV=production` → falha sem app ativo no banco
- Secrets com `ENCRYPTION_KEY` (AES-256-GCM)
- Guild via `GuildConnection` UI

### ChannelRule

- Regras de `ChannelRule` por guild — **proibido** env de canais
- Cache TTL ~60s; invalidar no PUT

### Inatividade (core)

- `InactivityService` — intraday + semanal, cron
- `InactivitySettings` por org/guild
- API: `/guilds/:guildId/inactivity/*`

### Metas individuais

- `UserCollaborationGoal` por `TrackedUser`
- `CategoryGoalTemplate` — aplica metas por membro
- **Proibido** meta agregada de equipe

### Webhooks outbound

- Fila `WebhookDelivery` — worker com retry + HMAC

## Swagger

- UI: `GET /api/v1/docs`
- JSON: `GET /api/v1/docs/openapi.json`

## Testes (obrigatório)

```bash
npm run test              # Vitest
npm run test:coverage     # threshold 80%
```

**Sempre testar:** tenant isolation, plan feature enforcement, channel rules sem env.

## PM2 cluster (produção)

```bash
npm run build
npm run start:pm2   # ecosystem.config.js — cluster + wait_ready
```

- **Cluster:** `exec_mode: cluster`, instâncias via `PM2_INSTANCES` (padrão `max`).
- **Ready:** após HTTP escutar, `process.send('ready')` — requer `wait_ready: true`.
- **Unhealthy:** Mongo desconectado → IPC `syntra:health` + `/health/ready` retorna 503.
- **Bot/crons:** só na instância `0` (ou `SYNTA_ENABLE_BACKGROUND_JOBS=true`).
- **Reload gracioso:** `shutdown_with_message` + handler `shutdown` no processo.
- **WebSocket:** em cluster, usar sticky sessions no load balancer.

## Scripts

```bash
npm run dev               # tsx watch — API + bot
npm run build             # tsc
npm run start:pm2         # PM2 cluster produção
npm run seed:plans        # catálogo Starter/Team
npm run seed:discord-app  # bot + super admin dev
```

## Variáveis de ambiente (somente infra)

`MONGODB_URI`, `ENCRYPTION_KEY`, `JWT_SECRET`, `VAPID_*`, `STRIPE_*`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `PM2_INSTANCES`, `SYNTA_ENABLE_BACKGROUND_JOBS`.

**Proibido em produção:** `DISCORD_*`, regras de canal via env.

## Anti-patterns

- Lógica de negócio pesada em routes
- Query sem `organizationId`
- `process.env.DISCORD_TOKEN` em runtime (produção)
- Retornar bot token em GET
- Webhook síncrono no handler HTTP
- Export sem JSDoc
- Editar `Plan` sem incluir `features` completas (quebra gamificação)
