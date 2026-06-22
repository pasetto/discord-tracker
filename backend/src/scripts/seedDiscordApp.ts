import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { connectMongo, disconnectMongo } from '../db/connection';
import { PlatformUserModel } from '../db/models/PlatformUser';
import { createDiscordApplication } from '../services/discordApplicationService';
import { reloadDiscordFromDatabase } from '../bot/client';

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

/**
 * Carrega JSON local com credenciais do bot para bootstrap de desenvolvimento.
 * @returns Conteúdo parseado do arquivo de seed
 */
async function loadSeedFile(): Promise<DiscordAppSeedFile> {
  const seedPath = path.resolve(__dirname, '../../seed/discord-app.local.json');
  const raw = await readFile(seedPath, 'utf8');
  const parsed = JSON.parse(raw) as DiscordAppSeedFile;

  if (!parsed.name || !parsed.clientId || !parsed.clientSecret || !parsed.botToken) {
    throw new Error('Arquivo seed inválido. Copie discord-app.local.json.example e preencha os campos.');
  }

  return parsed;
}

/**
 * Executa seed do aplicativo Discord padrão e promove super admin opcional.
 * @returns {Promise<void>} Promise resolvida após persistência
 */
async function seedDiscordApp(): Promise<void> {
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

  if (seed.superAdminDiscordId?.trim()) {
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

  await reloadDiscordFromDatabase();

  console.log(`Discord application seed concluído: ${application.name} (${application.clientId})`);
  await disconnectMongo();
}

seedDiscordApp().catch(async (error) => {
  console.error('Falha no seed do Discord application:', error);
  await disconnectMongo().catch(() => {});
  process.exit(1);
});
