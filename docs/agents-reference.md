# Syntra — referência para agentes (lazy-load)

Carregar este arquivo **somente** quando a tarefa precisar de mapa funcional, CI, gamificação detalhada ou papéis. O bootstrap always-on fica em [AGENTS.md](../AGENTS.md).

## Estrutura do monorepo

```
discord-tracker/
├── backend/          # Node.js 22, Koa, Discord.js, Mongoose, Vitest
├── frontend/         # Angular 21, TailAdmin, PWA + Web Push, Karma
├── docs/
├── .github/workflows/
├── AGENTS.md         # bootstrap mínimo
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

## Gamificação (detalhe)

- **Config:** `GET/PUT /org/:orgId/guilds/:guildId/gamification` — toggles + ranking (métrica, período, visibilidade, top N).
- **Ranking:** `GET .../gamification/ranking` — respeita settings; UI em `/app/reports/ranking`.
- **Badges + streaks:** calculados on-read em `gamificationInsightsService` (sem collection de conquistas no MVP).
  - Pacotes: `minimal` | `standard` | `full` (`badges.presetPack`).
  - UI time: `/app/reports/achievements`; colaborador: `GET /me/gamification`.
- **Plano Team+** precisa ter `features.gamification` e `features.ranking` **true** no documento `Plan` — editável em `/admin/plans`.

## Performance (mínimo)

- API p95 relatórios < 300 ms
- Frontend bundle gzip < 500 KB (meta)
- Lazy loading de rotas Angular
- Índices MongoDB compostos com `organizationId`

## CI/CD

- `.github/workflows/ci.yml` — lint + testes + cobertura + build em todo PR e push para `main` / `dev` / `develop`
- `.github/workflows/deploy.yml` — deploy SSH em `main`
- **Branch protection** em `main` e `dev`: merge bloqueado sem os **required checks** do `ci.yml`:
  1. `Backend (Vitest + lint)`
  2. `Frontend (Karma + build)`
  3. `Frontend E2E (Playwright)`
- Template de PR: `.github/PULL_REQUEST_TEMPLATE.md`

Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

## Checklist de PR (espelho)

- [ ] Testes **gerados/atualizados** no(s) workspace(s) alterado(s) (FE e BE se full-stack)
- [ ] Testes backend passam (`npm run test --workspace=backend`) — se `backend/` mudou
- [ ] Testes frontend passam (`npm run test --workspace=frontend`) — se `frontend/` mudou
- [ ] Jobs CI verdes: Backend, Frontend, Frontend E2E
- [ ] Lint/typecheck sem erros
- [ ] JSDoc em novos exports (backend)
- [ ] Swagger atualizado se nova rota API
- [ ] Sem secrets no código
- [ ] UI responsiva (se alterou frontend)
- [ ] Terminologia UI: colaboração, não produtividade

## Autoria Git

Fonte canônica: [`.cursor/rules/git-authorship.mdc`](../.cursor/rules/git-authorship.mdc) (`Eduardo Pasetto` / `eduardo@nanodesign.com.br`). Não duplicar em instructions de agent.
