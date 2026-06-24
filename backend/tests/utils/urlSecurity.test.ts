import { describe, expect, it } from 'vitest';
import { assertAllowedRedirectUrl, assertPublicHttpsUrl } from '../../src/utils/urlSecurity';

describe('urlSecurity', () => {
  it('aceita URL HTTPS pública para webhooks', () => {
    expect(assertPublicHttpsUrl('https://hooks.example.com/syntra')).toContain('https://hooks.example.com');
  });

  it('bloqueia localhost em webhooks outbound', () => {
    expect(() => assertPublicHttpsUrl('https://localhost/webhook')).toThrow(/internos/);
    expect(() => assertPublicHttpsUrl('https://127.0.0.1/webhook')).toThrow(/internos/);
    expect(() => assertPublicHttpsUrl('https://169.254.169.254/latest/meta-data')).toThrow(/internos/);
  });

  it('rejeita redirect fora do domínio configurado', () => {
    expect(() => assertAllowedRedirectUrl('https://evil.example/phish', 'successUrl')).toThrow(/domínio/);
  });
});
