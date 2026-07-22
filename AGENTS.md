# AGENTS.md — Syntra (bootstrap)

SaaS B2B de analytics de **colaboração** no Discord — foco em **quem sumiu**. Monorepo: `backend/` (Node 22, Koa, Discord.js, Mongoose) + `frontend/` (Angular 21, TailAdmin, PWA).

| Quando precisar | Ler |
|-----------------|-----|
| Instalação / rotas / API | [README.md](README.md) |
| Arquitetura / fases | [Design spec](docs/superpowers/specs/2026-06-20-pulsedesk-saas-design.md) |
| Mapas, CI, gamificação, papéis | [docs/agents-reference.md](docs/agents-reference.md) |
| Backend | [backend/AGENTS.md](backend/AGENTS.md) |
| Frontend | [frontend/AGENTS.md](frontend/AGENTS.md) |
| Qual skill carregar | [.cursor/skills/syntra-skill-router/SKILL.md](.cursor/skills/syntra-skill-router/SKILL.md) |

Git authorship: [`.cursor/rules/git-authorship.mdc`](.cursor/rules/git-authorship.mdc) (conta `pasetto`).

## Invioláveis

1. **Multitenant:** toda query com `organizationId`; validar membership.
2. **Canais / Discord bot:** config só via UI/API — sem env de canal ou `DISCORD_*` em produção.
3. **Privacidade:** nunca armazenar conteúdo de mensagens, áudio ou DMs.
4. **Testes:** mudança de código exige specs novos/atualizados no workspace tocado; full-stack = FE + BE; CI verde.
5. **JSDoc + OpenAPI** em exports/rotas novas do backend.
6. **UI-first:** config de negócio no banco — ENV só infra.
7. **Terminologia:** colaboração / horas colaborativas — nunca “produtividade”.
8. **Core:** inatividade + metas individuais + calendário/PTO + sinais de texto (metadados).
9. **Planos:** gamificação/ranking enforced via `Plan.features` + `GamificationSettings`.

## Testes (obrigatório gerar)

| Escopo | Specs |
|--------|-------|
| `backend/` | Vitest novos/atualizados; `npm run test --workspace=backend` |
| `frontend/` | Karma/Jasmine novos/atualizados; `npm run test --workspace=frontend` |
| Full-stack | Ambos |
| Docs/CI sem lógica | Exceção documental; CI ainda verde |

## Antes de implementar

1. Seção relevante do design spec + `AGENTS.md` do workspace tocado
2. Testes **junto** com o código
3. Não expandir escopo além do pedido
4. Skills: ativar só as relevantes (ver skill-router) — não ler SKILL.md sem match
