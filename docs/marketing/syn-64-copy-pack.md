# SYN-64 — Copy pack + brief de interatividade (humanizer)

**Status:** pronto para consumo pelo FoundingEngineer ([SYN-65](/SYN/issues/SYN-65))  
**Pai:** [SYN-62](/SYN/issues/SYN-62)  
**Fonte de verdade:** `.agents/product-marketing.md` v1.2 + claims [SYN-35](/SYN/issues/SYN-35)  
**Superfície de implementação:** `frontend/src/app/features/landing/` (Angular). O site Astro em `site/` pode espelhar depois; este pack prioriza a landing do app.

---

## 0. Decisões de CRO (aplicar junto com o copy)

| Decisão | Valor |
|---------|--------|
| CTA primário | **Criar conta** → `/signup` (único botão filled no hero e no pricing) |
| CTA secundário | **Entrar** → `/login` (link quiet / outline, nunca competir visualmente) |
| Remover do hero | link **Ver cases** (não há cases reais; inventar prova é proibido) |
| Job em &lt;10s | Visitante entende: gestor vê quem sumiu no Discord, com PTO/calendário, sem ler mensagens |
| Prova | Demo visual (mock) + planos reais da API. Sem depoimento, sem ROI %, sem logos de cliente inventados |
| Objeção #1 | “Vira vigilância?” → nomear e desarmar na privacidade + no mock “só metadados” |

---

## 1. Copy pack (PT-BR final — pós-humanizer)

Use os strings abaixo como fonte. Não “embelezar” com jargão de brochure.

### 1.1 Nav / header

| Slot | Copy |
|------|------|
| Brand | Logo Syntra (`logo.svg` / `logo-dark.svg` conforme tema) + texto “Syntra” (sr-only se o logo já tiver wordmark) |
| Primary CTA | Criar conta |
| Secondary | Entrar |

### 1.2 Hero

| Slot | Copy |
|------|------|
| H1 | Quem sumiu no Discord do seu time — antes do atraso virar crise. |
| Sub | Radar de colaboração para gestores remotos. Você vê quem está no jogo e quem sumiu, com calendário e PTO no contexto. Sem ler mensagens. Sem gravar áudio. |
| Micro trust (abaixo do CTA) | Sem cartão no teste. Setup em minutos. Só metadados. |
| CTA | Criar conta |
| Link terciário (opcional, quiet) | Ver como funciona → `#como-funciona` |

**Nota de marca (impeccable):** o nome Syntra / logo é o sinal hero-level. Não empilhar eyebrow “Syntra” + H1 longo + pills de stats. Uma composição: logo, H1, sub, CTA, mock interativo.

### 1.3 Bloco interativo (copy da UI do mock)

| Slot | Copy |
|------|------|
| Título do painel | Time agora |
| Toggle A | Sem Syntra |
| Toggle B | Com Syntra |
| Estado A (headline) | Todo mundo “online”. Ninguém sabe quem sumiu. |
| Estado A (linha) | AFK misturado com trabalho. PTO fora da cabeça. |
| Estado B (headline) | Três pessoas sumiram da colaboração hoje. |
| Estado B (chip ok) | Colaborando |
| Estado B (chip warn) | Sumiu |
| Estado B (chip info) | Em PTO |
| Legenda | Ilustração. Não é dado do seu servidor. |
| Nota privacy no mock | Só metadados. Conteúdo de mensagem fica fora. |

**Nomes fictícios no mock (ok, claramente fake):** Ana, Bruno, Camila, Diego, Elena. Avatars com iniciais coloridas (CSS), sem fotos stock genéricas.

### 1.4 Problema

| Slot | Copy |
|------|------|
| H2 | No Discord remoto, o sumiço não avisa. |
| Lead | O servidor está cheio de gente “online”. Depois um entregável atrasa, o clima esfria, ou alguém já pediu demissão em silêncio. Você descobre tarde porque o Discord não tem radar de colaboração: presença diluída, canais misturados, PTO longe da cabeça. |
| Card 1 título | Sinal tardio |
| Card 1 body | Você só nota quando o atraso já virou retrabalho. |
| Card 2 título | Sem contexto |
| Card 2 body | Sumiu de verdade, ou está de PTO / fora da jornada? |
| Card 3 título | Ação às cegas |
| Card 3 body | Energia gasta no lugar errado, conversa difícil sem base. |

### 1.5 Como funciona (`#como-funciona`)

