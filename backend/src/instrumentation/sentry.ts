import dotenv from 'dotenv';
import path from 'node:path';
import type Koa from 'koa';
import type { Context, Next } from 'koa';
import * as Sentry from '@sentry/node';

// Carrega .env antes do init — este módulo deve ser importado antes de qualquer outro.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const sentryDsn = process.env.SENTRY_DSN?.trim();
const nodeEnv = process.env.NODE_ENV ?? 'development';

/**
 * Indica se o Sentry foi inicializado com DSN válido.
 * @returns true quando eventos e traces serão enviados ao Sentry
 */
export function isSentryEnabled(): boolean {
  return Boolean(sentryDsn);
}

if (isSentryEnabled()) {
  Sentry.init({
    dsn: sentryDsn,
    environment: nodeEnv,
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.mongoIntegration()],
    beforeSend(event) {
      const statusCode = event.contexts?.response?.status_code;
      if (typeof statusCode === 'number' && statusCode < 500) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Registra handler de erros do Koa no app.
 * Deve ser chamado logo após `new Koa()`, antes das rotas.
 * @param app Instância Koa da API
 */
export function setupSentryKoaErrorHandler(app: Koa): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setupKoaErrorHandler(app);
}

/**
 * Middleware que cria um span de performance para cada requisição HTTP.
 * Com `tracesSampleRate: 1.0`, todas as requests são rastreadas no Sentry.
 * @param ctx Contexto Koa da requisição
 * @param next Próximo middleware
 */
export async function sentryRequestMiddleware(ctx: Context, next: Next): Promise<void> {
  if (!isSentryEnabled()) {
    await next();
    return;
  }

  const routeTemplate = ctx._matchedRoute ? String(ctx._matchedRoute) : ctx.path;

  await Sentry.withIsolationScope(async (scope) => {
    scope.setTag('http.method', ctx.method);
    scope.setTag('http.route', routeTemplate);

    await Sentry.startSpan(
      {
        name: `${ctx.method} ${routeTemplate}`,
        op: 'http.server',
        attributes: {
          'http.method': ctx.method,
          'http.url': ctx.url,
          'http.route': routeTemplate,
        },
      },
      async (span) => {
        try {
          await next();
          span?.setAttribute('http.status_code', ctx.status);
          scope.setTag('http.status_code', String(ctx.status));
        } catch (error) {
          captureApiException(error, ctx);
          throw error;
        }
      },
    );
  });
}

/**
 * Envia exceção da API ao Sentry com contexto da requisição.
 * @param error Erro capturado no middleware ou handler
 * @param ctx Contexto Koa opcional para enriquecer o evento
 */
export function captureApiException(error: unknown, ctx?: Context): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    if (ctx) {
      scope.setTag('http.method', ctx.method);
      scope.setTag('http.route', ctx._matchedRoute ? String(ctx._matchedRoute) : ctx.path);
      scope.setTag('http.status_code', String(ctx.status || 500));
      scope.setContext('request', {
        method: ctx.method,
        url: ctx.url,
        path: ctx.path,
        status: ctx.status,
      });

      const organizationId = (ctx.state as { organizationId?: string }).organizationId;
      const user = (ctx.state as { user?: { id?: string; email?: string } }).user;
      if (organizationId) {
        scope.setTag('organizationId', organizationId);
      }
      if (user?.id) {
        scope.setUser({ id: user.id, email: user.email });
      }
    }

    Sentry.captureException(error);
  });
}

/**
 * Envia eventos pendentes ao Sentry antes do shutdown do processo.
 * @param timeoutMs Tempo máximo de espera em milissegundos
 * @returns Promise resolvida após flush ou timeout
 */
export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (!isSentryEnabled()) {
    return;
  }

  await Sentry.flush(timeoutMs);
}

export { Sentry };
