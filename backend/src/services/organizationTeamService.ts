import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { OrganizationModel } from '../db/models/Organization';
import { PlatformUserModel, type IPlatformUser } from '../db/models/PlatformUser';

/** Alfabeto sem caracteres ambíguos para códigos de convite. */
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Papel padrão de novos membros aprovados (acesso total no MVP). */
const DEFAULT_MEMBER_ROLE = 'admin' as const;

/**
 * Resumo público de uma organização para validação de código de convite.
 */
export interface OrganizationInvitePreview {
  organizationId: string;
  organizationName: string;
  inviteCode: string;
}

/**
 * Membro ativo ou pendente de uma organização.
 */
export interface OrganizationMemberSummary {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: 'active' | 'pending';
  invitedAt: string;
  acceptedAt?: string;
}

/**
 * Organização vinculada ao usuário autenticado.
 */
export interface UserOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: 'active' | 'pending';
}

/**
 * Gera código de convite de 8 caracteres.
 * @returns Código em maiúsculas
 */
export function generateOrganizationInviteCode(): string {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Cria código único que não colide com outra organização.
 * @returns Código disponível no banco
 */
export async function createUniqueOrganizationInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateOrganizationInviteCode();
    const exists = await OrganizationModel.exists({ inviteCode: candidate }).exec();
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Não foi possível gerar código de convite único');
}

/**
 * Normaliza código informado pelo usuário.
 * @param inviteCode Código digitado ou colado
 * @returns Código sanitizado
 */
export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Garante que a organização possui código de convite persistido.
 * @param organizationId ID da organização
 * @returns Código ativo da organização
 */
export async function ensureOrganizationInviteCode(organizationId: string): Promise<string> {
  const organization = await OrganizationModel.findById(organizationId).exec();
  if (!organization) {
    throw new Error('Organização não encontrada');
  }

  if (organization.inviteCode?.trim()) {
    return organization.inviteCode;
  }

  organization.inviteCode = await createUniqueOrganizationInviteCode();
  await organization.save();
  return organization.inviteCode;
}

/**
 * Regenera o código de convite da organização.
 * @param organizationId ID da organização
 * @returns Novo código
 */
export async function regenerateOrganizationInviteCode(organizationId: string): Promise<string> {
  const organization = await OrganizationModel.findById(organizationId).exec();
  if (!organization) {
    throw new Error('Organização não encontrada');
  }

  organization.inviteCode = await createUniqueOrganizationInviteCode();
  await organization.save();
  return organization.inviteCode;
}

/**
 * Retorna preview público de uma organização a partir do código de convite.
 * @param inviteCode Código informado pelo usuário
 * @returns Dados mínimos para tela de entrada
 */
export async function previewOrganizationInvite(inviteCode: string): Promise<OrganizationInvitePreview> {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (normalizedCode.length !== 8) {
    throw new Error('Informe um código de convite válido com 8 caracteres');
  }

  const organization = await OrganizationModel.findOne({ inviteCode: normalizedCode }).exec();
  if (!organization) {
    throw new Error('Código de convite inválido ou expirado');
  }

  return {
    organizationId: String(organization._id),
    organizationName: organization.name,
    inviteCode: organization.inviteCode,
  };
}

/**
 * Lista organizações vinculadas ao usuário autenticado.
 * @param userId ID do usuário da plataforma
 * @returns Organizações ativas e pendentes
 */
export async function listUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
  const user = await PlatformUserModel.findById(userId).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const organizationIds = user.memberships.map((membership) => membership.organizationId);
  const organizations = await OrganizationModel.find({ _id: { $in: organizationIds } })
    .select('name slug')
    .lean<Array<{ _id: Types.ObjectId; name: string; slug: string }>>()
    .exec();

  const organizationById = new Map(organizations.map((organization) => [String(organization._id), organization]));

  return user.memberships.flatMap((membership) => {
    const organization = organizationById.get(String(membership.organizationId));
    if (!organization) {
      return [];
    }

    return [
      {
        id: String(organization._id),
        name: organization.name,
        slug: organization.slug,
        role: membership.role,
        status: membership.acceptedAt ? 'active' : 'pending',
      } satisfies UserOrganizationSummary,
    ];
  });
}

