import { describe, expect, it } from 'vitest';
import { applyDeductions } from '@/domain/calculation/deductions';
import { DeductionRuleInput } from '@/domain/calculation/types';

const rules: DeductionRuleInput[] = [
  { attendanceRecordType: 'cuti', deductionBps: 5000 }, // -50%
  { attendanceRecordType: 'diklat', deductionBps: 5000 }, // -50%
  { attendanceRecordType: 'tugas_belajar', deductionBps: 8000 }, // -80%
  { attendanceRecordType: 'pembinaan_disiplin', deductionBps: 5000 }
];

describe('applyDeductions', () => {
  it('applies no deduction when attendance is normal', () => {
    const result = applyDeductions(1_000_000, [{ employeeId: 'a', recordType: 'hadir', daysCount: 2200 }], rules);
    expect(result.deductionAmount).toBe(0);
  });

  it('applies the configured percentage for a single matching condition', () => {
    const result = applyDeductions(1_000_000, [{ employeeId: 'a', recordType: 'cuti', daysCount: 3100 }], rules);
    expect(result.deductionAmount).toBe(500_000);
    expect(result.lines).toHaveLength(1);
  });

  it('does not stack multiple simultaneous conditions - takes the largest cut only', () => {
    const result = applyDeductions(
      1_000_000,
      [
        { employeeId: 'a', recordType: 'cuti', daysCount: 3100 },
        { employeeId: 'a', recordType: 'tugas_belajar', daysCount: 1500 }
      ],
      rules
    );
    expect(result.deductionAmount).toBe(800_000); // the 80% rule wins, not 50%+80%
  });

  it('ignores record types with no configured rule', () => {
    const result = applyDeductions(1_000_000, [{ employeeId: 'a', recordType: 'hadir', daysCount: 2000 }], rules);
    expect(result.deductionAmount).toBe(0);
  });
});
