# SYN-118 — Brief executável: `site/` B2B (estrutura Sentry)

**Status:** pronto para FoundingEngineer ([SYN-119](/SYN/issues/SYN-119))  
**Pai:** [SYN-117](/SYN/issues/SYN-117)  
**Superfície:** Astro em `site/` (não Angular)  
**Copy base:** [docs/marketing/syn-64-copy-pack.md](./syn-64-copy-pack.md) — preservar strings; este brief muda **IA/layout/motion**, não o tom.

---

## 0. Contexto de usuário e job

| Campo | Valor |
|-------|--------|
| Quem | Gestor / founder de time remoto que já usa Discord como HQ |
| Job nesta página | Em &lt;5s: “Syntra me mostra quem sumiu na colaboração — sem ler mensagens” |
| Sucesso | Clica **Criar conta** ou entende o anti-posicionamento e segue para `#como-funciona` / pricing |
| Não-job | Comparar feature-matrix genérica; “produtividade”; timesheet legal |

---

## 1. Design critique (estado atual `site/`)

### Must-fix (bloqueia “vendável”)

- **Layout / hero budget:** Hero é grid 2 colunas com mock em **card inset** (borda, radius, shadow). Viola full-bleed + “sem cards no hero”. **Try:** plano visual edge-to-edge; mock como superfície de produto no plano do hero, não flutuando como card de marketing.
- **IA / produto:** Falta bloco de **produto em seções** (padrão Sentry “Developer first” → deep features). Hoje: problema → anti → how → privacy → pricing. Gestor não vê inatividade / metas / PTO / sinais / gamificação como ofertas distintas. **Try:** 4–5 seções one-job com âncora visual mínima (mock strip ou screenshot-like), não grid de 3 cards genéricos.
- **Hierarchy:** Tension list e steps usam o mesmo padrão “card border + hover lift” — competem com o mock. **Try:** problema = 3 linhas tipográficas (sem card); steps = lista numerada em faixa única.

### Should-fix

- **Affordance:** Toggle Sem/Com Syntra ok; reforçar default **Com Syntra** e tornar chips “Sumiu” o único sinal de alerta (âmbar), nunca roxo.
- **States:** Pricing error já existe; garantir empty/loading copy do pack SYN-64.
- **A11y:** Manter radiogroup; touch ≥44px nos toggles; reduced-motion sem `opacity: 0` preso.
- **Consistency:** Tokens OKLCH atuais são bons — **não** reinventar paleta; só reorganizar layout.

### Nice-to-fix

- Nav com âncoras `#produto` / `#pricing` (Sentry-like) além de Entrar / Criar conta.
- `prefers-color-scheme` só se tokens dark já espelharem as faixas anti/CTA (não bloquear).

### Strengths to keep

- Copy PT-BR do pack SYN-64 (H1, sub, mock, FAQ, anti-claims).
- Tokens: tinta hue ~250 + signal teal + alert âmbar; Bricolage + Public Sans.
- Faixas escuras anti + CTA final (ritmo light/dark sem theme toggle).
- Motion hooks `data-motion` + Vitest já no workspace.

---

## 2. Mapa estrutural Sentry → Syntra