| Slot | Copy |
|------|------|
| H2 | Do Discord ao alerta, em três passos. |
| Lead | Conecta o servidor, escolhe os canais, e o Syntra mostra quem sumiu com o contexto que o gestor precisa. |
| Passo 1 título | Conecte o servidor |
| Passo 1 body | Vincule o bot, escolha a guild e marque canais de trabalho, AFK, almoço e ignorados na UI. |
| Passo 2 título | Syntra lê sinais (só metadados) |
| Passo 2 body | Presença, tempo em voz colaborativa e atividade de texto. Sem guardar o que foi dito. |
| Passo 3 título | Aja cedo |
| Passo 3 body | Relatório de inatividade, calendário/PTO no contexto, push quando alguém some, time ao vivo quando precisa do “agora”. |
| Nota | Onboarding guiado: da conta à primeira visão de colaboração em minutos, não em semanas. |

### 1.6 Privacidade / anti-vigilância

| Slot | Copy |
|------|------|
| H2 | Privacidade não é rodapé. É o produto. |
| Lead | Textos e calls importam para o trabalho. O Syntra não precisa do conteúdo para te avisar quem sumiu. Metadados mínimos, canais que você escolhe, portal do colaborador para ver os próprios dados. |
| Bullet 1 | Sem conteúdo de mensagem, áudio ou DM. |
| Bullet 2 | Escopo de canais definido por você. |
| Bullet 3 | Não é ponto eletrônico, timesheet legal, screenshot nem keylogger. |
| Bullet 4 | Feito para confiança do time, não para surpresa na sexta. |
| Anti-bloco H3 (opcional, se couber layout) | O que o Syntra não é |
| Anti 1 | Não é timesheet legal. |
| Anti 2 | Não é Jira. |
| Anti 3 | Não é spyware de conteúdo. |

### 1.7 Pricing intro (dados dos cards = API)

| Slot | Copy |
|------|------|
| H2 | Planos em BRL |
| Lead | Preços e limites vêm da API pública. Escolha o plano, crie a conta, teste sem cartão. |
| Badge featured | Mais popular |
| CTA card | Criar conta |
| Loading | Carregando planos… |
| Empty/erro | Não deu para carregar os planos agora. Você ainda pode criar a conta e ver os planos depois. |

**Proibido no pricing:** inventar preço, inventar feature list se a API falhar (fallback local ok se já existir e for verdade), “melhor custo-benefício do mercado”, ROI %.

### 1.8 CTA final (se a página ganhar footer CTA; senão repetir no pricing)

| Slot | Copy |
|------|------|
| H2 | Pare de descobrir sumiço tarde demais. |
| Body | Crie a conta e veja quem está colaborando, e quem sumiu, no Discord do seu time. |
| CTA | Criar conta |
| Trust | Sem cartão no teste. Só metadados. Sem ler mensagens. |

### 1.9 FAQ mínimo (se FE ainda não tiver; prioridade P1)

| Q | A |
|---|---|
| Vocês leem as mensagens do time? | Não. Sinais de texto são metadados (ex.: houve atividade no canal). Conteúdo de mensagem, áudio e DMs não são armazenados. |
| Isso não vira vigilância? | O objetivo é visibilidade de colaboração e inatividade, com canais que você escolhe e calendário/PTO no contexto. Não é ferramenta para policiar o que as pessoas dizem. |
| Substitui Toggl / timesheet? | Substitui o timer manual como jeito de ver colaboração do time. Não é timesheet legal nem ponto eletrônico. |
| E se a pessoa está de férias? | Ausências planejadas e calendário de trabalho entram no contexto para reduzir falso “sumiu”. |
| Preciso de cartão para testar? | Não. Conta + período de teste da organização sem cartão. Cartão só na assinatura via Stripe. |

---

## 2. Humanizer audit

### 2.1 AI-tells encontrados no copy atual (Angular)

| Trecho / padrão | Por que soa IA | Correção no pack |
|-----------------|----------------|------------------|
| “Visibilidade de colaboração remota com metadados — para agir cedo…” | Em dash + frase genérica de brochure | Sub hero concreto, frases curtas, sem em dash |
| Três CTAs no hero (Criar / Entrar / Ver cases) | Template SaaS; “Ver cases” sem prova | 1 CTA filled + Entrar quiet |
| “A Syntra transforma sinais… em ações simples” | Copula avoidance / verbo mágico “transforma” | “Conecta… mostra quem sumiu…” |
| “mantenha a colaboração do time saudável de forma contínua” | Promotional + vazio | “push quando alguém some… time ao vivo” |
| “Privacidade por padrão” | Slogan genérico de SaaS privacy | “Privacidade não é rodapé. É o produto.” |
| “Planos em BRL para o mercado brasileiro” | Redundante / brochure | “Planos em BRL” |
| “Escolha o plano ideal para…” | “ideal” + soft sell | “Preços e limites vêm da API…” |
| Cards problema com “Falta de contexto / Ação reativa” genéricos | Rule-of-three sem fricção Discord | Linguagem de PTO / jornada / conversa difícil |
| Eyebrow pill “Syntra” | Chip genérico; marca fraca vs logo | Logo real acima do fold |

### 2.2 Checklist humanizer aplicado no pack final

