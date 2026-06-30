import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, '../src/version/build-info.json');

/**
 * Obtém SHA curto do commit Git atual para identificar o build.
 * @returns SHA de 7 caracteres ou `dev` fora de repositório Git
 */
function resolveGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

const buildInfo = {
  version: packageJson.version,
  buildVersion: packageJson.version,
  gitSha: resolveGitSha(),
  builtAt: new Date().toISOString(),
};

writeFileSync(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
console.log(`[build-info] ${buildInfo.buildVersion} (${buildInfo.gitSha}) → ${outputPath}`);
