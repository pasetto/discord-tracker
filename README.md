# Syntra

SaaS B2B de **colaboração** para times remotos no Discord — foco em **quem sumiu**: inatividade, ausências planejadas (PTO), metas individuais, sinais de texto (somente metadados) e gamificação opcional (ranking, badges, streaks).

Monorepo **npm workspaces**: `backend/` (API + bot Discord) + `frontend/` (Angular 21 + TailAdmin + PWA).

| Documento | Conteúdo |
|-----------|----------|
| [Design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md) | Arquitetura, modelos, API, fases |
| [Plano de implementação](docs/superpowers/plans/2026-06-20-syntra-saas-implementation.md) | Tasks por fase |
| [AGENTS.md](AGENTS.md) | Regras gerais para agentes e desenvolvedores |
| [backend/AGENTS.md](backend/AGENTS.md) | Mapa de rotas API, serviços, convenções backend |
| [frontend/AGENTS.md](frontend/AGENTS.md) | Rotas UI, guards, integração API |

---

## Funcionalidades (MVP)

### Core — quem sumiu

| Área | Backend | Frontend |
|------|---------|----------|
| Inatividade intraday/semanal | `InactivityService` + cron | `/app/dashboard`, `/app/reports/inactivity` |
| Calendário + feriados BR | `WorkCalendar` | `/app/settings/calendar` |
| PTO / ausências | `PlannedAbsence` | `/app/settings/absences`, `/app/reports/absences` |
| Metas individuais | `UserCollaborationGoal` | `/app/settings/goals`, `/app/reports/goals` |
| Sinais de texto (metadados) | `TextActivityEvent` | — |

### Operação do time

| Área | Backend | Frontend |
|------|---------|----------|
| Bot Discord multitenant | `DiscordApplication`, `GuildConnection` | `/app/settings/discord` |
| Regras de canais | `ChannelRule` | `/app/settings/channels` |
| Categorias + membros rastreados | `trackedUserService` | `/app/settings/categories` |
| Dashboard ao vivo + WebSocket | `dashboardLiveService`, `/ws/live` | `/app/live` |
| Onboarding 8 passos | API de progresso | `/app/onboarding` |
| Portal colaborador LGPD | `/me/*` | `/app/me` |

### Gamificação (plano Team+)

| Área | Backend | Frontend |
|------|---------|----------|
| Config por guild | `gamificationService` | `/app/settings/gamification` |
| Ranking configurável | `gamificationRankingService` | `/app/reports/ranking` |
| Badges + streaks (on-read) | `gamificationInsightsService` | `/app/reports/achievements`, `/app/me` |

### Plataforma

| Área | Backend | Frontend |
|------|---------|----------|
| Auth email + OAuth Discord | JWT access/refresh | login, signup, guards |
| Billing Stripe BRL | checkout + webhooks | landing pricing |
| Super Admin | `adminPlanService`, `adminPlatformService` | `/admin/*` |
| Web Push (VAPID) | subscribe + alertas | PWA |
| Webhooks outbound | HMAC + worker | — |
| Export CSV + audit | `/export`, audit log | `/me` data-export |
| Swagger | `/api/v1/docs` | — |

---

## Papéis e autorização

### Plataforma (`PlatformUser`)

| Flag | Acesso |
|------|--------|
| `isSuperAdmin: true` | Painel `/admin/*`, API `/api/v1/admin/*` |

Não é role de tenant — é flag na conta da plataforma. Promovido em `/admin/users` ou via seed/MongoDB.

### Tenant (por organização)

| Papel | Relatórios | Configurações | Gamificação |
|-------|------------|---------------|-------------|
| `viewer` | Sim | Não | Ranking/conquistas (visibilidade aplicada) |
| `manager` | Sim | Maioria | Config + visão completa |
| `admin` / `owner` | Sim | Tudo | Tudo |

Toda rota `/api/v1/org/:orgId/*` valida membership via JWT + `tenantMiddleware`.

---

## Navegação (gestor)

| Rota | Função |
|------|--------|
| `/app/dashboard` | Início — alertas quem sumiu hoje/semana |
| `/app/live` | Time ao vivo — presença, movimentação, ranking operacional |
| `/app/reports/inactivity` | **Core** — relatório quem sumiu |
| `/app/reports/goals` | Metas vs horas colaborativas |
| `/app/reports/absences` | Ausências em andamento |
| `/app/reports/ranking` | Ranking gamificado (métrica/período configuráveis) |
| `/app/reports/achievements` | Badges e streaks do time |
| `/app/settings/*` | Discord, canais, categorias, calendário, PTO, metas, inatividade, gamificação |
| `/app/onboarding` | Setup inicial (8 passos) — fora da sidebar |
| `/app/me` | Portal do colaborador — dados próprios + conquistas |

