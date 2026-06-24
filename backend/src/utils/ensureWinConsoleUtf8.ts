import { spawnSync } from 'node:child_process';

let applied = false;

/**
 * Define code page UTF-8 (65001) no console Windows da sessão atual.
 * Deve rodar antes de qualquer escrita no stdout. O `chcp` via subprocesso
 * com stdio herdado altera o console compartilhado com o processo Node.
 * @returns void
 */
export function ensureWinConsoleUtf8(): void {
  if (applied || process.platform !== 'win32') {
    return;
  }

  applied = true;

  spawnSync('cmd.exe', ['/d', '/s', '/c', 'chcp 65001 >nul 2>&1'], {
    stdio: 'inherit',
    windowsHide: true,
  });
}

ensureWinConsoleUtf8();
