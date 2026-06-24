# AGENTS.md — Syntra (discord-tracker)

Guia para agentes de IA e desenvolvedores que trabalham neste monorepo.

## Visão geral

**Syntra** é um SaaS B2B de analytics de **colaboração** para times remotos no Discord — foco em **quem sumiu**. Monorepo: `backend/` (API + bot) + `frontend/` (Angular 21 + TailAdmin + PWA).

| Documento | Conteúdo |
|-----------|----------|
| [README.md](README.md) | Instalação, rotas, API, gamificação, admin |
| [Design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md) | Arquitetura, modelos, fases, decisões |
| [backend/AGENTS.md](backend/AGENTS.md) | Regras e mapa de serviços do backend |
| [frontend/AGENTS.md](frontend/AGENTS.md) | Rotas UI, guards, convenções Angular |

## Estrutura do monorepo

```
discord-tracker/
├── backend/          # Node.js 22, Koa, Discord.js, Mongoose, Vitest
├── frontend/         # Angular 21, TailAdmin, PWA + Web Push, Karma
├── docs/
├── .github/workflows/
├── AGENTS.md         # este arquivo
└── package.json      # npm workspaces
```

## Comandos principais

```bash
npm ci
npm test                              # backend + frontend
npm run build                         # ambos workspaces
npm run dev:backend                   # API + bot :3000
npm run dev:frontend                  # ng serve :4200 (proxy /api)

# Seeds (dev)
npm run seed:plans --workspace=backend
npm run seed:discord-app --workspace=backend
```

## Papéis e autorização

### Plataforma (`PlatformUser`)

| Flag / papel | Escopo |
|--------------|--------|
| `isSuperAdmin: true` | Painel `/admin/*`, rotas `/api/v1/admin/*` |
| Membership em `Organization` | Papéis tenant: `owner`, `admin`, `manager`, `viewer` |

Super admin **não** é role de tenant — é flag em `PlatformUser`. Guard frontend: `superAdminGuard`. Middleware backend: `superAdminMiddleware`.

### Tenant (por organização)

| Papel | Leitura relatórios | Configurações | Gamificação |
|-------|-------------------|---------------|-------------|
| `viewer` | Sim | Não | Ranking/conquistas (visibilidade aplicada) |
| `manager` | Sim | Sim (maioria) | Config + visão completa |
| `admin` / `owner` | Sim | Sim | Tudo |

Toda rota `/api/v1/org/:orgId/*` passa por `jwtAuth` + `tenantMiddleware` — `organizationId` vem do JWT, validado contra membership.

## Mapa funcional (estado atual)

| Domínio | Backend (services) | Frontend |
|---------|-------------------|----------|
| Auth / OAuth | `platformAuthService`, `authService` | `core/auth/*` |
| Discord bot | `discordApplicationService`, `bot/` | `/app/settings/discord`, `/admin/discord` |
| Canais / regras | `channelClassifier`, `channels` routes | `/app/settings/channels` |
| Categorias / membros | `trackedUserService`, `categories` | `/app/settings/categories` |
| Calendário / PTO | `workCalendarService`, `plannedAbsenceService` | `/app/settings/calendar`, `absences` |
| Inatividade (core) | `inactivityService`, cron | `/app/reports/inactivity`, dashboard |
| Metas individuais | `goalsService` | `/app/settings/goals`, `/app/reports/goals` |
| Gamificação | `gamificationService`, `gamificationRankingService`, `gamificationInsightsService` | settings + reports ranking/achievements + `/me` |
| Dashboard ao vivo | `dashboardLiveService`, WebSocket | `/app/live` |
| Billing | `billingService` + Stripe webhooks | landing pricing |
| Super Admin | `adminPlanService`, `adminPlatformService` | `/admin/*` |
| Portal colaborador | rotas `/me/*` | `/app/me` |
| Onboarding | `onboarding` routes | `/app/onboarding` (8 passos) |

## Regras invioláveis

1. **Multitenant:** toda query inclui `organizationId` — nunca confiar em ID vindo do client sem validar membership.
2. **Canais:** regras AFK/almoço/ignorados **somente via UI/API** — **proibido** env vars de canal.
3. **Discord bot:** token, client id/secret e guild monitorado **somente via UI** — **proibido** `DISCORD_*` env em produção.
4. **Privacidade:** nunca armazenar conteúdo de mensagens, áudio ou DMs.
5. **Testes:** PR não mergeia sem testes backend e frontend passando (CI).
6. **JSDoc:** todo export público do backend documentado; rotas com anotações OpenAPI.
7. **UI-first:** config de negócio no banco — ENV só infra.
8. **Colaboração:** nunca usar “produtividade” na UI — só **colaboração** / **horas colaborativas**.
9. **Core feature:** inatividade (“quem sumiu”) + metas **individuais** + calendário/PTO + sinais texto (metadados).
10. **Planos:** features de gamificação/ranking enforced no backend (`Plan.features` + `GamificationSettings`).

## Gamificação (resumo para agentes)

- **Config:** `GET/PUT /org/:orgId/guilds/:guildId/gamification` — toggles + ranking (métrica, período, visibilidade, top N).
- **Ranking:** `GET .../gamification/ranking` — respeita settings; UI em `/app/reports/ranking`.
- **Badges + streaks:** calculados on-read em `gamificationInsightsService` (sem collection de conquistas no MVP).
  - Pacotes: `minimal` | `standard` | `full` (`badges.presetPack`).
  - UI time: `/app/reports/achievements`; colaborador: `GET /me/gamification`.
- **Plano Team+** precisa ter `features.gamification` e `features.ranking` **true** no documento `Plan` — editável em `/admin/plans` (inclui checkboxes de features).

## Performance (mínimo)

- API p95 relatórios < 300 ms
- Frontend bundle gzip < 500 KB (meta)
- Lazy loading de rotas Angular
- Índices MongoDB compostos com `organizationId`

## CI/CD

- `.github/workflows/ci.yml` — testes em PR
- `.github/workflows/deploy.yml` — deploy SSH em `main`

Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

## Antes de implementar

1. Ler seção relevante do [design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md)
2. Ler `AGENTS.md` da pasta (`backend/` ou `frontend/`)
3. Escrever testes junto com o código
4. Não expandir escopo além do pedido

## Checklist de PR

- [ ] Testes backend passam (`npm run test --workspace=backend`)
- [ ] Testes frontend passam (`npm run test --workspace=frontend`)
- [ ] Lint/typecheck sem erros
- [ ] JSDoc em novos exports (backend)
- [ ] Swagger atualizado se nova rota API
- [ ] Sem secrets no código
- [ ] UI responsiva (se alterou frontend)
- [ ] Terminologia UI: colaboração, não produtividade
