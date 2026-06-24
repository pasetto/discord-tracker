import { describe, expect, it } from 'vitest';
import { BillingLimitError, enforceMaxTrackedMembers } from '../../src/services/billingService';

describe('billingService', () => {
  it('não lança erro quando quantidade está dentro do limite', () => {
    expect(() => {
      enforceMaxTrackedMembers({ currentTrackedMembers: 25, maxTrackedMembers: 25 });
    }).not.toThrow();
  });

  it('lança BillingLimitError quando quantidade excede limite do plano', () => {
    expect(() => {
      enforceMaxTrackedMembers({ currentTrackedMembers: 26, maxTrackedMembers: 25 });
    }).toThrowError(BillingLimitError);
  });
});
