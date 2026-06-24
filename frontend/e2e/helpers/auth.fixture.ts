import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Credenciais geradas para autenticação E2E.
 */
export interface E2EAuthCredentials {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
}

/**
 * Resultado do bootstrap de autenticação para o teste.
 */
export interface E2EAuthSetupResult {
  credentials: E2EAuthCredentials;
  registered: boolean;
  responseStatus?: number;
}

/**
 * Registra um usuário único via API de auth para uso em cenários E2E.
 *
 * Quando o backend não está acessível, a função retorna as credenciais com
 * `registered=false`, permitindo que o spec faça mock da autenticação.
 *
 * @param request Contexto de requisição HTTP do Playwright
 * @returns Resultado com credenciais e indicador de sucesso do cadastro
 * @example
 * const setup = await registerE2EUser(request);
 * if (!setup.registered) {
 *   // habilitar mock de login no spec
 * }
 */
export async function registerE2EUser(request: APIRequestContext): Promise<E2EAuthSetupResult> {
  const timestamp = Date.now();
  const credentials: E2EAuthCredentials = {
    email: `e2e+quem-sumiu-${timestamp}@syntra.test`,
    password: 'E2E!Senha#123',
    displayName: 'E2E Runner',
    organizationName: `Syntra E2E ${timestamp}`,
  };

  let response: APIResponse;
  try {
    response = await request.post('/api/v1/auth/register', {
      data: credentials,
    });
  } catch {
    return {
      credentials,
      registered: false,
    };
  }

  if (!response.ok()) {
    return {
      credentials,
      registered: false,
      responseStatus: response.status(),
    };
  }

  return {
    credentials,
    registered: true,
    responseStatus: response.status(),
  };
}
