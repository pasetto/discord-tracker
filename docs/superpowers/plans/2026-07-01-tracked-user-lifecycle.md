# Ciclo de vida TrackedUser — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desativar automaticamente membros que saíram do Discord e excluí-los dos relatórios operacionais, reativando-os ao retornar, sem perder histórico.

**Architecture:** Soft delete via `isActive`/`removedAt` em `TrackedUser`; sync bidirecional e eventos `guildMemberRemove`/`guildMemberAdd`; helper `findActiveTrackedUsers` centraliza filtro nos serviços de relatório.

**Tech Stack:** Node.js 22, TypeScript, Mongoose, discord.js v14, Vitest, Angular 21

**Spec:** [2026-07-01-tracked-user-lifecycle-design.md](../specs/2026-07-01-tracked-user-lifecycle-design.md)

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `backend/src/db/models/TrackedUser.ts` | Novos campos `isActive`, `removedAt`, `removedReason` |
| `backend/src/services/trackedUserService.ts` | Sync bidirecional, deactivate/reactivate, `findActiveTrackedUsers` |
| `backend/src/bot/events/guildMembers.ts` | Handlers `guildMemberRemove` / `guildMemberAdd` |
| `backend/src/bot/events/ready.ts` | Registrar novos handlers |
| `backend/src/services/inactivityService.ts` | Filtrar ativos no snapshot |
| `backend/src/services/intradayInactivityService.ts` | Filtrar ativos |
| `backend/src/services/gamificationRankingService.ts` | Filtrar ativos |
| `backend/src/services/gamificationInsightsService.ts` | Filtrar ativos |
| `backend/src/services/goalsService.ts` | Filtrar ativos |
| `backend/src/services/textCollaborationReportService.ts` | `isActive: true` no `$lookup` |
| `backend/src/api/routes/me.ts` | Exigir `isActive` no vínculo Discord |
| `frontend/src/app/core/members/tracked-members.service.ts` | Tipar resposta ampliada do sync |
| `frontend/src/app/features/settings/categories/categories-settings.component.ts` | Mensagem de sync com contadores |

---

### Task 1: Modelo e funções base de ciclo de vida

**Files:**
- Modify: `backend/src/db/models/TrackedUser.ts`
- Modify: `backend/src/services/trackedUserService.ts`
- Create: `backend/tests/services/trackedUserService.lifecycle.test.ts`

- [ ] **Step 1: Escrever testes que falham**

```typescript
// backend/tests/services/trackedUserService.lifecycle.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TrackedUserModel } from '../../src/db/models/TrackedUser';
import {
  deactivateTrackedUserByDiscordId,
  reactivateTrackedUserByDiscordId,
  findActiveTrackedUsers,
} from '../../src/services/trackedUserService';

describe('trackedUserService lifecycle', () => {
  let mongod: MongoMemoryServer;
  const organizationId = new Types.ObjectId();
  const guildId = 'guild-life-1';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await TrackedUserModel.syncIndexes();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30000);

  beforeEach(async () => {
    await TrackedUserModel.deleteMany({});
  });

  it('deactivateTrackedUserByDiscordId marca isActive=false e removedAt', async () => {
    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'd1',
      username: 'user1',
      displayName: 'User 1',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      isActive: true,
    });

    const result = await deactivateTrackedUserByDiscordId(String(organizationId), guildId, 'd1');
    expect(result).toBe(true);

    const doc = await TrackedUserModel.findOne({ discordId: 'd1' }).lean();
    expect(doc?.isActive).toBe(false);
    expect(doc?.removedAt).toBeInstanceOf(Date);
    expect(doc?.removedReason).toBe('left_guild');
  });

  it('reactivateTrackedUserByDiscordId restaura isActive e limpa removedAt', async () => {
    const categoryId = new Types.ObjectId();
    await TrackedUserModel.create({
      organizationId,
      guildId,
      discordId: 'd2',
      username: 'user2',
      displayName: 'User 2',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      isActive: false,
      removedAt: new Date(),
      removedReason: 'left_guild',
      categoryId,
    });

    const result = await reactivateTrackedUserByDiscordId(String(organizationId), guildId, 'd2');
    expect(result).toBe(true);

    const doc = await TrackedUserModel.findOne({ discordId: 'd2' }).lean();
    expect(doc?.isActive).toBe(true);
    expect(doc?.removedAt).toBeUndefined();
    expect(doc?.removedReason).toBeUndefined();
    expect(String(doc?.categoryId)).toBe(String(categoryId));
  });

  it('findActiveTrackedUsers retorna somente isActive=true', async () => {
    await TrackedUserModel.create([
      {
        organizationId,
        guildId,
        discordId: 'active',
        username: 'a',
        displayName: 'Active',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      },
      {
        organizationId,
        guildId,
        discordId: 'inactive',
        username: 'i',
        displayName: 'Inactive',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: false,
        removedAt: new Date(),
        removedReason: 'left_guild',
      },
    ]);

    const active = await findActiveTrackedUsers(String(organizationId), guildId);
    expect(active).toHaveLength(1);
    expect(active[0].discordId).toBe('active');
  });
});
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `npm run test --workspace=backend -- tests/services/trackedUserService.lifecycle.test.ts`
Expected: FAIL — exports não existem

- [ ] **Step 3: Implementar modelo e funções**

Em `TrackedUser.ts`, adicionar à interface e schema:

```typescript
export type TrackedUserRemovedReason = 'left_guild';

