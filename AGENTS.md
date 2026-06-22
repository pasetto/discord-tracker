# AGENTS.md — Syntra (discord-tracker)

Guia para agentes de IA e desenvolvedores que trabalham neste monorepo.

## Visão geral

**Syntra** é um SaaS B2B de analytics de **colaboração** para times remotos no Discord — foco em **quem sumiu**. Monorepo: backend + frontend (Angular + TailAdmin + **PWA**).

| Documento | Conteúdo |
|-----------|----------|
| [Design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md) | Arquitetura, modelos, fases, decisões |
| [backend/AGENTS.md](backend/AGENTS.md) | Regras do backend |
| [frontend/AGENTS.md](frontend/AGENTS.md) | Regras do frontend |

## Estrutura do monorepo (alvo)

```
discord-tracker/
├── backend/          # Node.js 22, Koa, Discord.js, Mongoose, Vitest
├── frontend/         # Angular 21, TailAdmin, PWA + Web Push, Karma
├── docs/
├── .github/workflows/
├── AGENTS.md         # este arquivo
└── package.json      # npm workspaces
```

> **Estado atual:** Fase 0 concluída — monorepo `backend/` + `frontend/` com npm workspaces, Docker Compose e CI GitHub Actions.

## Comandos principais

```bash
# Raiz (após workspaces)
npm ci
npm run test --workspace=backend
npm run test --workspace=frontend
npm run build --workspace=backend
npm run build --workspace=frontend

# Dev
npm run dev --workspace=backend      # API + bot :3000
npm run start --workspace=frontend   # ng serve :4200
```

## Regras invioláveis

1. **Multitenant:** toda query inclui `organizationId` — nunca confiar em ID vindo do client sem validar membership.
2. **Canais:** regras AFK/almoço/ignorados **somente via UI/API** — **proibido** env vars de canal.
3. **Discord bot:** token, client id/secret e guild monitorado **somente via UI** — **proibido** `DISCORD_*` env em produção.
4. **Privacidade:** nunca armazenar conteúdo de mensagens, áudio ou DMs.
5. **Testes:** PR não mergeia sem testes backend e frontend passando (CI).
6. **JSDoc:** todo export público do backend documentado; rotas com anotações OpenAPI.
7. **UI-first:** config de negócio no banco — ENV só infra.
8. **Colaboração:** nunca usar “produtividade” na UI — só **colaboração** / **horas colaborativas**.
9. **Core feature:** relatório de inatividade (“quem sumiu”) + metas **individuais** + **calendário/ausências PTO** + sinais texto (metadados).

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
