# AGENTS.md — Frontend (Angular + TailAdmin + PWA)

## Stack

- **Framework:** Angular 21 (standalone components preferidos)
- **UI:** TailAdmin (`ng-tailadmin`) + Tailwind CSS 4
- **Mobile:** **PWA** (`@angular/pwa`) + **Web Push** — sem Capacitor
- **Testes:** Jasmine + Karma (ChromeHeadless)
- **HTTP:** `@angular/common/http` + interceptors

## Terminologia UI (obrigatório)

- Usar **colaboração**, **horas colaborativas**, **quem sumiu** / **inatividade**
- **Nunca** “produtividade” ou “produtivo” na UI, marketing ou emails
- API expõe `collaborationHours`; mapear nos services

## Estrutura alvo

```
frontend/src/app/
├── core/
│   ├── auth/
│   ├── api/
│   ├── interceptors/
│   └── models/
├── features/
│   ├── onboarding/        # Wizard 7 passos
│   ├── landing/
│   ├── dashboard/         # Widget "Quem sumiu"
│   ├── reports/
│   │   ├── inactivity/    # CORE
│   │   ├── goals/         # Metas individuais
│   │   └── collaboration/
│   ├── collaborator/      # Portal /me
│   ├── settings/
│   └── admin/
├── shared/
└── app.routes.ts
```

## PWA + Push (obrigatório)

```bash
ng add @angular/pwa
```

| Item | Detalhe |
|------|---------|
| manifest | name: Syntra, display: standalone |
| Service Worker | Cache assets; offline shell |
| Install prompt | Banner "Instalar Syntra" |
| Push | Notification API → `POST /push/subscribe` |
| iOS | PWA na home screen (16.4+) suporta push |

**Não usar Capacitor** — mobile = web responsiva + PWA instalável.

## Features críticas de UI

| Tela | Prioridade |
|------|------------|
| `/onboarding` | Wizard 7 passos — TTV < 10 min |
| `/reports/inactivity` | **Core** — quem sumiu esta semana |
| `/reports/goals` | Meta vs realizado **por usuário** |
| `/dashboard` | Widget inatividade no topo |
| `/me` | Portal colaborador — só dados próprios |
| `/settings/goals` | Metas individuais; template categoria aplica **por pessoa** |

## Responsividade (obrigatório)

- Mobile-first 320px–1920px
- Bottom nav no mobile; tabelas → cards em `< sm`
- Touch targets ≥ 44 px

## Integração API

- `environment.apiUrl` only
- `PublicConfigService` + `APP_INITIALIZER` → `GET /api/v1/public/config`
- **Não** hardcode `discordClientId` em environment

## Testes (obrigatório)

- Onboarding wizard steps
- Inactivity report component
- Goals report (per-user bars)
- Push subscription service (mock)
- Cobertura mínima 70%

## Anti-patterns

- Capacitor / app nativo
- "Produtividade" na UI
- Meta agregada de equipe na UI
- `discordClientId` em environment.ts
- Ranking público humilhante por default
