import { describe, expect, it } from 'vitest';
import { canDecideStepAtPeriodStatus } from '@/domain/workflow/approval-sequence';

/**
 * Regression test for a bug found via an end-to-end run (not caught by
 * type-checking or the calculation-engine unit tests): approval_steps
 * rows are all created 'pending' up-front when verification is submitted,
 * so without an explicit stage check, an authorized approver (including
 * Super Admin, who passes every role check) could approve a later stage
 * - e.g. Direktur - before an earlier one - e.g. Keuangan - had acted,
 * corrupting the maker-checker-approver sequence and the period's status.
 */
describe('canDecideStepAtPeriodStatus', () => {
  it('allows verifikasi_unit only while the period is verifying_unit', () => {
    expect(canDecideStepAtPeriodStatus('verifikasi_unit', 'verifying_unit')).toBe(true);
    expect(canDecideStepAtPeriodStatus('verifikasi_unit', 'verifying_keuangan')).toBe(false);
    expect(canDecideStepAtPeriodStatus('verifikasi_unit', 'verifying_direktur')).toBe(false);
  });

  it('allows verifikasi_keuangan only while the period is verifying_keuangan', () => {
    expect(canDecideStepAtPeriodStatus('verifikasi_keuangan', 'verifying_unit')).toBe(false);
    expect(canDecideStepAtPeriodStatus('verifikasi_keuangan', 'verifying_keuangan')).toBe(true);
    expect(canDecideStepAtPeriodStatus('verifikasi_keuangan', 'verifying_direktur')).toBe(false);
  });

  it('allows persetujuan_direktur only while the period is verifying_direktur (blocks skipping ahead)', () => {
    expect(canDecideStepAtPeriodStatus('persetujuan_direktur', 'verifying_unit')).toBe(false);
    expect(canDecideStepAtPeriodStatus('persetujuan_direktur', 'verifying_keuangan')).toBe(false);
    expect(canDecideStepAtPeriodStatus('persetujuan_direktur', 'verifying_direktur')).toBe(true);
  });

  it('does not gate unknown/future step types (fails open rather than blocking new step types)', () => {
    expect(canDecideStepAtPeriodStatus('some_future_step', 'verifying_unit')).toBe(true);
  });
});
