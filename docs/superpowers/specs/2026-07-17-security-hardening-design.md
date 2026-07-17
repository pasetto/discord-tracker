# Hardening integral de segurança

**Data:** 2026-07-17  
**Status:** Aprovado

## Contexto

A auditoria estática do monorepo identificou riscos em autenticação, isolamento
multitenant, autorização, integrações outbound, WebSocket, infraestrutura,
dependências e tratamento de dados pessoais.

O objetivo desta iniciativa é corrigir todos os achados confirmados no
repositório, adicionar testes de regressão e organizar as mudanças em commits
atômicos. A entrega reduz substancialmente o risco, mas não representa garantia
absoluta de ausência de bugs ou vulnerabilidades futuras.

## Decisões aprovadas

- Implementação incremental por fronteira de confiança.
- Vários commits atômicos, cada um validado antes do próximo.
- `.cursor/` será ignorado pelo Git; as skills locais não serão versionadas.
- A alteração preexistente em `frontend/proxy.conf.js` será preservada e não
  fará parte dos commits de segurança.
- O vínculo entre conta Syntra e perfil Discord exigirá aprovação de
  `manager`, `admin` ou `owner`.
- O Docker Compose será endurecido, embora a produção atual utilize build com
  PM2 e Nginx como reverse proxy.

## Princípios

1. Nenhuma autorização depende somente do frontend.
2. Toda operação por guild valida `organizationId ↔ guildId`.
3. Identidade declarada pelo cliente exige prova ou aprovação.
4. Tokens têm finalidade explícita, rotação e revogação.
5. URLs externas são hostis até validação completa do destino.
6. Dados pessoais são minimizados, auditados e removidos conforme retenção.
7. Mudanças incompatíveis falham de forma explícita em produção.

## Etapa 1 — Higiene, infraestrutura e supply chain

### Git e arquivos locais

- Adicionar `.cursor/` ao `.gitignore`.
- Não alterar nem incluir `frontend/proxy.conf.js`.
- Não versionar relatórios com secrets ou resultados brutos de scanners.

### Docker e Nginx

- Remover a publicação da porta MongoDB no host.
- Manter MongoDB e backend em rede interna dedicada.
- Habilitar autenticação do MongoDB com usuário de aplicação de privilégio
  mínimo.
- Evitar publicação direta do backend quando o acesso ocorrer pelo Nginx.
- Adicionar headers defensivos ao Nginx versionado:
  - HSTS apenas no bloco HTTPS aplicável;
  - `X-Content-Type-Options`;
  - `Referrer-Policy`;
  - `Permissions-Policy`;
  - proteção contra framing;
  - CSP compatível com o frontend.
- Configurar corretamente upgrade e timeouts de WebSocket.
- Documentar que TLS termina no reverse proxy de produção.

### Dependências e CI

- Atualizar ou substituir Swiper para uma versão corrigida.
- Atualizar `discord.js`/`undici` para versões sem advisories produtivos
  conhecidos.
- Substituir `koa-swagger-ui` se a cadeia vulnerável não possuir atualização
  segura.
- Fixar GitHub Actions de terceiros por SHA revisado.
- Declarar permissões mínimas nos workflows.
- Adicionar Gitleaks e auditoria de dependências ao CI, com allowlist restrita
  a exemplos sintéticos necessários.

## Etapa 2 — Autenticação e sessões

### Tokens

- Access e refresh tokens terão:
  - `tokenType` distinto;
  - chaves distintas;
  - `issuer` e `audience`;
  - algoritmo permitido explícito;
  - TTL validado em faixa segura.
- `verifyAccessToken` rejeitará refresh tokens.
- `verifyRefreshToken` rejeitará access tokens.
- Produção rejeitará secrets fracos, placeholders e configuração incompleta.

### Sessões de refresh

Criar coleção de sessões com:

- `userId`;
- `tokenHash`;
- `jti`;
- identificador da família;
- expiração;
- revogação;
- timestamps de criação e uso;
- metadados mínimos de segurança.

Fluxo:

1. Login cria uma família de sessão.
2. Refresh consome o token atual uma única vez.
3. O token anterior é revogado atomicamente.
4. Reutilização revoga toda a família.
5. Logout, troca de senha e bloqueio do usuário revogam sessões aplicáveis.