/**
 * Solicita entrada em organização via código de convite.
 * @param userId ID do usuário autenticado
 * @param inviteCode Código de 8 caracteres
 * @returns Usuário atualizado com membership pendente
 */
export async function requestOrganizationJoin(userId: string, inviteCode: string): Promise<IPlatformUser> {
  const preview = await previewOrganizationInvite(inviteCode);
  const user = await PlatformUserModel.findById(userId).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const existingMembership = user.memberships.find(
    (membership) => String(membership.organizationId) === preview.organizationId,
  );
  if (existingMembership) {
    if (existingMembership.acceptedAt) {
      throw new Error('Você já faz parte desta organização');
    }
    throw new Error('Solicitação de acesso já enviada e aguardando aprovação');
  }

  user.memberships.push({
    organizationId: new Types.ObjectId(preview.organizationId),
    role: DEFAULT_MEMBER_ROLE,
    invitedAt: new Date(),
  });
  await user.save();
  return user;
}

/**
 * Lista membros e solicitações pendentes da organização.
 * @param organizationId ID da organização
 * @returns Membros ativos e pendentes
 */
export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMemberSummary[]> {
  const users = await PlatformUserModel.find({ 'memberships.organizationId': organizationId })
    .select('email displayName memberships')
    .lean<Array<{ _id: Types.ObjectId; email: string; displayName: string; memberships: IPlatformUser['memberships'] }>>()
    .exec();

  const members: OrganizationMemberSummary[] = [];

  for (const user of users) {
    const membership = user.memberships.find((item) => String(item.organizationId) === organizationId);
    if (!membership) {
      continue;
    }

    members.push({
      userId: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role: membership.role,
      status: membership.acceptedAt ? 'active' : 'pending',
      invitedAt: membership.invitedAt.toISOString(),
      acceptedAt: membership.acceptedAt?.toISOString(),
    });
  }

  return members.sort((left, right) => left.displayName.localeCompare(right.displayName, 'pt-BR'));
}

/**
 * Aprova solicitação pendente de um usuário na organização.
 * @param organizationId ID da organização
 * @param targetUserId ID do usuário aprovado
 * @returns Usuário atualizado
 */
export async function approveOrganizationMember(
  organizationId: string,
  targetUserId: string,
): Promise<IPlatformUser> {
  const user = await PlatformUserModel.findById(targetUserId).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const membership = user.memberships.find((item) => String(item.organizationId) === organizationId);
  if (!membership) {
    throw new Error('Usuário não possui solicitação para esta organização');
  }
  if (membership.acceptedAt) {
    throw new Error('Usuário já está ativo nesta organização');
  }

  membership.acceptedAt = new Date();
  await user.save();
  return user;
}

/**
 * Rejeita ou remove membership pendente/ativo de um usuário.
 * @param organizationId ID da organização
 * @param targetUserId ID do usuário removido
 * @returns Usuário atualizado
 */
export async function removeOrganizationMember(
  organizationId: string,
  targetUserId: string,
): Promise<IPlatformUser> {
  const user = await PlatformUserModel.findById(targetUserId).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const nextMemberships = user.memberships.filter((item) => String(item.organizationId) !== organizationId);
  if (nextMemberships.length === user.memberships.length) {
    throw new Error('Usuário não pertence a esta organização');
  }

  user.memberships = nextMemberships;
  await user.save();
  return user;
}

/**
 * Valida se o usuário possui membership ativa na organização.
 * @param user Usuário autenticado
 * @param organizationId ID da organização
 * @returns `true` quando membership está aprovada
 */
export function hasActiveOrganizationMembership(user: IPlatformUser, organizationId: string): boolean {
  return user.memberships.some(
    (membership) => String(membership.organizationId) === organizationId && Boolean(membership.acceptedAt),
  );
}
