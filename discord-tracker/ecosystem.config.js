module.exports = {
  apps: [
    {
      name: 'discord-tracker',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
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
      listen_timeout: 10000,
      kill_timeout: 5000,
      // Health check via PM2 plus module ou script externo
      wait_ready: false,
    },
  ],
};