**Sidebar:** Início · Time ao vivo · Relatórios · Configurações  
**Mobile:** bottom nav com os mesmos atalhos  
**Onboarding / Meu portal:** banner + menu do usuário

---

## Gamificação

### Planos

Features controladas em `Plan.features` (editável em `/admin/plans`):

| Feature | Plano típico |
|---------|--------------|
| `gamification` | Team+ |
| `ranking` | Team+ |

Se o ranking aparecer bloqueado com plano Team, verifique se o documento `Plan` no MongoDB tem `features.ranking: true` (re-seed: `npm run seed:plans --workspace=backend`).

### Configuração (`GamificationSettings`)

- **Toggles:** gamificação global, ranking, badges, streaks
- **Ranking:** métrica (horas colaborativas, voz, texto), período (dia/semana/mês), top N, visibilidade (todos / gestores / anônimo parcial)
- **Badges:** pacote `minimal` | `standard` | `full`
- **Streaks:** mínimo de horas colaborativas por dia para contar o dia

### Badges por pacote

| Pacote | Badges |
|--------|--------|
| `minimal` | Madrugador, Colaborador |
| `standard` | + Campeão de voz |
| `full` | + Sinal de texto, Presença constante |

Cálculo **on-the-fly** (sem histórico persistido no MVP) — baseado em sessões de voz, presença e eventos de texto.

### API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/org/:orgId/guilds/:guildId/gamification` | Config atual |
| `PUT` | `/org/:orgId/guilds/:guildId/gamification` | Atualizar config (manager+) |
| `GET` | `.../gamification/ranking` | Ranking do período |
| `GET` | `.../gamification/insights` | Badges + streaks do time |
| `GET` | `/me/gamification?guildId=` | Conquistas do colaborador logado |

---

## Painel Super Admin (`/admin`)

Acesso restrito a `isSuperAdmin: true` em `PlatformUser`.

| Rota UI | API | Função |
|---------|-----|--------|
| `/admin` | — | Visão geral |
| `/admin/plans` | `GET/POST/PATCH /api/v1/admin/plans` | Planos — preço, limites, **features** |
| `/admin/users` | `GET/PATCH /api/v1/admin/users` | Contas; promover/revogar super admin |
| `/admin/organizations` | `GET /api/v1/admin/organizations` | Tenants e assinaturas |
| `/admin/discord` | `/api/v1/admin/discord/*` | Bot compartilhado da plataforma |

**Promover super admin (dev):**

```bash
npm run seed:discord-app --workspace=backend
# ou no MongoDB:
db.platformusers.updateOne({ email: "seu@email.com" }, { $set: { isSuperAdmin: true } })
```

Após login/refresh, o menu exibe **Painel da plataforma**.

---

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Backend | Node.js 22, TypeScript, Koa, discord.js 14, Mongoose, Vitest, Supertest |
| Frontend | Angular 21, Tailwind CSS 4, TailAdmin, Karma, Playwright |
| Infra | MongoDB 7, Docker Compose, GitHub Actions, Stripe, web-push |

---

## Estrutura do monorepo

```
discord-tracker/
├── backend/
│   ├── src/
│   │   ├── api/           # Rotas Koa, middleware, Swagger, WebSocket
│   │   ├── bot/           # Cliente Discord e eventos
│   │   ├── db/models/     # Schemas Mongoose multitenant
│   │   ├── services/      # Lógica de negócio
│   │   └── workers/       # Crons (inatividade, webhooks)
│   └── tests/
├── frontend/
│   └── src/app/
│       ├── core/          # Auth, admin API, tenant, guards, push
│       └── features/      # landing, dashboard, live, reports, settings, admin, /me
├── docs/
├── .github/workflows/     # CI + deploy SSH
├── docker-compose.yml
└── package.json           # workspaces: backend, frontend
```

---

## Pré-requisitos

- **Node.js 22+**
- **MongoDB 7+** (local ou via Docker)
- Aplicação Discord com intents privilegiados:
  - `Guilds`, `GuildMembers`, `GuildPresences`, `GuildVoiceStates`, `GuildMessages` (metadados)

> Em produção, credenciais do bot e guild monitorado são configurados **via UI**, não por variáveis de ambiente.

---

## Instalação

```bash
git clone <repo-url>
cd discord-tracker

npm ci

cp .env.example .env
# Preencha ENCRYPTION_KEY, JWT_SECRET e demais vars de infra

npm run seed:plans --workspace=backend   # catálogo Starter/Team (dev)
```

---

## Desenvolvimento local

```bash
# Terminal 1 — API + bot (:3000)
npm run dev:backend

# Terminal 2 — Angular com proxy para API (:4200)
npm run dev:frontend
```

### Configurar o bot Discord (obrigatório — **sem** `DISCORD_TOKEN` no `.env`)

