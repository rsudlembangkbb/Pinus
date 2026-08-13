import { describe, expect, it } from 'vitest';
import { resolveJknTransactionValue } from '@/domain/calculation/bpjs-policy';

describe('resolveJknTransactionValue', () => {
  it('returns full realization value once a claim is dicairkan, regardless of policy', () => {
    for (const policy of ['accrual', 'cash', 'hybrid'] as const) {
      const result = resolveJknTransactionValue({
        tariffValue: 1_000_000,
        claimStatus: 'dicairkan',
        realizationValue: 950_000,
        policy
      });
      expect(result).toEqual({ value: 950_000, isEstimate: false });
    }
  });

  it('returns zero for a rejected claim regardless of policy', () => {
    const result = resolveJknTransactionValue({
      tariffValue: 1_000_000,
      claimStatus: 'ditolak',
      realizationValue: null,
      policy: 'accrual'
    });
    expect(result).toEqual({ value: 0, isEstimate: false });
  });

  describe('pending / not-yet-final claims', () => {
    it('accrual: counts the full tariff value as an estimate', () => {
      const result = resolveJknTransactionValue({
        tariffValue: 1_000_000,
        claimStatus: 'pending',
        realizationValue: null,
        policy: 'accrual'
      });
      expect(result).toEqual({ value: 1_000_000, isEstimate: true });
    });

    it('cash: counts nothing until the claim is realized', () => {
      const result = resolveJknTransactionValue({
        tariffValue: 1_000_000,
        claimStatus: 'diajukan',
        realizationValue: null,
        policy: 'cash'
      });
      expect(result).toEqual({ value: 0, isEstimate: false });
    });

    it('hybrid: applies the historical discount ratio as an estimate', () => {
      const result = resolveJknTransactionValue({
        tariffValue: 1_000_000,
        claimStatus: 'diverifikasi',
        realizationValue: null,
        policy: 'hybrid',
        hybridDiscountBps: 8_500
      });
      expect(result).toEqual({ value: 850_000, isEstimate: true });
    });
  });
});
