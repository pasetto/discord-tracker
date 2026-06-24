import { Types } from 'mongoose';
import { OrganizationModel } from '../db/models/Organization';
import { PlanModel } from '../db/models/Plan';
import { PlatformUserModel } from '../db/models/PlatformUser';

/** Resumo de usuário para listagem admin. */
export interface AdminPlatformUserDto {
  id: string;
  email: string;
  displayName: string;
  discordId?: string;
  isSuperAdmin: boolean;
  membershipsCount: number;
  createdAt: string;
}

/** Resumo de organização para listagem admin. */
export interface AdminOrganizationDto {
  id: string;
  name: string;
  slug: string;
  planName: string;
  planSlug: string;
  subscriptionStatus: string;
  createdAt: string;
}

/** Campos editáveis de usuário pelo super admin. */
export interface UpdateAdminPlatformUserInput {
  isSuperAdmin?: boolean;
  displayName?: string;
}

/**
 * Lista usuários da plataforma com paginação simples.
 * @param limit Máximo de registros (default 50)
 * @param skip Offset para paginação
 * @returns Usuários e total
 */
export async function listAdminPlatformUsers(
  limit = 50,
  skip = 0,
): Promise<{ users: AdminPlatformUserDto[]; total: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const [users, total] = await Promise.all([
    PlatformUserModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean()
      .exec(),
    PlatformUserModel.countDocuments({}).exec(),
  ]);

  return {
    total,
    users: users.map((user) => ({
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      discordId: user.discordId,
      isSuperAdmin: user.isSuperAdmin,
      membershipsCount: user.memberships?.length ?? 0,
      createdAt: user.createdAt.toISOString(),
    })),
  };
}

/**
 * Atualiza flags de um usuário da plataforma.
 * @param userId ID do usuário
 * @param input Campos permitidos
 * @returns Usuário atualizado ou null
 */
export async function updateAdminPlatformUser(
  userId: string,
  input: UpdateAdminPlatformUserInput,
): Promise<AdminPlatformUserDto | null> {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  const update: Record<string, unknown> = {};
  if (typeof input.isSuperAdmin === 'boolean') {
    update.isSuperAdmin = input.isSuperAdmin;
  }
  if (input.displayName?.trim()) {
    update.displayName = input.displayName.trim();
  }

  if (Object.keys(update).length === 0) {
    throw new Error('Nenhum campo válido para atualizar');
  }

  const user = await PlatformUserModel.findByIdAndUpdate(userId, { $set: update }, { new: true }).exec();
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    discordId: user.discordId,
    isSuperAdmin: user.isSuperAdmin,
    membershipsCount: user.memberships.length,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Lista organizações (tenants) da plataforma.
 * @param limit Máximo de registros
 * @param skip Offset
 * @returns Organizações e total
 */
export async function listAdminOrganizations(
  limit = 50,
  skip = 0,
): Promise<{ organizations: AdminOrganizationDto[]; total: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const [organizations, total] = await Promise.all([
    OrganizationModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean()
      .exec(),
    OrganizationModel.countDocuments({}).exec(),
  ]);

  const planIds = organizations.map((org) => org.subscription?.planId).filter(Boolean);
  const plans = await PlanModel.find({ _id: { $in: planIds } })
    .select({ name: 1, slug: 1 })
    .lean()
    .exec();
  const planById = new Map(plans.map((plan) => [String(plan._id), plan]));

  return {
    total,
    organizations: organizations.map((org) => {
      const plan = org.subscription?.planId ? planById.get(String(org.subscription.planId)) : undefined;
      return {
        id: String(org._id),
        name: org.name,
        slug: org.slug,
        planName: plan?.name ?? '—',
        planSlug: plan?.slug ?? '—',
        subscriptionStatus: org.subscription?.status ?? 'unknown',
        createdAt: org.createdAt.toISOString(),
      };
    }),
  };
}
