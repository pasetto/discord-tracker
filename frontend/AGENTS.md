# AGENTS.md — Frontend (Angular + TailAdmin + PWA)

## Stack

- **Framework:** Angular 21 (standalone components)
- **UI:** TailAdmin + Tailwind CSS 4
- **Mobile:** PWA (`@angular/pwa`) + Web Push — **sem Capacitor**
- **Testes:** Jasmine + Karma (ChromeHeadless), Playwright (E2E smoke)
- **HTTP:** `@angular/common/http` + interceptors (`auth.interceptor`)
- **Proxy dev:** `frontend/proxy.conf.json` → backend `:3000`

## Terminologia UI (obrigatório)

- **Colaboração**, **horas colaborativas**, **quem sumiu**, **inatividade**
- **Nunca** “produtividade” / “produtivo” na UI
- API pode expor `productiveHours` internamente; mapear para “colaboração” nos templates

## Estrutura

```
frontend/src/app/
├── core/
│   ├── auth/              # AuthService, guards (auth, superAdmin)
│   ├── admin/             # AdminApiService (super admin)
│   ├── api/               # live-activity-socket
│   ├── tenant/            # TenantContextService (orgId, guildId)
│   ├── members/           # TrackedMembersService
│   └── onboarding/
├── features/
│   ├── landing/
│   ├── dashboard/         # Início — quem sumiu
│   ├── live/              # Time ao vivo + WebSocket
│   ├── reports/
│   │   ├── reports-hub/   # Abas
│   │   ├── inactivity/    # CORE
│   │   ├── goals/
│   │   ├── absences/
│   │   ├── ranking/       # Ranking gamificado
│   │   └── achievements/  # Badges + streaks do time
│   ├── collaborator/me/   # Portal /me
│   ├── onboarding/
│   ├── settings/          # Discord, canais, metas, gamificação, etc.
│   └── admin/             # Painel plataforma (super admin)
├── shared/                # layout, header, sidebar, member-select
└── app.routes.ts
```

## Rotas principais

### App autenticado (`/app/*` — `authGuard`)

| Rota | Componente | Função |
|------|------------|--------|
| `/app/dashboard` | `dashboard-placeholder` | Início — alertas quem sumiu |
| `/app/live` | `live-team` | Presença ao vivo, ranking operacional do dia |
| `/app/reports/inactivity` | `inactivity-report` | **Core** — quem sumiu |
| `/app/reports/goals` | `goals-report` | Metas vs realizado |
| `/app/reports/absences` | `absences-report` | PTO em andamento |
| `/app/reports/ranking` | `ranking-report` | Ranking gamificado (config) |
| `/app/reports/achievements` | `achievements-report` | Badges e streaks do time |
| `/app/settings/*` | vários | Ver tabela abaixo |
| `/app/onboarding` | `onboarding-wizard` | 8 passos (fora da sidebar) |
| `/app/me` | `me-portal` | Dados próprios + gamificação |

### Settings (`/app/settings`)

| Rota | Função |
|------|--------|
| `discord` | Conectar bot, escolher servidor |
| `channels` | Regras voz/texto |
| `categories` | Categorias do time |
| `calendar` | Calendário de trabalho |
| `absences` | Cadastrar PTO |
| `goals` | Metas individuais |
| `inactivity` | Limiares intraday/semanal |
| `gamification` | Toggles ranking/badges/streaks |

### Super Admin (`/admin/*` — `authGuard` + `superAdminGuard`)

| Rota | Função |
|------|--------|
| `/admin` | Visão geral |
| `/admin/plans` | CRUD planos (+ features checkboxes) |
| `/admin/users` | Promover `isSuperAdmin` |
| `/admin/organizations` | Listar tenants |
| `/admin/discord` | Bot compartilhado plataforma |

Link no menu usuário: **Painel da plataforma** (só se `AuthService.isSuperAdmin()`).

## Navegação (sidebar gestor)

1. **Início** → `/app/dashboard`
2. **Time ao vivo** → `/app/live`
3. **Relatórios** → `/app/reports` (abas no hub)
4. **Configurações** → `/app/settings`

Onboarding e Meu portal: banner + dropdown do usuário (não na sidebar).

Mobile: bottom nav alinhada (Início · Ao vivo · Relatórios · Config).

## Guards e sessão

| Guard | Uso |
|-------|-----|
| `authGuard` | Rotas `/app/*`, `/admin/*` |
| `guestGuard` | login/signup |
| `superAdminGuard` | `/admin/*` — exige `isSuperAdmin` na sessão local |

`AuthService.persistSession` armazena `isSuperAdmin` e `organization` (nullable para super admin sem tenant).

`TenantContextService` — `orgId`, `guildId` via localStorage + `GET .../discord/status`.

## Integração API (padrão)

```typescript
// Endpoints por guild (maioria das features)
`${tenantContext.getGuildApiBaseUrl()}/...`
// → /api/v1/org/{orgId}/guilds/{guildId}/...

// Portal colaborador
'/api/v1/me/...'

// Super admin
'/api/v1/admin/...'
```

- Interceptor adiciona `Authorization: Bearer`
- Refresh via cookie HttpOnly + `AuthService.refreshAccessToken()`
- Erros 401 → refresh ou logout

## Gamificação na UI

| Tela | Endpoint |
|------|----------|
| Settings gamificação | `GET/PUT .../gamification` |
| Relatório ranking | `GET .../gamification/ranking` |
| Relatório conquistas | `GET .../gamification/insights` |
| Meu portal | `GET /me/gamification` |

Se ranking bloqueado: verificar `Plan.features.ranking` no admin (`/admin/plans`).

## PWA + Push

- `ng add @angular/pwa` — manifest, service worker
- Push: `PushNotificationService` → `POST /org/:orgId/push/subscribe`
- Sem Capacitor

## Testes

```bash
npm run test --workspace=frontend
npm run test:coverage --workspace=frontend   # meta 70% core/features
npm run test:e2e --workspace=frontend
```

Specs críticos: auth guard, inactivity, goals, gamification settings, ranking report, superAdmin guard.

## Responsividade

- Mobile-first 320px+
- Tabelas de relatório com scroll horizontal ou cards em `< sm`
- Touch targets ≥ 44px

## Anti-patterns

- “Produtividade” na UI
- Meta agregada de equipe
- `discordClientId` hardcoded em `environment.ts`
- Ranking humilhante por default
- Capacitor / app nativo
- Chamar API sem `TenantContextService` em telas por guild
