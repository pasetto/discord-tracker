/**
 * Configuração PM2 para produção em modo cluster.
 *
 * - `wait_ready` + `process.send('ready')` no bootstrap após HTTP escutar
 * - `shutdown_with_message` para reload gracioso sem derrubar conexões abruptamente
 * - Instância `0` executa bot Discord + crons (ver `clusterRole.ts`)
 *
 * Uso:
 *   npm run build && pm2 start ecosystem.config.js
 *   PM2_INSTANCES=4 pm2 reload ecosystem.config.js
 */
const instances = process.env.PM2_INSTANCES ?? 'max';

module.exports = {
  apps: [
    {
      name: 'syntra',
      script: 'dist/index.js',
      cwd: __dirname,
      instances,
      exec_mode: 'cluster',
      instance_var: 'NODE_APP_INSTANCE',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_file: 'logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      wait_ready: true,
      listen_timeout: 30_000,
      kill_timeout: 10_000,
      shutdown_with_message: true,
    },
  ],
};
