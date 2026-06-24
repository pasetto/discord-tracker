import { config } from '../config/env';

/**
 * Verifica se um endereço IPv4 está em faixa privada, loopback ou link-local.
 * @param hostname Hostname ou IP textual
 * @returns true quando o host não deve ser acessado por webhooks outbound
 */
function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
    return true;
  }

  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }

  return false;
}

/**
 * Valida URL HTTPS pública para endpoints webhook outbound (bloqueia SSRF básico).
 * @param url URL textual enviada pelo cliente
 * @returns URL normalizada pronta para persistência
 * @throws {Error} Quando URL inválida, sem HTTPS ou apontando para rede interna
 */
export function assertPublicHttpsUrl(url: string | undefined): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error('url é obrigatória');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('url inválida');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('url deve usar HTTPS');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('url não pode apontar para endereços internos ou localhost');
  }

  return parsed.toString();
}

/**
 * Valida URL de redirecionamento do Stripe Checkout contra o domínio do frontend.
 * @param url URL informada pelo cliente
 * @param field Nome do campo para mensagem de erro
 * @returns URL normalizada permitida
 * @throws {Error} Quando URL estiver fora do domínio configurado
 */
export function assertAllowedRedirectUrl(url: string | undefined, field: string): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error(`${field} é obrigatório`);
  }

  let parsed: URL;
  let allowedBase: URL;
  try {
    parsed = new URL(trimmed);
    allowedBase = new URL(config.frontendUrl);
  } catch {
    throw new Error(`${field} inválido`);
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && config.nodeEnv === 'development')) {
    throw new Error(`${field} deve usar HTTPS em produção`);
  }

  if (parsed.origin !== allowedBase.origin) {
    throw new Error(`${field} deve pertencer ao domínio ${allowedBase.origin}`);
  }

  return parsed.toString();
}
