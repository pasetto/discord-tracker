# Syntra

SaaS B2B de **colaboração** para times remotos no Discord — foco em **quem sumiu**: inatividade, ausências planejadas (PTO), metas individuais e sinais de texto (somente metadados, sem conteúdo de mensagens).

Monorepo **npm workspaces**: `backend/` (API + bot Discord) + `frontend/` (Angular 21 + TailAdmin + PWA).

| Documento | Conteúdo |
|-----------|----------|
| [Design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md) | Arquitetura, modelos, API, fases |
| [Plano de implementação](docs/superpowers/plans/2026-06-20-syntra-saas-implementation.md) | Tasks por fase |
| [AGENTS.md](AGENTS.md) | Regras para agentes e desenvolvedores |

---

## Funcionalidades (MVP)

### Backend
- API multitenant (`organizationId` em todas as queries)
- OAuth Discord + JWT (access + refresh)
- Bot compartilhado via `DiscordApplication` no MongoDB (sem `DISCORD_*` em produção)
- Regras de canais (voz + texto) no banco — `ChannelRule`
- Calendário de trabalho + feriados BR (`WorkCalendar`)
- Ausências planejadas / PTO (`PlannedAbsence`)
- Sinais de texto — metadados only (`TextActivityEvent`)
- Relatório semanal **quem sumiu** (`InactivityService` + cron)
- Metas individuais de colaboração (`UserCollaborationGoal`)
- Onboarding 8 passos (API de progresso)
- Billing Stripe BRL (planos seed + checkout + webhooks)
- Web Push (VAPID) para alertas de inatividade
- Webhooks outbound (HMAC + worker + retry)
- Export CSV (inatividade + colaboração)
- Audit log + exportação LGPD (`/me/data-export`)
- Gamificação configurável por guild
- Swagger em `/api/v1/docs`

### Frontend
- Landing com pricing BRL
- Auth shell (login email/senha + OAuth, guard, interceptor)
- Onboarding wizard (8 passos) — banner + link no menu enquanto incompleto
- **Início** (`/app/dashboard`) — alertas “Quem sumiu?” (hoje + semana)
- **Time ao vivo** (`/app/live`) — presença, movimentação e ranking
- **Relatórios** (`/app/reports`) — hub com abas: Quem sumiu · Metas · Ausências em andamento
- Configurações agrupadas: Integração · Regras · Time · Gamificação
- Portal colaborador `/me` (transparência LGPD) — acesso pelo menu do usuário
- PWA + service worker
- Layout responsivo (bottom nav: Início · Ao vivo · Relatórios · Config)

#### Navegação principal (gestor)

| Rota | Função |
|------|--------|
| `/app/dashboard` | Início — foco em quem sumiu hoje/semana |
| `/app/live` | Time ao vivo no Discord |
| `/app/reports/*` | Relatórios com abas (inatividade, metas, ausências) |
| `/app/settings/*` | Configurações (Discord, canais, calendário, limiares, PTO, etc.) |
| `/app/onboarding` | Setup inicial (8 passos) — fora da sidebar |
| `/app/me` | Portal do colaborador |

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
│   │   ├── api/           # Rotas Koa, middleware, Swagger
│   │   ├── bot/           # Cliente Discord e eventos
│   │   ├── db/models/     # Schemas Mongoose multitenant
│   │   ├── services/      # Lógica de negócio
│   │   └── workers/       # Crons (inatividade, ausências, webhooks)
│   └── tests/
├── frontend/
│   └── src/app/
│       ├── core/          # Auth, API clients, guards, push
│       └── features/      # Landing, onboarding, reports, settings, /me
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

# Seed dos planos Stripe (opcional, dev)
npm run seed:plans --workspace=backend
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
3. Cadastre o bot por uma das opções:
   - **UI:** http://localhost:4200/admin/discord (bootstrap automático no primeiro cadastro em dev)
   - **Seed:** na primeira execução o script cria `backend/seed/discord-app.local.json` a partir do `.example`. Edite com credenciais reais e rode de novo:

```bash
npm run seed:discord-app --workspace=backend
```

> O arquivo `discord-app.local.json` é gitignored — nunca commite tokens.

4. Reinicie o backend — o bot conecta lendo o token **criptografado no MongoDB**
5. Escolha o servidor em http://localhost:4200/app/settings/discord

URLs:

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| API | http://localhost:3000 |
| Health | http://localhost:3000/health |
| Swagger | http://localhost:3000/api/v1/docs |
| OpenAPI JSON | http://localhost:3000/api/v1/docs/openapi.json |

O proxy Angular (`frontend/proxy.conf.json`) encaminha `/api` para o backend.

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

---

## Testes

```bash
# Todos os workspaces
npm test

# Backend (Vitest) — threshold 80% linhas
npm run test:coverage --workspace=backend

# Frontend (Karma headless) — threshold 70% linhas (core/features)
npm run test:coverage --workspace=frontend

# E2E (Playwright)
npm run test:e2e --workspace=frontend

# Build
npm run build
```

---

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint + testes + cobertura + build em PR/push para `main`/`dev`
- **Deploy** (`.github/workflows/deploy.yml`): SSH automático em `main`

Secrets de deploy: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

---

## Privacidade

- **Não** armazena conteúdo de mensagens, áudio ou DMs
- Texto: apenas metadados (`channelId`, `messageId`, timestamp)
- Exportação LGPD disponível no portal `/me`

---

## Roadmap (v1.1)

Itens previstos no spec mas **fora do MVP atual**:

| Item | Status |
|------|--------|
| UI Super Admin `/admin/discord` (CRUD bot plataforma) | Implementado (bootstrap dev + activate/validate) |
| UI tenant `/settings/discord` (conectar bot + escolher guild) | Implementado |
| Seletor visual de canais Discord (vs editor JSON atual) | Pendente |
| `/settings/inactivity` — limiares configuráveis na UI | Implementado (semanal + intraday) |
| `/reports/absences` — página dedicada de ausências | Implementado |
| Push automático na quinta quando meta &lt; 50% | Lógica pronta; worker pendente |
| Guards `SuperAdminGuard` / `RoleGuard` no frontend | Pendente |
| E2E completo: signup → onboarding → relatório | Smoke apenas |
| Email digest, SSO, multi-moeda, PTO self-service | v1.1+ |

---

## Licença

MIT
