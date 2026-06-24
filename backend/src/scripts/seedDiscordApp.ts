import { access, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { connectMongo, disconnectMongo } from '../db/connection';
import { PlatformUserModel } from '../db/models/PlatformUser';
import { createDiscordApplication } from '../services/discordApplicationService';
import { reloadDiscordFromDatabase } from '../bot/client';

/** Diretório `backend/seed` resolvido a partir deste script. */
const SEED_DIR = path.resolve(__dirname, '../../seed');
const SEED_FILE = path.join(SEED_DIR, 'discord-app.local.json');
const SEED_EXAMPLE_FILE = path.join(SEED_DIR, 'discord-app.local.json.example');

/**
 * Payload esperado no arquivo local de seed do aplicativo Discord.
 */
interface DiscordAppSeedFile {
  name: string;
  clientId: string;
  clientSecret: string;
  botToken: string;
  superAdminDiscordId?: string;
}

const PLACEHOLDER_PREFIX = 'COLE_';

/**
 * Verifica se um valor ainda é placeholder do template de exemplo.
 * @param value Valor lido do JSON
 * @returns `true` quando ainda não foi preenchido
 */
function isPlaceholder(value: string): boolean {
  return value.trim().startsWith(PLACEHOLDER_PREFIX);
}

/**
 * Garante que o arquivo local de seed existe, copiando do exemplo se necessário.
 * @returns Caminho absoluto do arquivo de seed
 */
async function ensureSeedFileExists(): Promise<string> {
  try {
    await access(SEED_FILE);
    return SEED_FILE;
  } catch {
    try {
      await access(SEED_EXAMPLE_FILE);
    } catch {
      throw new Error(
        `Arquivo de exemplo não encontrado: ${SEED_EXAMPLE_FILE}\n` +
          'Verifique se o repositório está completo.',
      );
    }

    await copyFile(SEED_EXAMPLE_FILE, SEED_FILE);
    throw new Error(
      `Arquivo criado em:\n  ${SEED_FILE}\n\n` +
        'Edite clientId, clientSecret, botToken e superAdminDiscordId com valores reais do Discord Developer Portal,\n' +
        'depois execute novamente:\n  npm run seed:discord-app --workspace=backend',
    );
  }
}

/**
 * Carrega JSON local com credenciais do bot para bootstrap de desenvolvimento.
 * @returns Conteúdo parseado do arquivo de seed
 */
async function loadSeedFile(): Promise<DiscordAppSeedFile> {
  const seedPath = await ensureSeedFileExists();
  const raw = await readFile(seedPath, 'utf8');
  const parsed = JSON.parse(raw) as DiscordAppSeedFile;

  const missingFields = (['name', 'clientId', 'clientSecret', 'botToken'] as const).filter(
    (field) => !parsed[field]?.trim() || isPlaceholder(parsed[field]),
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Preencha os campos no arquivo:\n  ${seedPath}\n\n` +
        `Campos pendentes: ${missingFields.join(', ')}`,
    );
  }

  return parsed;
}

/**
 * Executa seed do aplicativo Discord padrão e promove super admin opcional.
 * @returns {Promise<void>} Promise resolvida após persistência
 */
async function seedDiscordApp(): Promise<void> {
  if (!process.env.ENCRYPTION_KEY?.trim()) {
    throw new Error(
      'ENCRYPTION_KEY ausente no .env.\n' +
        'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n' +
        'e adicione em backend/.env antes de rodar o seed.',
    );
  }

  const seed = await loadSeedFile();

  await connectMongo();

  const bootstrapUser = await PlatformUserModel.findOneAndUpdate(
    { discordId: 'syntra-bootstrap' },
    {
      discordId: 'syntra-bootstrap',
      displayName: 'Bootstrap Syntra',
      isSuperAdmin: true,
      memberships: [],
    },
    { upsert: true, new: true },
  ).exec();

  if (seed.superAdminDiscordId?.trim() && !isPlaceholder(seed.superAdminDiscordId)) {
    await PlatformUserModel.findOneAndUpdate(
      { discordId: seed.superAdminDiscordId.trim() },
      {
        discordId: seed.superAdminDiscordId.trim(),
        displayName: 'Super Admin',
        isSuperAdmin: true,
        memberships: [],
      },
      { upsert: true, new: true },
    ).exec();
  }

  const application = await createDiscordApplication(
    {
      name: seed.name,
      clientId: seed.clientId,
      clientSecret: seed.clientSecret,
      botToken: seed.botToken,
      isPlatformDefault: true,
    },
    String(bootstrapUser._id),
  );

  try {
    await reloadDiscordFromDatabase();
    console.log('Bot Discord reconectado com o token do banco.');
  } catch (error) {
    console.warn('Seed salvo, mas o bot não conectou agora:', (error as Error).message);
    console.warn('Reinicie o backend após validar as credenciais.');
  }

  console.log(`Discord application seed concluído: ${application.name} (${application.clientId})`);
  await disconnectMongo();
}

seedDiscordApp().catch(async (error) => {
  console.error('\nFalha no seed do Discord application:\n');
  console.error((error as Error).message);
  await disconnectMongo().catch(() => {});
  process.exit(1);
});
