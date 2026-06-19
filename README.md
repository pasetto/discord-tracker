# Discord Tracker

Bot Discord para monitoramento contínuo de presença e atividade em canais de voz, com histórico detalhado para relatórios de jornada e auditoria.

## Stack

- Node.js 22+
- TypeScript
- Discord.js v14
- MongoDB + Mongoose
- Koa (API HTTP)
- Pino (logs)
- prom-client (métricas Prometheus)
- PM2 (produção)
- Docker + Docker Compose

## Funcionalidades

- Monitoramento de status: ONLINE, IDLE, DND, OFFLINE, INVISIBLE
- Eventos de voz: entrada, saída, troca, movimentação, AFK automático, reconexão
- Tempo produtivo vs canais ignorados (AFK, Almoço)
- Recuperação automática de sessões após reinício
- API REST com healthcheck, stats, relatórios e ranking
- Dashboard web (EJS)
- Métricas Prometheus em `/metrics`

## Pré-requisitos

- Node.js 22+
- MongoDB 7+
- Bot Discord com intents:
  - `Guilds`
  - `GuildMembers`
  - `GuildPresences` (Privileged)
  - `GuildVoiceStates`

> **Importante:** Ative *Server Members Intent* e *Presence Intent* no [Discord Developer Portal](https://discord.com/developers/applications).

## Instalação

```bash
# Clone e entre no diretório
cd discord-tracker

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com seu DISCORD_TOKEN e demais configs

# Desenvolvimento
npm run dev

# Build produção
npm run build
npm start
```

## Variáveis de ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `DISCORD_TOKEN` | Token do bot Discord | Sim |
| `DISCORD_GUILD_ID` | ID do servidor a monitorar (opcional; pode ser escolhido no dashboard) | Não |
| `MONGODB_URI` | URI de conexão MongoDB | Sim |
| `PORT` | Porta HTTP (default: 3000) | Não |
| `IGNORED_CHANNELS` | Canais ignorados (nomes ou IDs, separados por vírgula) | Não |
| `AFK_CHANNEL_NAMES` | Nomes de canais AFK | Não |
| `LUNCH_CHANNEL_NAMES` | Nomes de canais de almoço | Não |
| `API_KEYS` | Chaves de autenticação da API (separadas por vírgula) | Sim |
| `TIMEZONE` | Timezone IANA para relatórios (default: `America/Sao_Paulo`) | Não |
| `LOG_LEVEL` | Nível de log Pino | Não |

## Autenticação da API

Todas as rotas exigem autenticação, **exceto** `/health` e `/health/details` (usados por Docker/PM2).

Formas de autenticação:

```bash
# Header Authorization Bearer
curl -H "Authorization: Bearer sua_api_key" http://localhost:3000/stats

# Header X-API-Key
curl -H "X-API-Key: sua_api_key" http://localhost:3000/reports/daily

# Dashboard web: acesse /login e informe a API key (cookie HttpOnly por 7 dias)
```

Rotas públicas: `GET /health`, `GET /health/details`, `GET /login`, `POST /login`

## Timezone

Relatórios diários e mensais usam a timezone configurada em `TIMEZONE` (padrão: **America/Sao_Paulo**).

- Datas no formato `YYYY-MM-DD` são interpretadas como dia civil em São Paulo
- Agregações de sessões respeitam meia-noite local (UTC-3)
- O campo `timezone` aparece nas respostas de relatórios

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Desenvolvimento com hot reload |
| `npm run build` | Compila TypeScript |
| `npm start` | Inicia em produção |
| `npm test` | Testes unitários |
| `npm run lint` | Verificação TypeScript |
| `npm run pm2:start` | Inicia via PM2 |

## API HTTP

### Healthcheck

```bash
GET /health
GET /health/details
```

Retorna `500` se Discord ou MongoDB estiverem indisponíveis.

### Estatísticas

```bash
GET /stats
```

### Relatórios

```bash
GET /reports/daily/2026-06-19
GET /reports/monthly/2026/6
GET /reports/ranking?type=daily
GET /reports/ranking?type=monthly&year=2026&month=6
```

### Métricas Prometheus

```bash
GET /metrics
```

### Dashboard

```bash
GET /
```

## Docker

```bash
# Configure .env antes
docker compose up -d --build

# Verificar saúde
curl http://localhost:3000/health
```

## PM2

```bash
mkdir -p logs
npm run build
npm run pm2:start

# Monitorar
pm2 logs discord-tracker
pm2 monit
```

## Estrutura do projeto

```
src/
├── api/              # Servidor Koa e rotas
├── bot/              # Cliente Discord, eventos e recovery
├── config/           # Configuração via env
├── dashboard/        # Views EJS
├── db/               # Conexão e models Mongoose
├── logger/           # Pino
├── metrics/          # Prometheus
├── repositories/     # Acesso a dados
├── services/         # Lógica de negócio
└── index.ts          # Entry point
```

## Collections MongoDB

| Collection | Descrição |
|------------|-----------|
| `users` | Usuários Discord rastreados |
| `voice_sessions` | Sessões de voz com duração e tipo |
| `presence_sessions` | Sessões de presença por status |
| `daily_reports` | Relatórios diários agregados |
| `system_logs` | Logs de auditoria persistidos |

## Recuperação após falhas

Ao reiniciar, o bot executa automaticamente:

1. Busca todas sessões abertas (`endedAt: null`)
2. Fecha sessões órfãs com timestamp do reinício
3. Valida estado atual de cada membro no Discord
4. Reabre sessões de voz/presença conforme estado real
5. Registra log em `system_logs`

Isso garante que reinícios não percam histórico nem criem sessões duplicadas indefinidamente.

## Segurança

- **Não** armazena mensagens ou conteúdo de conversas
- Apenas metadados de presença e voz (IDs, nomes de canal, timestamps, status)

## Testes

```bash
npm test
```

## Licença

MIT
