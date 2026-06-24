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
│   ├── onboarding/        # Wizard 8 passos (fora da sidebar)
│   ├── landing/
│   ├── dashboard/         # Início — quem sumiu hoje/semana
│   ├── live/              # Time ao vivo
│   ├── reports/
│   │   ├── reports-hub/   # Hub com abas
│   │   ├── inactivity/    # CORE
│   │   ├── goals/
│   │   └── absences/
│   ├── collaborator/      # Portal /me (menu usuário)
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
| `/app/dashboard` | **Início** — alertas quem sumiu (hoje + semana) |
| `/app/live` | Time ao vivo (presença, ranking) |
| `/app/reports/inactivity` | **Core** — relatório quem sumiu |
| `/app/reports/goals` | Meta vs realizado por usuário |
| `/app/onboarding` | Wizard 8 passos — banner + menu se incompleto |
| `/app/me` | Portal colaborador — só dados próprios |
| `/app/settings/goals` | Metas individuais |

## Navegação (sidebar)

1. **Início** → `/app/dashboard`
2. **Time ao vivo** → `/app/live`
3. **Relatórios** → `/app/reports` (abas)
4. **Configurações** → `/app/settings` (Integração · Regras · Time)

Onboarding e Meu portal ficam no banner/menu do usuário, não na sidebar.

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