Referência de **estrutura/ritmo** apenas ([sentry.io/welcome](https://sentry.io/welcome/)) — **não** clonar marca, tipografia, ou purple Sentry.

| # | Sentry (padrão) | Syntra (`site/`) | Notas de layout |
|---|-----------------|------------------|-----------------|
| 0 | Nav sticky: logo + CTAs | Igual: logo + Entrar (quiet) + Criar conta (filled) | Opcional: links Produto / Planos |
| 1 | Hero full-bleed: H1 + sub + CTA + visual | Hero full-bleed: **logo Syntra** + H1 + sub + CTAs + **mock “Time agora”** dominante | Sem stats, sem cards, sem pills |
| 2 | “Developer first” feature grid | **Produto** — 5 one-job sections (ver §4) | Alternar paper / paper-2; sem card grid 3×N |
| 3 | Trust / social proof | **Anti-confiança** (não logos inventados) | Faixa dark: não timesheet / não Jira / não spyware |
| 4 | “Get started in minutes” | **Como funciona** 3 passos | Lista numerada, não 3 cards |
| 5 | Pricing / CTA | **Planos em BRL** (API + fallback) | Cards só aqui (interação de escolha) |
| 6 | FAQ implícito / security | **FAQ** + **CTA final** dark | Stubs legais no footer |
| 7 | Footer | Footer Syntra + Privacidade / Termos / Contato | Manter teaser Planos em BRL |

Ordem de seções no DOM (obrigatória):

1. `nav`  
2. `hero` (`data-testid="landing-hero"`)  
3. `problem` (tensão tipográfica, sem cards)  
4. `product` band — âncora `#produto` com 5 subseções  
5. `anti` (dark)  
6. `how` (`#como-funciona`)  
7. `privacy` (pode fundir bullets com anti se espaço apertar; preferir seção própria curta)  
8. `pricing` (`#pricing`)  
9. `faq`  
10. `cta` final  
11. legal stubs + `footer`

---

## 3. Tokens e tipografia (não reinventar)

Preservar `site/src/styles/global.css` como fonte. Ajustes permitidos: spacing do hero full-bleed, contraste overlay.

### Cor (OKLCH — committed)

| Token | Papel |
|-------|--------|
| `--ink` / `--ink-soft` | Texto light surface |
| `--paper` / `--paper-2` | Fundo marketing + ritmo de seção |
| `--signal` / `--signal-deep` | CTA primary, ênfase positiva “Colaborando” |
| `--alert` | Chip / destaque **Sumiu** apenas |
| `--surface-dark` + texto paper | Anti + CTA final (dark intentional) |
| `--hero-veil` | Overlay sobre atmosfera full-bleed se usar foto/gradiente |

**Proibido:** purple-on-white, cream+serif terracotta, glow multi-layer, pills rounded-full de feature.

### Tipografia

| Nível | Família | Tamanho fluido (manter clamp atual ±) |
|-------|---------|----------------------------------------|
| Display H1 | Bricolage Grotesque 650 | `clamp(2.35rem … 4.25rem)` — max ≤ 4.25rem |
| H2 seção | Bricolage | `clamp(1.75rem … 2.65rem)` |
| Body | Public Sans | ~1.0625rem / 1.65 |
| Micro trust | Public Sans | 0.9rem `--muted` |

Letter-spacing display ≥ `-0.04em` (já ~`-0.025em` — ok).

### Light / dark

- **Default:** light marketing (`--paper`).
- **Dark bands:** anti + CTA final (já existem) — isso satisfaz contraste light/dark sem theme switch.
- **Dark mode OS:** opcional; se implementado, espelhar ink/paper; mock continua light (UI produto).

### Breakpoints

| Viewport | Hero | Produto |
|----------|------|---------|
| &lt;720px | Copy stack → mock full-bleed width abaixo | Subseções stack |
| ≥960px | Copy sobre/ao lado do plano visual; mock ≥50% viewport width do hero | Alternar texto↔visual |

---

## 4. Hero full-bleed + mock “quem sumiu”

### Composição (budget rígido)

No primeiro viewport, **somente**:

1. Logo Syntra (hero-level — brand test: remover nav e ainda é Syntra)  
2. Um H1  
3. Uma sub (2–3 frases curtas)  
4. Grupo CTA: **Criar conta** + link quiet “Ver como funciona”  
5. Micro trust (uma linha)  
6. Visual dominante = mock produto  

**Remover do hero:** cards de tensão, stats, badges flutuantes, footnotes longas (uma legenda curta no mock basta).

### Direção visual

- Contêiner `.hero` **full-bleed** (sair do `.wrap` no fundo; copy pode ficar em wrap interno).
- Fundo: atmosfera atual (radial teal/ink) **ou** imagem remota full-bleed com `--hero-veil` — o mock é o âncora real, não o gradiente.
- Mock: painel “Time agora” ocupando a metade direita (desktop) / full width (mobile), **sem** `box-shadow` de card marketing; chrome mínimo (título + toggle). Borda sutil ok; radius ≤ 0.5rem ou flat no edge do viewport.
- Default toggle: **Com Syntra**.
- Chips: Colaborando (teal), Sumiu (âmbar `--alert`), Em PTO (ink soft). Sem Syntra: todos “Online” neutro.

### Copy hero (fonte SYN-64 — não alterar sem ticket)

| Slot | Copy |
|------|------|
| H1 | Quem sumiu no Discord do seu time — antes do atraso virar crise. |
| Sub | Radar de colaboração para gestores remotos. Você vê quem está no jogo e quem sumiu, com calendário e PTO no contexto. Sem ler mensagens. Sem gravar áudio. |
| CTA | Criar conta |
| Secundário | Ver como funciona |
| Micro | Sem cartão no teste. Setup em minutos. Só metadados. |

Mock strings: manter §1.3 do pack SYN-64.

---

## 5. Seções de produto (one job each)

Cada subseção: **1 H3 + 1 frase + 1 âncora visual leve** (lista de 2–3 bullets OU strip mock CSS). Sem cards empilhados. Sem “produtividade”.

| ID | Job | H3 | Lead (1 frase) | Visual |
|----|-----|----|----------------|--------|
| `#inatividade` | Quem sumiu | Saiba quem sumiu — hoje | Relatório e alertas de inatividade com contexto de jornada, não só “online”. | Strip 2–3 nomes + chip Sumiu |
| `#metas` | Metas individuais | Metas por pessoa, não por feeling | Acompanhe metas individuais de colaboração no escopo do time. | Linha meta simples (barra / % neutro) |
| `#calendario` | PTO / calendário | PTO e calendário no radar | Ausência planejada reduz falso “sumiu”. | Chip Em PTO destacado |
| `#sinais` | Metadados | Sinais de texto sem ler o texto | Atividade em canal como metadado — conteúdo fora. | Ícone/linha “metadado ≠ mensagem” |
| `#gamificacao` | Gamificação (Team+) | Ranking e conquistas no plano certo | Gamificação e ranking quando o plano e as settings permitem — colaboração visível, sem ranking tóxico no marketing. | Nota curta “plano Team+”; sem inventar números |

**Copy anti (faixa dark) — manter:**

- H2: Visibilidade de colaboração. Sem vigilância de conteúdo.  
- Anti 1–3: Não é timesheet legal / Não é Jira / Não é spyware (+ bodies atuais).

**Problema (sem cards):**

- H2 + lead SYN-64.  
- Três tensões como `<dl>` ou linhas com `strong` + span — **sem** border-box card.

**Como funciona:** H2 + lead + 3 passos numerados em lista vertical (desktop: 3 colunas tipográficas **sem** card chrome).

---

## 6. Motion intent (exatamente 3)

Implementação: anime.js client-only existente. **Não** adicionar quarta timeline “decorativa”.

| # | Nome | Trigger | Comportamento | Reduced motion |
|---|------|---------|---------------|----------------|
| 1 | **Hero entrance** | Load | Stagger: brand → H1 → sub → CTAs → mock chrome → members (ease-out, ~280–400ms total feel) | Tudo visível; sem opacity gate |
| 2 | **Scroll reveal** | Intersection once por seção | Heading + lead + children; play once (`data-motion-played`) | Instant visible |
| 3 | **Chip Sumiu** | Hero entrance (modo Com) + toggle Com | Chips `data-status="missing"`: breve atenção (opacity/scale ≤1.04 ou flash âmbar 180ms) — **único** micro-destaque | Swap estático de labels |

**Proibido:** bounce/elastic; stagger idêntico em todo card; hover lift em hero; animar layout width/height.

**Bugfix esperado em [SYN-119](/SYN/issues/SYN-119):** console limpo; não deixar `has-motion` com `opacity: 0` se timeline falhar; cancelar toggle mid-flight sem race.

---

## 7. CTAs, pricing, FAQ

| Elemento | Spec |
|----------|------|
| CTA primary | Sempre **Criar conta** → `PUBLIC_APP_URL/signup` |
| Entrar | Quiet → `/signin` |
| Pricing | Cards **permitidos** (escolha interativa); dados API + fallback; copy SYN-64 |
| FAQ | Manter 6 Q&As atuais; sem inventar prova social |
| Prova | Mock + planos reais apenas — zero logos/depoimentos inventados |

---

## 8. Acceptance criteria (para FE + QA)

- [ ] Ordem de seções = §2; âncoras `#produto`, `#como-funciona`, `#pricing` funcionam  
- [ ] Hero full-bleed: brand + 1 H1 + 1 sub + CTAs + mock dominante; **zero** cards/stats no primeiro viewport  
- [ ] Brand test: sem nav, composição ainda grita Syntra (logo hero-level)  
- [ ] 5 product one-jobs presentes com copy colaboração-only  
- [ ] Problema e how **sem** card chrome de marketing  
- [ ] Anti + CTA final em dark band  
- [ ] 3 motions apenas (§6); `prefers-reduced-motion` ok; console limpo  
- [ ] Copy sem a palavra “produtividade” / “produtivo”  
- [ ] Mobile + desktop legíveis; CTAs ≥44px touch  
- [ ] `npm run test` + `npm run build` no workspace `site/` verdes  

---

## 9. Fora de escopo

- App Angular / TailAdmin  
- Rebrand / nova fonte fora Bricolage + Public Sans  
- Mudança de pricing Stripe / claims inventados  
- SEO profundo / ads  
- Clone visual da marca Sentry  

---

## 10. Handoff

**Owner próximo:** FoundingEngineer em [SYN-119](/SYN/issues/SYN-119) (implement + motion fix).  
**QA:** filho QA do [SYN-117](/SYN/issues/SYN-117) após implement.  

Arquivo no repo: `docs/marketing/2026-07-22-syn-118-site-b2b-brief.md` (espelho do documento do issue).
