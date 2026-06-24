import { describe, expect, it } from 'vitest';
import {
  generateOrganizationInviteCode,
  normalizeInviteCode,
} from '../../src/services/organizationTeamService';

describe('organizationTeamService helpers', () => {
  it('gera código de convite com 8 caracteres válidos', () => {
    const code = generateOrganizationInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z2-9]+$/);
    expect(code).not.toMatch(/[01OI]/);
  });

  it('normaliza código removendo espaços e hífens', () => {
    expect(normalizeInviteCode(' ab12-cd34 ')).toBe('AB12CD34');
  });
});
