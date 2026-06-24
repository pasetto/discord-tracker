import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  slugifyOrganizationName,
  verifyPassword,
} from '../../src/services/platformAuthService';

describe('platformAuthService helpers', () => {
  it('normaliza slug de organização', () => {
    expect(slugifyOrganizationName('Minha Empresa!')).toBe('minha-empresa');
    expect(slugifyOrganizationName('   ')).toBe('organizacao');
  });

  it('gera hash e valida senha corretamente', async () => {
    const hash = await hashPassword('senha-segura-123');
    expect(hash).not.toBe('senha-segura-123');
    expect(await verifyPassword('senha-segura-123', hash)).toBe(true);
    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });
});
