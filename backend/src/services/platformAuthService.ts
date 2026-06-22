import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { OrganizationModel } from '../db/models/Organization';
import { PlanModel } from '../db/models/Plan';
import { PlatformUserModel, type IPlatformUser } from '../db/models/PlatformUser';
import {
  type AuthMembership,
  type AuthUserPayload,
  signAccessToken,
  signRefreshToken,
} from './authService';

/** Custo do bcrypt para hash de senha. */
const PASSWORD_SALT_ROUNDS = 12;

/** Comprimento mínimo aceito para senhas de usuários da plataforma. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Dados de entrada para cadastro de conta na plataforma.
 */
export interface RegisterPlatformUserInput {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
}

/**
 * Dados de entrada para login com email e senha.
 */
export interface LoginPlatformUserInput {
  email: string;
  password: string;
}

/**
 * Resposta de autenticação com tokens e contexto do tenant.
 */
export interface PlatformAuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    memberships: AuthMembership[];
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Normaliza texto para slug de organização.
 * @param value Nome informado pelo usuário
 * @returns Slug URL-safe
 */
export function slugifyOrganizationName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'organizacao';
}

/**
 * Gera hash bcrypt para senha em texto puro.
 * @param password Senha informada pelo usuário
 * @returns Hash persistível no banco
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

/**
 * Compara senha informada com hash armazenado.
 * @param password Senha em texto puro
 * @param passwordHash Hash salvo no banco
 * @returns `true` quando a senha confere
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Monta payload JWT a partir do usuário da plataforma.
 * @param user Documento autenticado
 * @returns Payload usado pelos tokens da aplicação
 */
export function buildAuthPayloadFromPlatformUser(user: IPlatformUser): AuthUserPayload {
  return {
    id: String(user._id),
    email: user.email,
    username: user.displayName,
    discordId: user.discordId,
    memberships: user.memberships.map((membership) => ({
      organizationId: String(membership.organizationId),
      role: membership.role,
    })),
  };
}

/**
 * Garante existência de um plano starter para novos cadastros.
 * @returns Plano starter ativo
 */
async function findOrCreateStarterPlan() {
  const existing = await PlanModel.findOne({ slug: 'starter', isActive: true }).exec();
  if (existing) {
    return existing;
  }

  return PlanModel.create({
    name: 'Starter',
    slug: 'starter',
    description: 'Plano inicial Syntra',
    priceCents: 7900,
    currency: 'BRL',
    billingInterval: 'month',
    limits: {
      maxGuilds: 1,
      maxTrackedMembers: 25,
      dataRetentionDays: 30,
    },
    features: {
      gamification: false,
      ranking: true,
      exportCsv: false,
      exportPdf: false,
      apiAccess: false,
      webhooks: false,
      customChannelRules: true,
      teamGoals: false,
      advancedReports: false,
    },
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    trialDays: 14,
  });
}

/**
 * Cria slug único para organização evitando colisão no banco.
 * @param organizationName Nome informado no cadastro
 * @returns Slug único
 */
async function createUniqueOrganizationSlug(organizationName: string): Promise<string> {
  const baseSlug = slugifyOrganizationName(organizationName);
  let candidate = baseSlug;
  let suffix = 1;

  while (await OrganizationModel.exists({ slug: candidate })) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

/**
 * Valida campos obrigatórios do cadastro.
 * @param input Dados de registro
 */
function assertRegisterInput(input: RegisterPlatformUserInput): void {
  if (!input.email?.trim() || !input.email.includes('@')) {
    throw new Error('Informe um email válido');
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (!input.displayName?.trim()) {
    throw new Error('Informe o nome de exibição');
  }
  if (!input.organizationName?.trim()) {
    throw new Error('Informe o nome da organização');
  }
}

/**
 * Registra usuário, organização e membership owner.
 * @param input Dados de cadastro
 * @returns Tokens e contexto autenticado
 */
export async function registerPlatformUser(input: RegisterPlatformUserInput): Promise<PlatformAuthResult> {
  assertRegisterInput(input);

  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await PlatformUserModel.findOne({ email: normalizedEmail }).exec();
  if (existing) {
    throw new Error('Email já cadastrado');
  }

  const plan = await findOrCreateStarterPlan();
  const slug = await createUniqueOrganizationSlug(input.organizationName);
  const organization = await OrganizationModel.create({
    name: input.organizationName.trim(),
    slug,
    subscription: {
      planId: plan._id,
      stripeCustomerId: `dev_${new Types.ObjectId().toHexString()}`,
      stripeSubscriptionId: `dev_sub_${new Types.ObjectId().toHexString()}`,
      status: 'trialing',
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    settings: {
      timezone: 'America/Sao_Paulo',
      memberConsentBannerEnabled: true,
    },
  });

  const passwordHash = await hashPassword(input.password);
  const user = await PlatformUserModel.create({
    email: normalizedEmail,
    passwordHash,
    displayName: input.displayName.trim(),
    isSuperAdmin: false,
    memberships: [
      {
        organizationId: organization._id,
        role: 'owner',
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    ],
  });

  const authPayload = buildAuthPayloadFromPlatformUser(user);
  return {
    accessToken: signAccessToken(authPayload),
    refreshToken: signRefreshToken(authPayload),
    user: {
      id: authPayload.id,
      email: authPayload.email,
      displayName: user.displayName,
      memberships: authPayload.memberships,
    },
    organization: {
      id: String(organization._id),
      name: organization.name,
      slug: organization.slug,
    },
  };
}

/**
 * Autentica usuário com email e senha.
 * @param input Credenciais informadas
 * @returns Tokens e contexto autenticado
 */
export async function loginPlatformUser(input: LoginPlatformUserInput): Promise<PlatformAuthResult> {
  const normalizedEmail = input.email?.trim().toLowerCase();
  if (!normalizedEmail || !input.password) {
    throw new Error('Informe email e senha');
  }

  const user = await PlatformUserModel.findOne({ email: normalizedEmail }).select('+passwordHash').exec();
  if (!user) {
    throw new Error('Credenciais inválidas');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new Error('Credenciais inválidas');
  }

  const primaryMembership = user.memberships[0];
  if (!primaryMembership) {
    throw new Error('Usuário sem organização vinculada');
  }

  const organization = await OrganizationModel.findById(primaryMembership.organizationId).exec();
  if (!organization) {
    throw new Error('Organização vinculada não encontrada');
  }

  const authPayload = buildAuthPayloadFromPlatformUser(user);
  return {
    accessToken: signAccessToken(authPayload),
    refreshToken: signRefreshToken(authPayload),
    user: {
      id: authPayload.id,
      email: authPayload.email,
      displayName: user.displayName,
      memberships: authPayload.memberships,
    },
    organization: {
      id: String(organization._id),
      name: organization.name,
      slug: organization.slug,
    },
  };
}
