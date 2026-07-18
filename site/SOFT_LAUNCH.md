# Soft-launch checklist — Syntra landing (`site/`)

Status: **soft-launch público no ar.** Funil LP → signup operacional; call comercial ainda tem pendências legais/analytics.

| Campo | Valor |
|-------|-------|
| Landing (público) | https://pasetto.github.io/discord-tracker/ |
| CTA signup | https://disc.econdos.com.br/signup |
| `PUBLIC_APP_URL` | `https://disc.econdos.com.br` |
| Evidência de hosting | SYN-41 |
| CRO funil (SYN-48) | Tagline no hero + microcopy “sem cartão” nos CTAs |

## O que ainda bloqueia call comercial

| Item | Soft-launch técnico | Call comercial / outbound | Owner | Ação |
|------|---------------------|---------------------------|-------|------|
| Termos / Privacidade finais | ❌ Não bloqueia (stubs âncora OK) | ✅ **Bloqueia** confiança B2B formal | CEO / jurídico | Publicar páginas finais; trocar stubs |
| Analytics real (Plausible/GA/PostHog) | ❌ Não bloqueia (stub `track`) | ⚠️ **Parcial** — sem taxa LP→signup mensurável | Growth (+ FE se env) | Trocar stub por provider; manter `cta_criar_conta` |
| CRO CTA live (SYN-48) | Após merge → Pages | Não bloqueia call | FoundingEngineer | Merge PR → workflow `pages-site` |
| Domínio próprio / brand URL | Não | Nice-to-have | CEO | Decisão de marca |
| Pricing na LP | Fora de escopo | Teaser “Planos em BRL” só | CEO | Não inventar números sem aprovação |

**Resumo:** dá para enviar a LP em soft-launch e deixar o visitante criar conta. **Não** use a LP como peça de proposta comercial formal enquanto Termos/Privacidade forem rascunho. Analytics real é pré-requisito para otimizar o funil com dados — não para o primeiro clique.

## CRO SYN-48 (1 melhoria)

**Hipótese:** o medo de cartão e a tagline completa estavam enterrados (FAQ / sub genérico). Trazer ambos para o cluster do CTA primário reduz atrito LP → signup sem inventar produto.

**Mudança:**
- Hero sub = tagline oficial (“Saiba quem está colaborando — e quem sumiu…”)
- Microcopy hero + CTA final = `Sem cartão no teste · Setup em minutos · Só metadados`
- CTA final reforça a mesma frase de job

**Não mudou:** H1 (clareza “quem sumiu” &lt;10s), um CTA primário “Criar conta”, anti-posicionamento, claims shipped.

## Critique impeccable (síntese)

⚠️ DEGRADED: single-context (sub-agent spawn failed: usage limit; detect.mjs indisponível no runtime Paperclip markdown_only).

### Must-fix aplicados
- OG com encoding quebrado → `public/og.png` 1200×630 + `og-stub.svg` UTF-8
- Links legais mortos (`#privacidade-stub` / `#termos-stub`) → seções rascunho
- Hero genérico “time no escritório” → atmosfera remota (notebook + call grid)
- Paper cream-tinted (AI tell) → neutros tintados hue 250

### Should-fix aplicados
- SEO: `robots.txt`, `sitemap.xml`, JSON-LD SoftwareApplication, `og:image:width/height`
- Analytics stub com `track('cta_criar_conta')` em cliques de signup
- Contraste ink-soft / muted levemente reforçado

### Strengths mantidos
- Brand-first hero (Syntra hero-level + H1 “quem sumiu”)
- Anti-posicionamento explícito + FAQ de vigilância
- Um CTA primário (Criar conta); sem cards no hero; tipografia distinta

## Checklist soft-launch

| Item | Status | Evidência |
|------|--------|-----------|
| Title + meta description PT-BR | ✅ | `BaseLayout.astro` |
| Canonical + `lang="pt-BR"` | ✅ | layout |
| OG + Twitter cards | ✅ | `og.png` |
| Favicon | ✅ | `favicon.svg` |
| robots.txt + sitemap | ✅ | `public/` |
| JSON-LD | ✅ | SoftwareApplication |
| Analytics stub | ✅ | `__SYNTRA_ANALYTICS__` |
| CTA → `/signup` | ✅ | `PUBLIC_APP_URL=https://disc.econdos.com.br` → https://disc.econdos.com.br/signup |
| Funil LP → signup (HTTP 200) | ✅ | verificado SYN-48 |
| CRO: tagline + “sem cartão” no CTA | ⏳ merge | branch `feat/syn-48-cro-funnel` |
| Sem “produtividade” / spyware claim | ✅ | grep copy |
| Stubs legais (não 404) | ✅ | âncoras na home |
| Preview build | ✅ | `npm run build` |
| Hosting / domínio prod | ✅ | https://pasetto.github.io/discord-tracker/ |
| Termos/Privacidade finais | ⏳ | CEO / jurídico — **bloqueia call comercial** |
| Analytics real (Plausible/GA) | ⏳ | Growth — **bloqueia otimização de funil** |

## URLs públicas (produção)

- **Landing:** https://pasetto.github.io/discord-tracker/
- **CTA Criar conta:** https://disc.econdos.com.br/signup
- **App (`PUBLIC_APP_URL`):** `https://disc.econdos.com.br`

## Como previewar (local)

```bash
cd site && npm run build && npm run preview
# http://localhost:4321
```

Para espelhar produção localmente: `PUBLIC_APP_URL=https://disc.econdos.com.br npm run build`.
