# Prontidão de alertas (SMTP + VAPID)

Runbook curto para o piloto: email digest semanal e web push só funcionam se as variáveis de infra estiverem no ambiente. **Nunca** commitar secrets.

## Variáveis

### Email (`SMTP_*`)

| Variável | Obrigatória para email? | Descrição |
|----------|-------------------------|-----------|
| `SMTP_HOST` | Sim | Host SMTP |
| `SMTP_FROM` | Sim | Remetente (`From`) |
| `SMTP_PORT` | Não (padrão `587`) | Porta |
| `SMTP_SECURE` | Não (`true`/`false`) | TLS implícito |
| `SMTP_USER` / `SMTP_PASS` | Se o provedor exigir auth | Credenciais |

**Ausente:** `SMTP_HOST` ou `SMTP_FROM` vazios → digest por email fica **desabilitado** (sem erro fatal no boot). Push e demais features seguem normais.

### Web Push (`VAPID_*`)

| Variável | Obrigatória para push? | Descrição |
|----------|------------------------|-----------|
| `VAPID_PUBLIC_KEY` | Sim | Chave pública (frontend) |
| `VAPID_PRIVATE_KEY` | Sim | Chave privada (só backend) |
| `VAPID_SUBJECT` | Sim | `mailto:` ou URL de contato |

**Ausente:** qualquer uma faltando → web push **desabilitado**; `GET` de chave pública retorna erro amigável. Email digest independente.

Geração local (exemplo):

```bash
npx web-push generate-vapid-keys
```

## Smoke / health

Reporter seguro (só booleans, sem secrets):

```bash
# Lê .env / process.env do workspace
npm run smoke:alerts --workspace=backend

# Contra API já no ar
npm run smoke:alerts --workspace=backend -- --http http://localhost:3000

# Exit 2 se algum canal faltar (CI de piloto)
npm run smoke:alerts --workspace=backend -- --strict
```

Endpoint público:

```http
GET /health/alerts
GET /api/v1/health/alerts
```

Resposta exemplo:

```json
{
  "emailConfigured": false,
  "vapidConfigured": true,
  "timestamp": "2026-07-18T12:00:00.000Z"
}
```

## Piloto / staging

Se o ambiente piloto for gerenciado só pelo CEO: configurar `SMTP_*` e `VAPID_*` no host (PM2/Docker/secrets) e reexecutar o smoke com `--http` apontando para a API. Sem essas vars, alertas por email/push **não** chegam ao gestor — o restante do produto (dashboard, Discord) continua operando.
