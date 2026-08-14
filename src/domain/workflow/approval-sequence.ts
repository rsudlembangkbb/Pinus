export type ApprovalStepType = 'verifikasi_unit' | 'verifikasi_keuangan' | 'persetujuan_direktur';

/**
 * Maps each approval step type to the period status it may only be decided
 * under. All approval_steps rows for a period are created up-front as
 * 'pending' when verification is submitted (PRD 5.4.3 "Persetujuan
 * Berjenjang"), so without this check any authorized role - including
 * Super Admin, who is authorized for every step type - could approve a
 * later stage (e.g. Direktur) before an earlier one (e.g. Keuangan) has
 * acted, corrupting the maker-checker-approver sequence and the period's
 * status. This was caught by an end-to-end run, not by type-checking or
 * unit tests on the calculation engine alone.
 */
export const EXPECTED_PERIOD_STATUS_FOR_STEP: Record<ApprovalStepType, string> = {
  verifikasi_unit: 'verifying_unit',
  verifikasi_keuangan: 'verifying_keuangan',
  persetujuan_direktur: 'verifying_direktur'
};

export function canDecideStepAtPeriodStatus(stepType: string, periodStatus: string): boolean {
  const expected = EXPECTED_PERIOD_STATUS_FOR_STEP[stepType as ApprovalStepType];
  return expected === undefined || expected === periodStatus;
}
