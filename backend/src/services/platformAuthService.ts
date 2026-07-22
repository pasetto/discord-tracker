import { Types } from 'mongoose';
import { OrganizationModel } from '../db/models/Organization';
import { PlanModel } from '../db/models/Plan';
import { PlatformUserModel, type IPlatformUser } from '../db/models/PlatformUser';
import {
  createUniqueOrganizationInviteCode,
  listUserOrganizations,
  previewOrganizationInvite,
} from './organizationTeamService';
import {
  type AuthMembership,
  type AuthUserPayload,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './authService';
import { ensureBetterAuthCredentialUser } from './betterAuthBridgeService';
import { getBetterAuth } from '../auth/betterAuth';
import { createLogger } from '../logger';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './passwordHash';

export { hashPassword, verifyPassword } from './passwordHash';

const authBridgeLog = createLogger('platform-auth-bridge');

/**
 * Dados de entrada para cadastro de conta na plataforma.
 */
export interface RegisterPlatformUserInput {
  email: string;
  password: string;
  displayName: string;
  /** Obrigatório quando `inviteCode` não é informado. */
  organizationName?: string;
  /** Quando informado, o usuário entra na organização existente com aprovação pendente. */
  inviteCode?: string;
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
    isSuperAdmin: boolean;
    memberships: AuthMembership[];
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    status: 'active' | 'pending';
  }>;
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
      status: membership.acceptedAt ? 'active' : 'pending',
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
      gamification: true,
      ranking: false,
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

  const inviteCode = input.inviteCode?.trim();
  if (inviteCode) {
    return;
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

  const inviteCode = input.inviteCode?.trim();
  if (inviteCode) {
    return registerPlatformUserViaInvite({
      email: normalizedEmail,
      password: input.password,
      displayName: input.displayName.trim(),
      inviteCode,
    });
  }

  const plan = await findOrCreateStarterPlan();
  const slug = await createUniqueOrganizationSlug(input.organizationName!);
  const organizationInviteCode = await createUniqueOrganizationInviteCode();
  const organization = await OrganizationModel.create({
    name: input.organizationName!.trim(),
    slug,
    inviteCode: organizationInviteCode,
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

  await syncBetterAuthAfterCredentialChange(user, passwordHash);
  return buildPlatformAuthResult(user);
}

/**
 * Registra usuário com membership pendente em organização existente via convite.
 * @param input Dados de cadastro com código de convite
 * @returns Tokens e contexto autenticado sem organização ativa
 */
async function registerPlatformUserViaInvite(input: {
  email: string;
  password: string;
  displayName: string;
  inviteCode: string;
}): Promise<PlatformAuthResult> {
  const preview = await previewOrganizationInvite(input.inviteCode);
  const passwordHash = await hashPassword(input.password);
  const user = await PlatformUserModel.create({
    email: input.email,
    passwordHash,
    displayName: input.displayName,
    isSuperAdmin: false,
    memberships: [
      {
        organizationId: new Types.ObjectId(preview.organizationId),
        role: 'viewer',
        invitedAt: new Date(),
      },
    ],
  });

  await syncBetterAuthAfterCredentialChange(user, passwordHash);
  return buildPlatformAuthResult(user);
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

  if (!user.isSuperAdmin && user.memberships.length === 0) {
    throw new Error('Usuário sem organização vinculada');
  }

  // Sync before Better Auth verify so legacy bcrypt hashes are available to the credential account.
  await syncBetterAuthAfterCredentialChange(user, user.passwordHash);

  let authenticatedViaBetterAuth = false;
  try {
    await getBetterAuth().api.signInEmail({
      body: {
        email: normalizedEmail,
        password: input.password,
      },
    });
    authenticatedViaBetterAuth = true;
  } catch {
    authenticatedViaBetterAuth = false;
  }

  if (!authenticatedViaBetterAuth) {
    // Fallback: usuários só em PlatformUser (hash legado) ainda autenticam via bcrypt local.
    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error('Credenciais inválidas');
    }
    authBridgeLog.warn({ email: normalizedEmail }, 'Login via bcrypt local após falha Better Auth');
  }

  return buildPlatformAuthResult(user);
}

/**
 * Renova access token a partir de um refresh token válido.
 * @param refreshToken JWT de refresh recebido via cookie HttpOnly
 * @returns Nova sessão com access token atualizado
 * @throws {Error} Quando refresh token for inválido, expirado ou usuário inexistente
 */
export async function refreshPlatformUserSession(refreshToken: string): Promise<PlatformAuthResult> {
  const payload = verifyRefreshToken(refreshToken);
  const user = await PlatformUserModel.findById(payload.id).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  if (!user.isSuperAdmin && user.memberships.length === 0) {
    throw new Error('Usuário sem organização vinculada');
  }

  return buildPlatformAuthResult(user);
}

/**
 * Retorna sessão autenticada atual do usuário.
 * @param userId ID do usuário da plataforma
 * @returns Tokens e organizações vinculadas
 */
export async function getPlatformAuthSession(userId: string): Promise<PlatformAuthResult> {
  const user = await PlatformUserModel.findById(userId).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  return buildPlatformAuthResult(user);
}

/**
 * Define organização ativa na resposta de sessão (sem reemitir memberships).
 * @param userId ID do usuário autenticado
 * @param organizationId Organização que deve ficar ativa no cliente
 * @returns Sessão com organização ativa validada
 */
export async function switchPlatformOrganization(
  userId: string,
  organizationId: string,
): Promise<PlatformAuthResult> {
  const user = await PlatformUserModel.findById(userId).exec();
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const membership = user.memberships.find(
    (item) => String(item.organizationId) === organizationId && item.acceptedAt,
  );
  if (!membership) {
    throw new Error('Organização indisponível para este usuário');
  }

  return buildPlatformAuthResult(user, organizationId);
}

/**
 * Sincroniza credencial Better Auth após criar/atualizar PlatformUser.
 * Falhas de sync não bloqueiam o fluxo legado de sessão Syntra.
 * @param user Documento PlatformUser
 * @param passwordHash Hash bcrypt atual
 * @returns {Promise<void>}
 */
async function syncBetterAuthAfterCredentialChange(
  user: IPlatformUser,
  passwordHash: string,
): Promise<void> {
  try {
    await ensureBetterAuthCredentialUser({
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      passwordHash,
    });
  } catch (error) {
    authBridgeLog.warn({ err: error, userId: String(user._id) }, 'Falha ao sincronizar Better Auth');
  }
}

/**
 * Monta resposta de sessão a partir do usuário autenticado.
 * @param user Documento do usuário
 * @param preferredOrganizationId Organização ativa preferida, quando informada
 * @returns Tokens e contexto para o cliente
 */
async function buildPlatformAuthResult(
  user: IPlatformUser,
  preferredOrganizationId?: string,
): Promise<PlatformAuthResult> {
  const authPayload = buildAuthPayloadFromPlatformUser(user);
  const organizations = await listUserOrganizations(String(user._id));
  const activeOrganizations = organizations.filter((organization) => organization.status === 'active');
  const preferredOrganization = preferredOrganizationId
    ? activeOrganizations.find((organization) => organization.id === preferredOrganizationId)
    : undefined;
  const primaryOrganization = preferredOrganization ?? activeOrganizations[0];
  let organization: PlatformAuthResult['organization'] = null;

  if (primaryOrganization) {
    organization = {
      id: primaryOrganization.id,
      name: primaryOrganization.name,
      slug: primaryOrganization.slug,
    };
  }

  return {
    accessToken: signAccessToken(authPayload),
    refreshToken: signRefreshToken(authPayload),
    user: {
      id: authPayload.id,
      email: authPayload.email,
      displayName: user.displayName,
      isSuperAdmin: user.isSuperAdmin,
      memberships: authPayload.memberships,
    },
    organization,
    organizations,
  };
}