1. Gere `ENCRYPTION_KEY` (32 bytes base64) no `.env`
2. **Remova** `DISCORD_TOKEN`, `DISCORD_GUILD_ID` e `DISCORD_OAUTH_*` do `.env` se existirem
3. Cadastre o bot:
   - **UI:** http://localhost:4200/admin/discord (bootstrap automático em dev)
   - **Seed:** edite `backend/seed/discord-app.local.json` (a partir do `.example`) e rode:

```bash
npm run seed:discord-app --workspace=backend
```

> `discord-app.local.json` é gitignored — nunca commite tokens.

4. Reinicie o backend — bot conecta com token **criptografado no MongoDB**
5. Escolha o servidor em http://localhost:4200/app/settings/discord
6. Complete o onboarding em http://localhost:4200/app/onboarding

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| API | http://localhost:3000 |
| Health | http://localhost:3000/health |
| Swagger | http://localhost:3000/api/v1/docs |
| WebSocket live | `ws://localhost:3000/api/v1/ws/live` |

Proxy Angular (`frontend/proxy.conf.json`) encaminha `/api` → backend.

---

## Docker Compose

```bash
cp .env.example .env
docker compose up --build

curl -sf http://localhost:3000/health
curl -sf http://localhost:8080/
```

| Serviço | Porta |
|---------|-------|
| MongoDB | 27017 |
| Backend | 3000 |
| Frontend (nginx) | 8080 |

---

## Variáveis de ambiente

Somente **infraestrutura** — config de negócio (bot, canais, guild) fica no banco via UI.

| Variável | Descrição |
|----------|-----------|
| `MONGODB_URI` | Conexão MongoDB |
| `ENCRYPTION_KEY` | AES-256-GCM para secrets no banco (32 bytes base64) |
| `JWT_SECRET` | Assinatura dos tokens |
| `VAPID_*` | Chaves Web Push |
| `STRIPE_*` | Billing BRL |
| `PORT`, `HOST`, `NODE_ENV`, `LOG_LEVEL` | Servidor |

Lista completa: [`.env.example`](.env.example)

**Proibido em produção:** `DISCORD_*`, regras de canal via env.

---

## API — visão geral

Prefixo: `/api/v1`. Autenticação: `Authorization: Bearer <access_token>`.

| Grupo | Prefixo | Auth |
|-------|---------|------|
| Auth | `/auth/*` | Público / refresh cookie |
| Público | `/public/*`, `/health` | Público |
| Colaborador | `/me/*` | JWT |
| Tenant | `/org/:orgId/*` | JWT + tenant |
| Super Admin | `/admin/*` | JWT + `isSuperAdmin` |
| Stripe | `/webhooks/stripe` | Assinatura Stripe |
| Realtime | `/ws/live` | JWT (query/header) |

Documentação interativa: **Swagger** em `/api/v1/docs`. Mapa detalhado: [backend/AGENTS.md](backend/AGENTS.md).

---

## Testes

```bash
npm test                                    # todos os workspaces
npm run test:coverage --workspace=backend   # Vitest — threshold 80%
npm run test:coverage --workspace=frontend  # Karma — threshold 70%
npm run test:e2e --workspace=frontend       # Playwright smoke
npm run build                               # build completo
```

---

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint + testes + cobertura + build em PR/push para `main`/`dev`
- **Deploy** (`.github/workflows/deploy.yml`): SSH automático em `main`

Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

---

## Privacidade

- **Não** armazena conteúdo de mensagens, áudio ou DMs
- Texto: apenas metadados (`channelId`, `messageId`, timestamp)
- Exportação LGPD no portal `/me`
- Terminologia UI: **colaboração**, nunca “produtividade”

---

## Roadmap

| Item | Status |
|------|--------|
| Dashboard ao vivo + WebSocket | Implementado |
| Categorias + membros rastreados | Implementado |
| Gamificação (config + ranking + badges + streaks) | Implementado (MVP on-read) |
| Painel Super Admin (planos, users, orgs, discord) | Implementado |
| `superAdminGuard` | Implementado |
| UI tenant Discord + canais | Implementado |
| Limiares inatividade na UI | Implementado |
| Relatório ausências dedicado | Implementado |
| Sync Stripe ao editar plano no admin | Pendente |
| `RoleGuard` por papel tenant no frontend | Pendente |
| Push automático quinta (meta &lt; 50%) | Lógica pronta; worker pendente |
| Preview ao vivo na tela de gamificação | Pendente |
| Persistência histórica de badges (worker) | Pendente |
| E2E completo signup → onboarding → relatório | Smoke apenas |
| Seletor visual de canais Discord | Pendente |
| Filtros ranking por role Discord | Pendente |
| Email digest, SSO, multi-moeda, PTO self-service | v1.1+ |

---

## Licença

MIT
