import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { runSilentDiscordReadyHandlers } from '../../src/bot/client';

const botSrcDir = join(dirname(fileURLToPath(import.meta.url)), '../../src/bot');

/**
 * Lista arquivos TypeScript sob `backend/src/bot` de forma recursiva.
 * @param dir Diretório raiz a varrer
 * @returns Caminhos absolutos dos arquivos `.ts`
 */
function listBotSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listBotSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('política de bot Discord silencioso', () => {
  it('não chama setActivity no lifecycle ready', async () => {
    const setActivity = vi.fn();
    const postReady = vi.fn(async () => undefined);

    await runSilentDiscordReadyHandlers({ setActivity }, [postReady]);

    expect(setActivity).not.toHaveBeenCalled();
    expect(postReady).toHaveBeenCalledTimes(1);
  });

  it('client.ts não chama setActivity nem usa ActivityType', () => {
    const clientSource = readFileSync(join(botSrcDir, 'client.ts'), 'utf8');

    expect(clientSource).not.toMatch(/\bActivityType\b/);
    expect(clientSource).not.toMatch(/\.setActivity\s*\(/);
  });

  it('código do bot não envia mensagens, replies nem interactions', () => {
    const socialWritePattern =
      /\.(?:reply|send|followUp|editReply|deferReply|showModal|respond|setPresence|setActivity)\s*\(|applications\.commands/;

    for (const filePath of listBotSourceFiles(botSrcDir)) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, filePath).not.toMatch(socialWritePattern);
    }
  });
});
