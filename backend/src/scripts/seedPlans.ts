import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db/connection';
import { PlanModel } from '../db/models/Plan';
import { createLogger } from '../logger';

const log = createLogger('seed-plans');

/**
 * Lista dos planos seed iniciais para o MVP no Brasil.
 */
const seedPlans = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Plano de entrada para equipes pequenas com foco em quem sumiu.',
    priceCents: 7900,
    currency: 'BRL' as const,
    billingInterval: 'month' as const,
    limits: {
      maxGuilds: 1,
      maxTrackedMembers: 25,
      dataRetentionDays: 90,
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
    trialDays: 7,
  },
  {
    name: 'Team',
    slug: 'team',
    description: 'Plano para times em crescimento com mais colaboração e visibilidade.',
    priceCents: 14900,
    currency: 'BRL' as const,
    billingInterval: 'month' as const,
    limits: {
      maxGuilds: 1,
      maxTrackedMembers: 75,
      dataRetentionDays: 180,
    },
    features: {
      gamification: true,
      ranking: true,
      exportCsv: true,
      exportPdf: false,
      apiAccess: false,
      webhooks: false,
      customChannelRules: true,
      teamGoals: true,
      advancedReports: true,
    },
    isActive: true,
    isPublic: true,
    sortOrder: 2,
    trialDays: 7,
  },
  {
    name: 'Business',
    slug: 'business',
    description: 'Para operações maiores com exportação, API e webhooks de integração.',
    priceCents: 29900,
    currency: 'BRL' as const,
    billingInterval: 'month' as const,
    limits: {
      maxGuilds: 3,
      maxTrackedMembers: 200,
      dataRetentionDays: 365,
    },
    features: {
      gamification: true,
      ranking: true,
      exportCsv: true,
      exportPdf: false,
      apiAccess: true,
      webhooks: true,
      customChannelRules: true,
      teamGoals: true,
      advancedReports: true,
    },
    isActive: true,
    isPublic: true,
    sortOrder: 3,
    trialDays: 7,
  },
];

/**
 * Faz upsert dos planos seed no catálogo.
 * @returns {Promise<void>} Promise resolvida após sincronizar os planos
 */
export async function seedPlansCatalog(): Promise<void> {
  for (const plan of seedPlans) {
    await PlanModel.findOneAndUpdate(
      { slug: plan.slug },
      {
        $set: plan,
      },
      {
        upsert: true,
        new: true,
      },
    ).exec();
  }
}

/**
 * Executa o seed de planos como script CLI.
 * @returns {Promise<void>} Promise resolvida ao final da execução
 */
async function run(): Promise<void> {
  try {
    await connectMongo();
    await seedPlansCatalog();
    log.info({ plans: seedPlans.map((plan) => plan.slug) }, 'Seed de planos concluído');
  } catch (error) {
    log.error({ err: error }, 'Falha ao executar seed de planos');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectMongo();
    }
  }
}

void run();
