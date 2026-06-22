# AGENTS.md — Backend (PulseDesk API + Bot)

## Stack

- **Runtime:** Node.js ≥ 22
- **Linguagem:** TypeScript (strict)
- **HTTP:** Koa + `@koa/router`
- **Discord:** discord.js v14
- **Banco:** MongoDB + Mongoose
- **Testes:** Vitest + Supertest + mongodb-memory-server
- **Docs:** JSDoc + swagger-jsdoc + koa-swagger-ui
- **Logs:** Pino
- **Métricas:** prom-client (`/metrics`)

## Estrutura de pastas

```
backend/src/
├── api/
│   ├── routes/           # Handlers por domínio
│   ├── middleware/       # auth, tenant, rateLimit
│   └── server.ts
├── bot/                  # Discord client, events, recovery
├── config/
├── db/models/
├── repositories/         # Acesso a dados (sem lógica de negócio pesada)
├── services/             # Lógica de negócio
├── workers/              # Webhook delivery, cron reports
└── index.ts
```

## Convenções de código

### JSDoc (obrigatório)

Todo **export** (função, classe, interface, tipo, constante pública) deve ter JSDoc completo:

```typescript
/**
 * Classifica canal de voz quanto a colaboração (tipo de sessão).
 * @param channelId ID do canal Discord
 * @param channelName Nome do canal (snapshot)
 * @param rules Regras carregadas do banco — nunca de env
 * @returns Classificação com tipo de sessão
 * @example
 * classifyChannel('123', 'Geral', rules) // { sessionType: 'VOICE', isIgnored: false }
 */
export function classifyChannel(...): ChannelClassification { }
```

### Rotas API

- Prefixo: `/api/v1`
- Handlers finos — delegar para `services/`
- Cada rota: JSDoc + bloco `@openapi` para Swagger
- Respostas de erro padronizadas: `{ error, message, code? }`

### Multitenant

```typescript
// CORRETO — organizationId do JWT, nunca do body
const orgId = ctx.state.auth.organizationId;
await Report.find({ organizationId: orgId, ... });

// PROIBIDO
await Report.find({ organizationId: ctx.params.orgId }); // sem validar membership
```

### BotManager / DiscordApplication

- `BotManager` carrega token de `DiscordApplication` no MongoDB — **nunca** `process.env.DISCORD_TOKEN` em produção
- `NODE_ENV=production` → startup falha se não houver app Discord ativo no banco
- Secrets criptografados com `ENCRYPTION_KEY` (AES-256-GCM)
- Após PUT admin discord-app → `BotManager.reloadFromDatabase()`
- Guild ativo via `GuildConnection` UI — **proibido** `DISCORD_GUILD_ID` env

### ChannelRule

- Carregar regras de `ChannelRule` collection por `guildId`
- **Proibido** ler `IGNORED_CHANNELS`, `AFK_CHANNEL_NAMES`, `LUNCH_CHANNEL_NAMES` do env
- Cache em memória TTL 60 s; invalidar ao PUT `/channels`

### MemberCategory

- CRUD por guild; slugs únicos por `(organizationId, guildId)`
- `TrackedUser.categoryId` atualizável em lote
- Relatórios e ranking aceitam filtro `categoryId`

### Webhooks outbound

- Enfileirar em `WebhookDelivery` — nunca POST síncrono no request path
- Worker com retry exponencial (1m → 24h)
- Assinar body com HMAC-SHA256 (`X-Syntra-Signature`)
- HTTPS only

### Inatividade (core)

- `InactivityService` — cron diário, snapshots semanais
- Critérios configuráveis por org/guild (`InactivitySettings`)
- Eventos: `member.inactivity.detected` → push + webhook
- API: `/reports/inactivity/weekly` — **prioridade MVP**

### Metas individuais

- `UserCollaborationGoal` — **sempre por TrackedUser**
- `CategoryGoalTemplate` — só sugestão; aplicar cria meta **por membro**
- **Proibido** meta agregada de equipe (40h split entre devs)

### Web Push

- `web-push` + VAPID env vars
- `PushSubscription` collection
- Notificar gestores: inatividade, resumo semanal

## Swagger

- UI: `GET /api/v1/docs`
- JSON: `GET /api/v1/docs/openapi.json`
- Arquivo base: `backend/src/api/openapi.ts` ou gerado por swagger-jsdoc
- CI valida spec em `npm run build`

## Testes (obrigatório)

| Tipo | Ferramenta | Cobertura mínima |
|------|------------|------------------|
| Unit | Vitest | services, utils, classifiers |
| Integration | Vitest + mongodb-memory-server | repositories |
| API | Supertest | rotas críticas, auth, tenant isolation |

```bash
npm run test              # todos
npm run test:coverage     # com threshold 80%
npm run test:integration  # só integration
```

**Sempre testar:**

- Tenant isolation (org A ≠ org B)
- Plan feature enforcement
- ChannelRule sem env fallback
- Webhook HMAC signature

## Performance

- `.lean()` em reads
- Paginação (`limit` max 100)
- Índices compostos com `organizationId` primeiro
- Agregações: `$match` tenant no primeiro estágio
- Não bloquear event loop — jobs pesados no worker

## Variáveis de ambiente permitidas

Ver spec seção 12.2. **Somente infra:** `MONGODB_URI`, `ENCRYPTION_KEY`, `JWT_SECRET`, Stripe, `PORT`, `NODE_ENV`, `LOG_LEVEL`.

**Proibido em produção:** qualquer `DISCORD_*`, `IGNORED_CHANNELS`, `API_KEYS`, `TIMEZONE`, `APP_URL`, `CORS_ORIGIN` — tudo via UI/banco.

## Scripts

```bash
npm run dev          # tsx watch
npm run build        # tsc
npm run start        # node dist/index.js
npm run test
npm run lint         # tsc --noEmit
npm run seed:plans   # seeds planos Super Admin
```

## Anti-patterns

- Lógica de negócio em routes (mover para services)
- Query sem `organizationId`
- Config de canal via env ou hardcode
- `process.env.DISCORD_TOKEN` em runtime (produção)
- Retornar bot token ou client secret em GET API
- Webhook síncrono no handler HTTP
- Export sem JSDoc