Tokens brutos nunca serão persistidos ou registrados em logs.

### Proteções adicionais

- Respostas de cadastro não revelarão se o email já existe.
- Rate limiting considerará IP e identificador normalizado nos fluxos
  sensíveis.
- Cookies terão `HttpOnly`, `Secure` em produção, `SameSite` adequado e escopo
  de path mínimo compatível.

## Etapa 3 — Multitenancy, identidade e RBAC

### Guilds

- A mesma guild ativa não poderá pertencer a dois tenants.
- A seleção será validada e persistida atomicamente.
- Um índice único apropriado reforçará a exclusividade no banco.
- Toda sincronização ou leitura do bot validará a conexão ativa da guild com a
  organização.

### RBAC

- Mutações de categorias e calendário exigirão papel de gestão.
- Rotas de configuração seguirão uma função central de autorização.
- WebSocket aplicará o mesmo conjunto de papéis aceitos pelas rotas REST.
- Memberships pendentes não acessarão endpoints `/me` protegidos.
- Testes negativos cobrirão `viewer`, membership pendente e tenant diferente.

### Vínculo Discord

O envio direto de `discordId` deixará de concluir o vínculo.

Fluxo aprovado:

1. O usuário solicita vínculo com um perfil rastreado ativo da organização.
2. O backend cria solicitação pendente com validade definida.
3. `manager`, `admin` ou `owner` aprova ou rejeita a solicitação.
4. A aprovação valida novamente usuário, membership, tenant, perfil ativo e
   ausência de vínculo concorrente.
5. A operação gera evento de auditoria e novos tokens.

### Billing

- Eventos de atualização, cancelamento, pagamento confirmado e falha de
  pagamento serão processados de forma idempotente.
- Períodos e status virão do Stripe, não de cálculo local fictício.
- Exportações, webhooks e demais recursos pagos serão validados no backend.

## Etapa 4 — Entrada, integrações e disponibilidade

### SSRF

Uma política central de URL pública:

- aceita somente HTTPS quando aplicável;
- resolve DNS antes da conexão;
- bloqueia faixas privadas, loopback, link-local, multicast e reservadas em
  IPv4 e IPv6;
- limita portas;
- rejeita credenciais embutidas;
- desabilita redirects ou revalida cada destino;
- reduz risco de DNS rebinding;
- aplica timeout, limite de resposta e concorrência.

Webhooks outbound e Web Push usarão a política. Para Web Push, será preferida
allowlist de provedores conhecidos.

### Stripe e exportação

- O corpo bruto do webhook Stripe terá limite durante o streaming, timeout e
  resposta `413` quando excedido.
- CSV neutralizará células iniciadas por caracteres interpretados como
  fórmula.

### WebSocket

- Parsing de upgrade será protegido contra entradas malformadas.
- Sockets rejeitados serão encerrados explicitamente.
- `Origin` será validado por allowlist.
- Haverá `maxPayload`, timeout de autenticação, limites por IP/usuário,
  heartbeat, cooldown de subscribe e controle de backpressure.
- A conexão será fechada quando o access token expirar.
- Membership e conexão guild/tenant serão revalidadas.
- Reautenticação removerá a assinatura anterior.
- Erros externos serão genéricos e terão correlação nos logs.

### Dashboard ao vivo

- Somente `TrackedUser` ativo do tenant/guild será incluído.
- Campos retornados serão reduzidos ao necessário para cada papel.
- Transições e canais não revelarão pessoas fora do rastreamento.

## Etapa 5 — LGPD, observabilidade e ciclo de dados

### Retenção

- Implementar worker de purge por tenant conforme `dataRetentionDays`.
- Aplicar retenção a sessões de presença/voz, eventos de texto, transições,
  snapshots, entregas e dados derivados aplicáveis.
- Índices TTL só serão usados quando a expiração puder ser definida por
  documento sem violar a política por plano.
- O worker será idempotente, observável e seguro em PM2 cluster.

### Exclusão e anonimização

