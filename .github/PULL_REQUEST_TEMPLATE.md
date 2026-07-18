## Resumo

<!-- O que mudou e por quê (1–3 frases). -->

## Escopo

- [ ] Backend (`backend/`)
- [ ] Frontend (`frontend/`)
- [ ] Docs / CI / infra (sem lógica de produto)

## Geração de testes (obrigatório)

> Código novo ou alterado **exige** testes novos/atualizados no workspace tocado.
> Feature full-stack exige **FE e BE**. Exceção: PR só documental/infra sem lógica de produto.

- [ ] Se alterei `backend/`: incluí ou atualizei specs em `backend/tests/` cobrindo o comportamento
- [ ] Se alterei `frontend/`: incluí ou atualizei `.spec.ts` cobrindo o comportamento
- [ ] Se alterei **ambos**: cobri FE **e** BE (não só um lado)
- [ ] N/A — PR só docs/CI/templates (sem lógica de produto)

### Comandos locais (marque o que rodou)

```bash
# Backend (se backend/ mudou)
npm run test --workspace=backend
# opcional / espelha CI:
# npm run test:coverage --workspace=backend
# npm run lint --workspace=backend

# Frontend (se frontend/ mudou)
npm run test --workspace=frontend
# opcional / espelha CI:
# npm run test:coverage --workspace=frontend
```

- [ ] Rodei os testes do(s) workspace(s) alterado(s) localmente (ou equivalente scoped)
- [ ] Confirmei que os jobs CI abaixo estão verdes neste PR

### Jobs CI required (`main` / `dev`)

- [ ] `Backend (Vitest + lint)`
- [ ] `Frontend (Karma + build)`
- [ ] `Frontend E2E (Playwright)`

## Checklist geral

- [ ] Sem secrets / credenciais / dados de cliente no diff
- [ ] JSDoc em novos exports públicos (backend)
- [ ] Swagger/OpenAPI atualizado se nova rota API
- [ ] UI: terminologia **colaboração** (nunca “produtividade”)
- [ ] UI responsiva (se alterou frontend)
- [ ] Multitenant: queries com `organizationId` validado

## Como testar / evidência

<!-- Passos de repro ou link para evidência (logs CI, screenshot se UI). -->
