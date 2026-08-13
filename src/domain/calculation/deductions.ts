import { applyBps } from '@/lib/money';
import { AttendanceDeductionInput, CalculationLine, DeductionRuleInput } from './types';

export interface DeductionResult {
  deductionAmount: number;
  lines: CalculationLine[];
}

/**
 * Applies pengurangan/potongan (PRD 5.3.5 / 9.5) sourced from BARAYA
 * attendance data: cuti >= 1 bulan -50%, diklat > 1 bulan -50%, pembinaan
 * disiplin per rule, tugas belajar dengan ketidakhadiran tertentu -80%,
 * etc. If multiple deduction conditions apply in the same period, only the
 * single largest cut is applied (deductions are not stacked/compounded),
 * to avoid over-penalising for concurrent, overlapping conditions.
 */
export function applyDeductions(
  grossAmount: number,
  attendance: AttendanceDeductionInput[],
  rules: DeductionRuleInput[]
): DeductionResult {
  const ruleByType = new Map(rules.map((r) => [r.attendanceRecordType, r.deductionBps]));

  let applied: { recordType: string; daysCount: number; bps: number } | null = null;
  for (const record of attendance) {
    const bps = ruleByType.get(record.recordType);
    if (bps === undefined || record.daysCount <= 0) continue;
    if (!applied || bps > applied.bps) {
      applied = { recordType: record.recordType, daysCount: record.daysCount, bps };
    }
  }

  if (!applied) {
    return { deductionAmount: 0, lines: [] };
  }

  const deductionAmount = applyBps(grossAmount, applied.bps);
  const line: CalculationLine = {
    label: `Potongan: ${applied.recordType}`,
    amount: -deductionAmount,
    meta: { recordType: applied.recordType, daysCount: applied.daysCount / 100, deductionBps: applied.bps }
  };
  return { deductionAmount, lines: [line] };
}