- [x] Sem em dash / en dash no copy entregue
- [x] Sem “produtividade” / “produtivo”
- [x] Sem “vibrant / groundbreaking / pivotal / landscape / underscore”
- [x] Sem “Não é X. É Y.” em loop (anti-claims ficam curtos e concretos)
- [x] Sem depoimento, ROI %, “milhares de times”
- [x] Ritmo misto: H1 curto + sub com 2–3 frases reais
- [x] Objeção de vigilância nomeada no FAQ e no mock

### 2.3 O que ainda poderia soar IA (aceito / FE deve evitar)

- Qualquer stagger idêntico em todos os cards (motion template)
- Gradient roxo default TailAdmin no hero (impeccable: preservar brand Syntra / logo, sem AI-purple)
- Microcopy “Começar agora” nos cards → padronizar para **Criar conta**

---

## 3. Brief de interatividade (P0 / P1)

### P0 — obrigatório neste ciclo ([SYN-65](/SYN/issues/SYN-65))

#### P0.1 Logo Syntra above the fold

- Usar `frontend/public/images/logo/logo.svg` (light) e `logo-dark.svg` (dark).
- Logo no header **e** no hero (marca hero-level). Não substituir por pill de texto.
- Alt: `Syntra`.

#### P0.2 Mock “Time agora / quem sumiu” + avatars

- Painel ao lado ou abaixo do copy do hero (mobile: abaixo do CTA).
- 5 linhas de membro com avatar (iniciais), nome, chip de status.
- Estados controlados pelo toggle P0.3.
- Copy dos chips: ver §1.3.
- Visual: superfície do produto (lista simples), **sem** cards empilhados decorativos, **sem** stock Unsplash no mock.

#### P0.3 Toggle Sem Syntra / Com Syntra

- Controle segmentado acessível (`role="tablist"` ou radiogroup).
- Default: **Com Syntra** (mostra valor).
- Transição: crossfade / opacity 150–250ms, `prefers-reduced-motion: reduce` = troca instantânea.
- Sem Syntra: todos chips neutros “Online”, headline de confusão.
- Com Syntra: mix Colaborando / Sumiu / Em PTO; headline com contagem.

### P1 — se couber no mesmo PR; senão issue follow-up

#### P1.1 Micro-motion nos passos “Como funciona”

- Entrada leve no scroll (opacity + translateY ≤ 8px), stagger ≤ 80ms.
- Não gatear conteúdo em classe de animação (conteúdo visível sem JS).

#### P1.2 Pricing featured polish

- Manter `PublicPricingService` + `plan.featured` da API.
- Destacar featured com borda/ring brand (já existe); elevar CTA “Criar conta”.
- Empty/erro: copy §1.7.

#### P1.3 FAQ accordion

- 5 perguntas §1.9; um job: desarmar vigilância + timesheet + cartão.

### Fora de escopo (não fazer)

- A/B framework, heatmaps pagos
- Depoimentos / logos de cliente
- Hero com stats inventados, pills de feature, badge “#1”
- Trocar CTA para waitlist
- Claims LGPD “certificado” / ponto legal

---

## 4. Wire curto (para o FE)

```
[Header] logo Syntra |          Entrar   [Criar conta]

[Hero]
  logo
  H1
  sub
  [Criar conta]
  micro trust
                         | [Toggle Sem | Com ]
                         | [Mock lista 5 avatars]
                         | legenda + nota metadados

[Problema] H2 + lead + 3 tensões (sem card-soup se possível; lista ok)

[Como funciona] 3 passos (#como-funciona)

[Privacidade] H2 + 4 bullets (+ anti opcional)

[Planos] H2 + lead + cards API

[FAQ P1]
[Footer CTA opcional]
```

---

## 5. Patch sugerido — `.agents/product-marketing.md` §6

**Antes (v1.1):**

> No price table on v0 landing; teaser “Planos em BRL” only

**Depois (v1.2):**

> Landing do app (`frontend/.../landing`) exibe tabela real via `GET /api/v1/pricing` (`PublicPricingService`). Fallback local só offline/erro. Site Astro (`site/`) pode espelhar depois; não inventar preços no copy.

Arquivo no repo atualizado neste heartbeat (changelog v1.2).

---

## 6. Handoff para FoundingEngineer

1. Ler este documento completo.
2. Implementar P0.1–P0.3 + aplicar strings §1 na landing Angular.
3. Manter planos da API; trocar CTA dos cards para **Criar conta**.
4. Specs: toggle Sem/Com altera chips; logo presente; copy hero atualizado; pricing ainda hidrata da API.
5. PR com autoria `Eduardo Pasetto <eduardo@nanodesign.com.br>` + `Co-Authored-By: Paperclip <noreply@paperclip.ing>`.

**Done deste issue (SYN-64):** pack + audit + brief + patch §6. Implementação = [SYN-65](/SYN/issues/SYN-65).
