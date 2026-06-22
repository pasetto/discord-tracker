import Router from '@koa/router';
import { isValidObjectId } from 'mongoose';
import { MemberCategoryModel } from '../../db/models/MemberCategory';

/**
 * Corpo esperado para criação/atualização de categoria.
 */
interface CategoryPayload {
  name?: string;
  slug?: string;
  color?: string;
}

/**
 * Categorias padrão para onboarding inicial do guild.
 */
const ONBOARDING_CATEGORIES = [
  { name: 'Dev', slug: 'dev', color: '#3b82f6' },
  { name: 'Comercial', slug: 'comercial', color: '#10b981' },
  { name: 'Suporte', slug: 'suporte', color: '#f59e0b' },
  { name: 'Marketing', slug: 'marketing', color: '#ec4899' },
] as const;

/** Rotas CRUD de categorias de membros por guild. */
export const categoriesRouter = new Router();

/**
 * Normaliza nome em slug amigável para URL e índice único.
 * @param value Texto de origem
 * @returns Slug em minúsculas com hífen
 */
function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extrai dados de categoria com validação mínima.
 * @param payload Body recebido no request
 * @returns Categoria normalizada pronta para persistência
 * @throws {Error} Quando nome estiver ausente ou inválido
 */
function buildCategoryData(payload: CategoryPayload | undefined): { name: string; slug: string; color?: string } {
  const name = payload?.name?.trim();
  if (!name) {
    throw new Error('Nome da categoria é obrigatório');
  }

  const computedSlug = payload?.slug?.trim() || toSlug(name);
  const slug = toSlug(computedSlug);
  if (!slug) {
    throw new Error('Slug da categoria é obrigatório');
  }

  const color = payload?.color?.trim() || undefined;
  return { name, slug, color };
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Lista categorias de membros do guild
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de categorias cadastradas
 */
categoriesRouter.get('/guilds/:guildId/categories', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  const categories = await MemberCategoryModel.find({ organizationId, guildId })
    .sort({ name: 1 })
    .lean();

  ctx.body = { categories };
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Cria categoria de membro no guild
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: Categoria criada
 *       400:
 *         description: Payload inválido
 *       409:
 *         description: Slug já existe no guild
 */
categoriesRouter.post('/guilds/:guildId/categories', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  try {
    const data = buildCategoryData(ctx.request.body as CategoryPayload | undefined);
    const category = await MemberCategoryModel.create({
      organizationId,
      guildId,
      ...data,
    });

    ctx.status = 201;
    ctx.body = { category };
  } catch (error) {
    const isDuplicateSlug = typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
    if (isDuplicateSlug) {
      ctx.status = 409;
      ctx.body = { error: 'Já existe categoria com este slug para o guild' };
      return;
    }

    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/{categoryId}:
 *   put:
 *     tags:
 *       - Categories
 *     summary: Atualiza uma categoria existente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *       404:
 *         description: Categoria não encontrada
 */
categoriesRouter.put('/guilds/:guildId/categories/:categoryId', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;
  const categoryId = ctx.params.categoryId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  if (!isValidObjectId(categoryId)) {
    ctx.status = 400;
    ctx.body = { error: 'categoryId inválido' };
    return;
  }

  try {
    const data = buildCategoryData(ctx.request.body as CategoryPayload | undefined);
    const category = await MemberCategoryModel.findOneAndUpdate(
      { _id: categoryId, organizationId, guildId },
      { $set: data },
      { new: true },
    ).lean();

    if (!category) {
      ctx.status = 404;
      ctx.body = { error: 'Categoria não encontrada' };
      return;
    }

    ctx.body = { category };
  } catch (error) {
    const isDuplicateSlug = typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
    if (isDuplicateSlug) {
      ctx.status = 409;
      ctx.body = { error: 'Já existe categoria com este slug para o guild' };
      return;
    }

    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/{categoryId}:
 *   delete:
 *     tags:
 *       - Categories
 *     summary: Remove uma categoria do guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Categoria removida
 *       404:
 *         description: Categoria não encontrada
 */
categoriesRouter.delete('/guilds/:guildId/categories/:categoryId', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;
  const categoryId = ctx.params.categoryId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  if (!isValidObjectId(categoryId)) {
    ctx.status = 400;
    ctx.body = { error: 'categoryId inválido' };
    return;
  }

  const deleted = await MemberCategoryModel.findOneAndDelete({
    _id: categoryId,
    organizationId,
    guildId,
  }).lean();

  if (!deleted) {
    ctx.status = 404;
    ctx.body = { error: 'Categoria não encontrada' };
    return;
  }

  ctx.status = 204;
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/seed:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Cria categorias padrão de onboarding
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categorias padrão aplicadas
 */
categoriesRouter.post('/guilds/:guildId/categories/seed', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  const existingCategories = await MemberCategoryModel.find({ organizationId, guildId })
    .select({ slug: 1 })
    .lean();
  const existingSlugs = new Set(existingCategories.map((category) => category.slug));

  const categoriesToCreate = ONBOARDING_CATEGORIES.filter((category) => !existingSlugs.has(category.slug)).map((category) => ({
    organizationId,
    guildId,
    ...category,
  }));

  if (categoriesToCreate.length > 0) {
    await MemberCategoryModel.insertMany(categoriesToCreate, { ordered: false });
  }

  const categories = await MemberCategoryModel.find({ organizationId, guildId })
    .sort({ name: 1 })
    .lean();

  ctx.body = { categories };
});
