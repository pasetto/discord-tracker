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

## Autoria Git (obrigatório — conta GitHub `pasetto`)

Todos os commits neste repositório devem aparecer no GitHub sob a conta **[pasetto](https://github.com/pasetto)** (Eduardo Pasetto). Não criar “ghost authors” com nomes de agentes, hostname da VM ou e-mails locais.

| Campo | Valor obrigatório |
|-------|-------------------|
| `user.name` | `Eduardo Pasetto` |
| `user.email` | `eduardo@nanodesign.com.br` |

**Antes do primeiro `git commit` no heartbeat**, conferir:

```bash
git config user.name   # Eduardo Pasetto
git config user.email  # eduardo@nanodesign.com.br
```

Se estiver errado (ex.: `Ubuntu`, `Syntra CEO`, `Cursor Agent`, `*.local`, hostname da VM):

```bash
git config user.name "Eduardo Pasetto"
git config user.email "eduardo@nanodesign.com.br"
```

**Proibido:**

- `git -c user.name=…` / `GIT_AUTHOR_*` / `GIT_COMMITTER_*` com outro nome ou e-mail
- Autor com nome do agente Paperclip (CEO, FoundingEngineer, etc.)
- Usar o autor padrão do Cursor Agent (`cursoragent@users.noreply.github.com`)

**Permitido no rodapé da mensagem** (não muda o autor do commit):

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

Histórico antigo com autores fantasma **não** é reescrito por padrão (evita force-push em `main`). Novos commits devem seguir a tabela acima.

## Regras invioláveis

1. **Multitenant:** toda query inclui `organizationId` — nunca confiar em ID vindo do client sem validar membership.
2. **Canais:** regras AFK/almoço/ignorados **somente via UI/API** — **proibido** env vars de canal.
3. **Discord bot:** token, client id/secret e guild monitorado **somente via UI** — **proibido** `DISCORD_*` env em produção.
4. **Privacidade:** nunca armazenar conteúdo de mensagens, áudio ou DMs.
5. **Testes (passar + gerar):** PR não mergeia sem CI verde. Toda mudança de código **exige** testes novos ou atualizados no(s) workspace(s) tocado(s). Feature full-stack exige cobertura **FE e BE**. Só “testes passando” sem gerar cobertura do que mudou **não** é aceitável.
6. **JSDoc:** todo export público do backend documentado; rotas com anotações OpenAPI.
7. **UI-first:** config de negócio no banco — ENV só infra.
8. **Colaboração:** nunca usar “produtividade” na UI — só **colaboração** / **horas colaborativas**.
9. **Core feature:** inatividade (“quem sumiu”) + metas **individuais** + calendário/PTO + sinais texto (metadados).
10. **Planos:** features de gamificação/ranking enforced no backend (`Plan.features` + `GamificationSettings`).

## Geração obrigatória de testes

Regra operacional para humanos e agentes (FoundingEngineer incluso):

| Escopo da mudança | Testes obrigatórios |
|-------------------|---------------------|
| Só `backend/` | Specs Vitest novos/atualizados cobrindo o comportamento alterado; rodar `npm run test --workspace=backend` (ou alvo scoped equivalente) |
| Só `frontend/` | Specs Karma/Jasmine novos/atualizados; rodar `npm run test --workspace=frontend` (ou alvo scoped) |
| Full-stack (BE + FE) | **Ambos** os lados — não basta testar só a API ou só a UI |
| Docs / CI config / templates sem lógica de produto | Exceção: sem spec de produto; ainda assim CI deve ficar verde |

**Proibido:** mergear feature/bugfix sem arquivo de teste tocado no workspace correspondente (exceto a exceção documental acima).

Detalhes por stack: [backend/AGENTS.md](backend/AGENTS.md) · [frontend/AGENTS.md](frontend/AGENTS.md). Checklist no PR: [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).

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

- `.github/workflows/ci.yml` — lint + testes + cobertura + build em todo PR e push para `main` / `dev` / `develop`
- `.github/workflows/deploy.yml` — deploy SSH em `main`
- **Branch protection** em `main` e `dev`: merge bloqueado sem os **required checks** abaixo (nomes dos jobs do `ci.yml`):
  1. `Backend (Vitest + lint)`
  2. `Frontend (Karma + build)`
  3. `Frontend E2E (Playwright)`
- Template de PR: `.github/PULL_REQUEST_TEMPLATE.md` — checklist de **geração** de testes + comandos locais + jobs CI

Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

## Antes de implementar

1. Ler seção relevante do [design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md)
2. Ler `AGENTS.md` da pasta (`backend/` ou `frontend/`)
3. Escrever testes **junto** com o código (não depois do PR) — ver [Geração obrigatória de testes](#geração-obrigatória-de-testes)
4. Não expandir escopo além do pedido

## Checklist de PR

Usar o template GitHub; espelho mínimo:

- [ ] Testes **gerados/atualizados** no(s) workspace(s) alterado(s) (FE e BE se full-stack)
- [ ] Testes backend passam (`npm run test --workspace=backend`) — se `backend/` mudou
- [ ] Testes frontend passam (`npm run test --workspace=frontend`) — se `frontend/` mudou
- [ ] Jobs CI verdes: Backend (Vitest + lint), Frontend (Karma + build), Frontend E2E (Playwright)
- [ ] Lint/typecheck sem erros
- [ ] JSDoc em novos exports (backend)
- [ ] Swagger atualizado se nova rota API
- [ ] Sem secrets no código
- [ ] UI responsiva (se alterou frontend)
- [ ] Terminologia UI: colaboração, não produtividade