// interface ITrackedUser:
isActive: boolean;
removedAt?: Date;
removedReason?: TrackedUserRemovedReason;

// schema:
isActive: { type: Boolean, required: true, default: true, index: true },
removedAt: { type: Date, required: false },
removedReason: { type: String, enum: ['left_guild'], required: false },
```

Em `trackedUserService.ts`, implementar `deactivateTrackedUserByDiscordId`, `reactivateTrackedUserByDiscordId`, `findActiveTrackedUsers` conforme spec. Atualizar `upsertTrackedUser` para `$set: { ..., isActive: true }`.

- [ ] **Step 4: Rodar teste e verificar sucesso**

Run: `npm run test --workspace=backend -- tests/services/trackedUserService.lifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/models/TrackedUser.ts backend/src/services/trackedUserService.ts backend/tests/services/trackedUserService.lifecycle.test.ts
git commit -m "feat(backend): adicionar ciclo de vida soft delete em TrackedUser"
```

---

### Task 2: Sync bidirecional

**Files:**
- Modify: `backend/src/services/trackedUserService.ts`
- Modify: `backend/tests/services/trackedUserService.lifecycle.test.ts`

- [ ] **Step 1: Escrever teste de sync com mock do Discord**

Mockar `../../src/bot/client` e validar `deactivatedCount` / `reactivatedCount`.

- [ ] **Step 2: Implementar retorno ampliado e `updateMany` pós-upsert**

```typescript
export interface SyncTrackedUsersResult {
  syncedCount: number;
  deactivatedCount: number;
  reactivatedCount: number;
}
```

- [ ] **Step 3: Rodar testes**

Run: `npm run test --workspace=backend -- tests/services/trackedUserService.lifecycle.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(backend): sync bidirecional desativa membros que saíram do Discord"
```

---

### Task 3: Eventos do bot

**Files:**
- Create: `backend/src/bot/events/guildMembers.ts`
- Modify: `backend/src/bot/events/ready.ts`

- [ ] **Step 1: Implementar `registerGuildMembersHandlers`**

Handlers `guildMemberRemove` → `deactivateTrackedUserByDiscordId`; `guildMemberAdd` → `reactivateTrackedUserByDiscordId` ou `upsertTrackedUser`. Resolver `organizationId` via `listEnabledMonitoredGuilds`.

- [ ] **Step 2: Registrar em `ready.ts`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(bot): desativar/reativar TrackedUser em guildMemberRemove/Add"
```

---

### Task 4: Filtrar relatórios operacionais

**Files:**
- Modify: serviços listados no mapa de arquivos
- Modify: testes de ranking/inatividade

- [ ] **Step 1: Adicionar teste — ranking não inclui inativo**

- [ ] **Step 2: Aplicar `isActive: true` em queries operacionais**

Não alterar `getInactivityHistory` nem `memberJourneyService` (consulta por ID).

- [ ] **Step 3: Rodar suite backend**

Run: `npm run test --workspace=backend`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(backend): relatórios operacionais excluem membros inativos"
```

---

### Task 5: Portal /me

**Files:**
- Modify: `backend/src/api/routes/me.ts`

- [ ] **Step 1: Adicionar `isActive: true` nos `findOne`/`find` do portal colaborador**

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(backend): portal /me exige membro rastreado ativo"
```

---

### Task 6: Frontend — feedback do sync

**Files:**
- Modify: `tracked-members.service.ts`, `categories-settings.component.ts`

- [ ] **Step 1: Tipar `SyncTrackedMembersResponse` com contadores**

- [ ] **Step 2: Mensagem de sucesso com deactivated/reactivated**

- [ ] **Step 3: Rodar testes frontend**

Run: `npm run test --workspace=frontend`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(frontend): exibir contadores de sync de membros rastreados"
```

---

### Task 7: Verificação final

- [ ] **Step 1: Rodar `npm test` na raiz**
- [ ] **Step 2: Commit ajustes finais se necessário**

---

## Self-review (spec coverage)

| Requisito spec | Task |
|----------------|------|
| Campos `isActive`, `removedAt`, `removedReason` | Task 1 |
| Sync bidirecional + contadores | Task 2 |
| Eventos bot remove/add | Task 3 |
| Filtro relatórios operacionais | Task 4 |
| Exceção histórico por membro | Task 4 |
| `/me` exige ativo | Task 5 |
| UI feedback sync | Task 6 |
| Migração via sync pós-deploy | Task 2 |
