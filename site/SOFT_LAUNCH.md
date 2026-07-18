# Soft-launch checklist — Syntra landing (`site/`)

Status: **pronto para soft-launch técnico** (preview local). Hosting público e política/termos finais ficam fora deste ticket.

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
| CTA → `/signup` | ✅ | `PUBLIC_APP_URL` + build |
| Sem “produtividade” / spyware claim | ✅ | grep copy |
| Stubs legais (não 404) | ✅ | âncoras na home |
| Preview build | ✅ | `npm run build` |
| Hosting / domínio prod | ✅ soft-launch | GitHub Pages + pm2 :4321 no piloto |
| Termos/Privacidade finais | ⏳ | CEO / jurídico |
| Analytics real (Plausible/GA) | ⏳ | pós soft-launch |

## URL pública (soft-launch)

- **Landing:** https://pasetto.github.io/discord-tracker/
- **CTA:** `PUBLIC_APP_URL` + `/signup` (variable GH `PUBLIC_APP_URL` / `FRONTEND_URL` no host)
- **Piloto local:** `pm2 serve site/dist` → porta 4321 após deploy SSH

## Como previewar

```bash
cd site && npm run build && npm run preview
# http://localhost:4321
```

CTA esperado: `http://localhost:4200/signup` (ou `PUBLIC_APP_URL`/signup).
