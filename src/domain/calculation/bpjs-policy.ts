import { applyBps } from '@/lib/money';

export type BpjsPendingPolicy = 'accrual' | 'cash' | 'hybrid';
export type BpjsClaimStatus = 'diajukan' | 'diverifikasi' | 'dicairkan' | 'pending' | 'ditolak';

export interface BpjsResolutionInput {
  tariffValue: number;
  claimStatus: BpjsClaimStatus | null;
  realizationValue: number | null;
  policy: BpjsPendingPolicy;
  /** Historical cash-out ratio for hybrid discounting, basis points (e.g. 8500 = 85% of pending claims historically get paid). Defaults to 8000 (80%) if unknown. */
  hybridDiscountBps?: number;
}

export interface BpjsResolutionOutput {
  value: number;
  isEstimate: boolean;
}

/**
 * Resolves how much of a JKN service transaction's tariff value counts
 * toward the current period's Jaspel calculation, per the RSUD Lembang
 * policy decision on pending BPJS claims (PRD section 9.6). The decision
 * of *which* policy is active is a management/Direktur decision (stored
 * per-period as `bpjsPendingPolicy`) - this function only implements the
 * three documented mechanics so all three remain available in the system.
 */
export function resolveJknTransactionValue(input: BpjsResolutionInput): BpjsResolutionOutput {
  const { tariffValue, claimStatus, realizationValue, policy } = input;

  const isRejected = claimStatus === 'ditolak';
  if (isRejected) return { value: 0, isEstimate: false };

  const isFinal = claimStatus === 'dicairkan';
  if (isFinal) {
    return { value: realizationValue ?? tariffValue, isEstimate: false };
  }

  // Not yet final (diajukan / diverifikasi / pending / null)
  switch (policy) {
    case 'accrual':
      return { value: tariffValue, isEstimate: true };
    case 'cash':
      return { value: 0, isEstimate: false };
    case 'hybrid': {
      const bps = input.hybridDiscountBps ?? 8_000;
      return { value: applyBps(tariffValue, bps), isEstimate: true };
    }
    default:
      return { value: tariffValue, isEstimate: true };
  }
}
