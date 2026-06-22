import Router from '@koa/router';
import { AUTH_COOKIE_NAME, isValidApiKey } from '../middleware/auth';
import { config } from '../../config/env';

/** Rotas de autenticação do dashboard. */
export const loginRouter = new Router();

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Discord Tracker</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #1a1b26; color: #c0caf5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #24283b; padding: 2rem; border-radius: 8px; width: 100%; max-width: 360px; border: 1px solid #292e42; }
    h1 { font-size: 1.25rem; margin: 0 0 1.5rem; color: #7aa2f7; }
    label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #565f89; }
    input { width: 100%; padding: 0.625rem; border-radius: 4px; border: 1px solid #292e42; background: #1a1b26; color: #c0caf5; box-sizing: border-box; }
    button { width: 100%; margin-top: 1rem; padding: 0.625rem; background: #7aa2f7; color: #1a1b26; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; }
    button:hover { background: #89b4fa; }
    .error { color: #f7768e; font-size: 0.875rem; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Discord Tracker</h1>
    <form method="POST" action="/login">
      <label for="apiKey">API Key</label>
      <input type="password" id="apiKey" name="apiKey" required autocomplete="current-password" placeholder="Informe sua API key">
      <button type="submit">Entrar</button>
      {{ERROR}}
    </form>
  </div>
</body>
</html>`;

/**
 * GET /login - Exibe formulário de login do dashboard.
 */
loginRouter.get('/login', (ctx) => {
  ctx.type = 'html';
  ctx.body = LOGIN_HTML.replace('{{ERROR}}', '');
});

/**
 * POST /login - Valida API key e define cookie de sessão.
 */
loginRouter.post('/login', async (ctx) => {
  const body = ctx.request.body as { apiKey?: string } | undefined;
  const apiKey = body?.apiKey?.trim();

  if (!isValidApiKey(apiKey)) {
    ctx.status = 401;
    ctx.type = 'html';
    ctx.body = LOGIN_HTML.replace('{{ERROR}}', '<p class="error">API key inválida</p>');
    return;
  }

  const maxAge = 7 * 24 * 60 * 60;
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';

  ctx.set(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(apiKey!)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`,
  );

  ctx.redirect('/');
});

/**
 * POST /logout - Remove cookie de autenticação.
 */
loginRouter.post('/logout', (ctx) => {
  ctx.set('Set-Cookie', `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
  ctx.redirect('/login');
});