- Criar serviço central que localiza dados do titular por tenant e Discord.
- Excluir dados que não precisam ser preservados.
- Anonimizar agregados que devam permanecer por obrigação legítima.
- Registrar solicitação, execução e resultado sem reter PII desnecessária.
- Documentar tratamento de backups e prazo operacional.

### Auditoria e logs

- Registrar exportações, alterações de papel, vínculo Discord, configurações,
  billing e ações administrativas.
- Configurar redaction central de tokens, cookies, endpoints push, emails e
  headers sensíveis.
- Sentry não receberá email bruto nem query strings sensíveis.
- IDs enviados a terceiros serão pseudonimizados quando possível.

### Web Push

- Não inscrever automaticamente sem decisão do usuário.
- Remover assinatura no logout, troca de tenant ou perda de papel.
- Definir expiração e limpeza de assinaturas.
- Payload conterá apenas tipo, contagem e identificador opaco.
- A autorização será revalidada antes do envio.

## Migração e compatibilidade

- Novas variáveis de secrets JWT serão obrigatórias em produção.
- Deploy seguirá ordem compatível:
  1. modelos e código que aceitam estado antigo controlado;
  2. criação de índices após saneamento;
  3. ativação dos novos secrets;
  4. invalidação planejada das sessões antigas.
- A mudança de sessão encerrará logins antigos de forma intencional.
- Conexões de guild duplicadas deverão ser detectadas e resolvidas antes do
  índice único.
- Atualizações de dependências com breaking change exigirão build e testes E2E.

## Tratamento de erros

- Erros públicos não retornarão mensagens de Mongoose, Stripe, Discord ou
  stack traces.
- Falhas de autorização retornarão `401` ou `403` consistentemente.
- Conflitos de identidade/guild retornarão `409`.
- Limites de payload retornarão `413`.
- Integrações indisponíveis terão timeout e resposta controlada.
- Logs internos usarão identificador de correlação e redaction.

## Estratégia de testes

### Backend

- Testes unitários para JWT, rotação/replay, URL pública, CSV e retenção.
- Testes de integração com dois tenants, duas guilds e papéis distintos.
- Testes negativos para access/refresh cruzados.
- Testes concorrentes para guild única e refresh de uso único.
- Testes do Stripe com assinatura válida, eventos idempotentes e cancelamento.
- Testes do WebSocket para Origin, expiração, payload, flood control e
  membership revogada.
- Testes LGPD de purge, anonimização e isolamento por tenant.

### Frontend

- Fluxo de solicitação e aprovação de vínculo.
- Access token não persistido em `localStorage`.
- Logout remove sessão, assinatura push e contexto tenant.
- Guards continuam funcionando, sem serem tratados como controle backend.
- Build de produção e smoke E2E das rotas críticas.

### Infraestrutura e CI

- `docker compose config`.
- Inicialização sem MongoDB publicado no host.
- Verificação dos headers Nginx.
- `npm audit --omit=dev`.
- Gitleaks em arquivos e histórico.
- Testes, lint/typecheck e build dos dois workspaces.

## Critérios de aceite

- Nenhum refresh token é aceito como access token.
- Logout e replay revogam a família de sessão.
- Nenhuma guild pode ser ativa em dois tenants.
- Nenhum sync acessa guild de outro tenant.
- Viewer não altera configurações.
- Vínculo Discord exige aprovação válida.
- SSRF bloqueia destinos não públicos inclusive por DNS, IPv6 e redirect.
- WebSocket limita recursos e encerra autorização expirada.
- Dashboard live contém somente membros rastreados ativos.
- Recursos pagos são negados sem entitlement ativo.
- Retenção, exclusão, auditoria e redaction possuem testes.
- Dependências produtivas não apresentam vulnerabilidades críticas ou altas
  conhecidas sem aceite documentado.
- Todos os testes, builds e verificações aplicáveis passam antes do último
  commit.

## Limitações

- A correção no repositório não substitui revisão de firewall, security groups,
  DNS, certificados, backups e configuração do Nginx instalado no servidor.
- A validação jurídica da base legal, textos de consentimento e prazos LGPD
  requer responsável jurídico ou DPO.
- Pentest/DAST autorizado continua necessário para validar o sistema em
  execução.
