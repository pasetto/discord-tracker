import {
  assertSafeE2EBaseURL,
  isForbiddenE2EBaseURL,
} from './assert-safe-e2e-base-url';

describe('assertSafeE2EBaseURL', () => {
  it('aceita localhost e 127.0.0.1', () => {
    expect(assertSafeE2EBaseURL('http://127.0.0.1:4200')).toBe('http://127.0.0.1:4200');
    expect(assertSafeE2EBaseURL('http://localhost:4200')).toBe('http://localhost:4200');
  });

  it('recusa o domínio piloto público disc.econdos.com.br', () => {
    expect(isForbiddenE2EBaseURL('https://disc.econdos.com.br')).toBeTrue();
    expect(isForbiddenE2EBaseURL('https://disc.econdos.com.br/app')).toBeTrue();
    expect(isForbiddenE2EBaseURL('https://DISC.ECONDOS.COM.BR')).toBeTrue();
    expect(isForbiddenE2EBaseURL('https://www.disc.econdos.com.br')).toBeTrue();

    expect(() => assertSafeE2EBaseURL('https://disc.econdos.com.br')).toThrowError(
      /E2E_BASE_URL|produção|piloto|disc\.econdos\.com\.br/i,
    );
  });

  it('aceita hosts que não são o piloto público', () => {
    expect(isForbiddenE2EBaseURL('http://192.168.1.10:4200')).toBeFalse();
    expect(isForbiddenE2EBaseURL('https://staging.example.com')).toBeFalse();
  });
});
