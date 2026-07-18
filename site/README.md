# Syntra — site marketing

Landing B2B estática (Astro), separada do app Angular em `frontend/`.

Copy alinhada ao brief [SYN-32](../docs) v1.1 + claims [SYN-35]. Tagline: *Saiba quem está colaborando — e quem sumiu — no Discord do seu time.*

## Pré-requisitos

- Node.js ≥ 22

## Setup

```bash
cd site
cp .env.example .env   # opcional
npm install
npm run dev
```

Abra [http://localhost:4321](http://localhost:4321).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Preview local (porta 4321) |
| `npm run build` | Build estático em `dist/` |
| `npm run preview` | Serve o build |
| `npm run check` | Typecheck Astro |

Na raiz do monorepo:

```bash
npm run dev:site
npm run build:site
```

## Env

| Variável | Padrão | Uso |
|----------|--------|-----|
| `PUBLIC_APP_URL` | `http://localhost:4200` | Base do app (CTA → `/signup`, Entrar → `/signin`) |
| `PUBLIC_SITE_URL` | `http://localhost:4321` | URL canônica / OG |
| `PUBLIC_BASE_PATH` | `/` | Base path (GitHub Pages: `/discord-tracker`) |

### Soft-launch público

- **URL canônica (GitHub Pages):** https://pasetto.github.io/discord-tracker/
- Workflow: `.github/workflows/pages-site.yml` (build + deploy em push `main` / `workflow_dispatch`)
- Configure a variable de repositório `PUBLIC_APP_URL` apontando para o app Angular piloto (CTA Criar conta)
- O deploy SSH (`deploy.yml`) também publica `site/dist` via `pm2 serve` na porta **4321** do host piloto

Checklist operacional: ver [`SOFT_LAUNCH.md`](./SOFT_LAUNCH.md).

## Seções

1. Nav + Hero (brand-first)
2. Problema
3. Anti-posicionamento
4. Como funciona
5. Privacidade como produto
6. O que você vê (shipped)
7. Para quem é / não é
8. FAQ
9. CTA final
10. Footer (stubs legais + teaser Planos em BRL)

## Soft-launch stubs

- Meta title/description + OG/Twitter (`og.png` 1200×630 + `og-stub.svg` fallback)
- JSON-LD `SoftwareApplication`, `robots.txt`, `sitemap.xml`
- `window.__SYNTRA_ANALYTICS__` com `track()` + captura de clique em CTA Criar conta
- Âncoras legais `#privacidade-stub` / `#termos-stub` (rascunho)

Checklist operacional: ver [`SOFT_LAUNCH.md`](./SOFT_LAUNCH.md) nesta pasta (também anexado em [SYN-34](/SYN/issues/SYN-34)).

## Design

- Tipografia: Bricolage Grotesque + Public Sans
- Paleta OKLCH: tinta profunda (hue 250) + sinal teal + alerta âmbar (sem purple-gradient / cream genérico)
- Hero full-bleed: atmosfera remota (notebook + time em chamada)
