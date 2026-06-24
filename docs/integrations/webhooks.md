# Integrações via Webhooks (Syntra)

Guia para conectar o Syntra a ferramentas externas usando **webhooks outbound** assíncronos.

> **Requisito de plano:** endpoints webhook exigem o plano **Business** (`features.webhooks: true`).

---

## Visão geral

1. Gestor cadastra endpoint em **Configurações → Webhooks** (HTTPS obrigatório).
2. Eventos de domínio são enfileirados em `WebhookDelivery`.
3. Worker entrega com retry exponencial e assinatura **HMAC-SHA256**.

```
Syntra (cron/evento) → fila → POST https://seu-endpoint → Slack / n8n / Notion
```

---

## Autenticação e verificação

Cada entrega inclui:

| Header | Valor |
|--------|--------|
| `Content-Type` | `application/json` |
| `X-Syntra-Event` | Nome do evento (ex.: `member.inactivity.detected`) |
| `X-Syntra-Signature` | `sha256=<hex>` |
| `X-Syntra-Delivery-Id` | ID único da entrega |

### Verificar assinatura (Node.js)

```javascript
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Valida assinatura HMAC do webhook Syntra.
 * @param {string} secret Segredo configurado no endpoint
 * @param {string} rawBody Corpo JSON exatamente como recebido
 * @param {string} signatureHeader Valor de X-Syntra-Signature
 * @returns {boolean} true quando assinatura válida
 */
function verifySyntraSignature(secret, rawBody, signatureHeader) {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

**Importante:** use o corpo **bruto** (string) antes do parse JSON para calcular o HMAC.

---

## Eventos principais (colaboração / quem sumiu)

| Evento | Quando dispara |
|--------|----------------|
| `member.inactivity.detected` | Cron semanal — membros com status `missing` |
| `member.intraday_concern.detected` | Durante a jornada — `not_started` ou `low_collaboration_today` |
| `member.collaboration_goal.behind` | Meta semanal abaixo do esperado (ex.: quinta &lt; 50%) |
| `daily_report.generated` | Relatório diário agregado disponível |

Lista completa: `backend/src/db/models/WebhookEndpoint.ts` → `OUTBOUND_WEBHOOK_EVENTS`.

---

## Payload de exemplo — `member.inactivity.detected`

```json
{
  "guildId": "123456789012345678",
  "missingCount": 2,
  "missingMembers": [
    {
      "discordId": "111",
      "displayName": "Ana Silva",
      "inactiveBusinessDays": 3
    }
  ],
  "periodStart": "2026-06-17T11:00:00.000Z",
  "periodEnd": "2026-06-24T11:00:00.000Z",
  "detectedAt": "2026-06-24T11:00:00.000Z"
}
```

## Payload de exemplo — `member.intraday_concern.detected`

```json
{
  "guildId": "123456789012345678",
  "concernCount": 1,
  "concernEntries": [
    {
      "discordId": "222",
      "displayName": "Bruno",
      "status": "not_started"
    }
  ],
  "detectedAt": "2026-06-24T14:30:00.000Z"
}
```

---

## Exemplo: Slack (canal interno do gestor)

1. Crie um **Incoming Webhook** no Slack do time de liderança.
2. No Syntra, cadastre a URL `https://hooks.slack.com/services/...` inscrita em `member.inactivity.detected`.
3. Use **n8n** ou um proxy leve para formatar a mensagem (o Syntra envia JSON bruto).

Mensagem sugerida no n8n:

```
:warning: *{{ $json.missingCount }} colaborador(es) sumiram* esta semana no Discord.
{{ $json.missingMembers.map(m => `• ${m.displayName} (${m.inactiveBusinessDays} dias úteis)`).join('\n') }}
```

---

## Exemplo: n8n

Arquivo de referência: [`examples/n8n-inactivity-slack.json`](examples/n8n-inactivity-slack.json)

Fluxo mínimo:

1. **Webhook** (POST) — recebe do Syntra
2. **IF** — `{{ $json.headers['x-syntra-event'] }}` = `member.inactivity.detected`
3. **HTTP Request** — POST para Slack Incoming Webhook com texto formatado

---

## Exemplo: Notion (registro de alertas)

Crie um database com colunas:

| Coluna | Tipo | Origem |
|--------|------|--------|
| Nome | Title | `missingMembers[0].displayName` |
| Dias sem sinal | Number | `inactiveBusinessDays` |
| Guild | Text | `guildId` |
| Detectado em | Date | `detectedAt` |

No n8n, use o node **Notion → Create Database Page** mapeando os campos do payload.

---

## Retries e falhas

| Tentativa | Atraso aproximado |
|-----------|-------------------|
| 1 | 1 min |
| 2 | 5 min |
| 3 | 30 min |
| 4 | 2 h |
| 5 | 24 h |

Após 5 falhas a entrega fica `dead`. Monitore `failureCount` no endpoint via API.

---

## Privacidade

Webhooks de inatividade enviam **metadados** (nome de exibição, discordId, contadores). **Não** incluem conteúdo de mensagens, áudio ou transcrições.

---

## Cadastro via API

```
POST /api/v1/org/:orgId/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Alertas gestão",
  "url": "https://seu-proxy.example/webhook",
  "secret": "minimo-16-caracteres-seguro",
  "events": ["member.inactivity.detected", "member.intraday_concern.detected"]
}
```

Documentação interativa: `GET /api/v1/docs` (Swagger).
