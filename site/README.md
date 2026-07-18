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

- Meta title/description + OG/Twitter
- `public/og-stub.svg` (substituir por PNG/JPG na polish [SYN-34])
- `window.__SYNTRA_ANALYTICS__ = { provider: 'stub' }`

## Design

- Tipografia: Bricolage Grotesque + Public Sans
- Paleta OKLCH: tinta profunda + sinal teal + alerta âmbar (sem purple-gradient genérico)
- Hero full-bleed com atmosfera de time remoto
