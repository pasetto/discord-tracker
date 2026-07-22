/**
 * Domínios públicos de produção/piloto que E2E nunca deve atingir.
 * Impede cadastro/smoke acidental via `E2E_BASE_URL` (SYN-96 / SYN-92).
 */
const FORBIDDEN_E2E_HOST_SUFFIXES = ['disc.econdos.com.br'] as const;

/**
 * Indica se a URL aponta para um host de produção/piloto bloqueado para E2E.
 *
 * @param baseURL URL absoluta candidata a `use.baseURL` / `E2E_BASE_URL`
 * @returns `true` quando o hostname é (ou é subdomínio de) um host proibido
 */
export function isForbiddenE2EBaseURL(baseURL: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(baseURL).hostname.toLowerCase();
  } catch {
    return false;
  }

  return FORBIDDEN_E2E_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

/**
 * Fail-fast: recusa `E2E_BASE_URL` apontando para o piloto público / produção.
 *
 * @param baseURL URL a validar
 * @returns a mesma URL quando segura
 * @throws Error quando o host é `disc.econdos.com.br` (ou subdomínio)
 * @example
 * assertSafeE2EBaseURL('http://127.0.0.1:4200');
 * // throws: assertSafeE2EBaseURL('https://disc.econdos.com.br');
 */
export function assertSafeE2EBaseURL(baseURL: string): string {
  if (isForbiddenE2EBaseURL(baseURL)) {
    throw new Error(
      `E2E_BASE_URL aponta para o domínio piloto/produção (${baseURL}). ` +
        'Recusado por hardening (SYN-96): use http://127.0.0.1:4200 ou outro host local — ' +
        'nunca disc.econdos.com.br.',
    );
  }
  return baseURL;
}
