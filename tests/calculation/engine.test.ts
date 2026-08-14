import { describe, expect, it } from 'vitest';
import { runCalculationEngine } from '@/domain/calculation/engine';

describe('runCalculationEngine', () => {
  it('combines medis + kesehatan + administrasi, applies deductions, minimums, and pagu cap coherently', () => {
    const output = runCalculationEngine({
      medisTransactions: [
        {
          id: 'tx1',
          employeeId: 'dr-a',
          workUnitId: 'unit-igd',
          paymentType: 'non_jkn',
          tariffValue: 20_000_000,
          role: 'dpjp',
          serviceType: 'Tindakan IGD'
        }
      ],
      medisSchemes: [{ workUnitId: 'unit-igd', paymentType: 'non_jkn', role: 'dpjp', proportionBps: 6000 }],

      unitRevenues: [{ workUnitId: 'unit-rawat-inap', totalRevenue: 50_000_000 }],
      unitStaff: [
        {
          employeeId: 'nurse-a',
          workUnitId: 'unit-rawat-inap',
          category: 'keperawatan',
          jobGradeWeightBps: 10_000,
          attendanceFactorBps: 10_000
        }
      ],
      teamUnitConfig: { proportionBps: 2000, fixedPortionBps: 5000 },

      administrationAllocation: 5_000_000,
      administrationScores: [{ employeeId: 'admin-a', finalScoreCentiPoints: 8500 }],

      attendanceByEmployee: new Map([['dr-a', [{ employeeId: 'dr-a', recordType: 'cuti', daysCount: 3100 }]]]),
      deductionRules: [{ attendanceRecordType: 'cuti', deductionBps: 5000 }],

      minimumCategoryByEmployee: new Map([['dr-a', 'dokter_spesialis']]),
      minimumRequirements: [{ category: 'dokter_spesialis', minimumAmount: 15_000_000 }],

      budgetCap: null,
      estimateFlagByEmployee: new Map()
    });

    const drA = output.results.find((r) => r.employeeId === 'dr-a')!;
    // gross = 60% of 20M = 12M; deduction = 50% (cuti) = 6M; after deduction = 6M
    // minimum requirement for dokter_spesialis = 15M -> top-up of 9M -> net = 15M
    expect(drA.grossAmount).toBe(12_000_000);
    expect(drA.deductionAmount).toBe(6_000_000);
    expect(drA.minimumTopupAmount).toBe(9_000_000);
    expect(drA.netAmount).toBe(15_000_000);

    const nurseA = output.results.find((r) => r.employeeId === 'nurse-a')!;
    expect(nurseA.netAmount).toBeGreaterThan(0);

    const adminA = output.results.find((r) => r.employeeId === 'admin-a')!;
    expect(adminA.netAmount).toBe(5_000_000);

    expect(output.budgetCapApplied).toBe(false);
    expect(output.totalNetAmount).toBe(drA.netAmount + nurseA.netAmount + adminA.netAmount);
  });

  it('applies the budget cap across every category together when the pagu is exceeded', () => {
    const output = runCalculationEngine({
      medisTransactions: [
        {
          id: 'tx1',
          employeeId: 'dr-a',
          workUnitId: 'unit-igd',
          paymentType: 'non_jkn',
          tariffValue: 100_000_000,
          role: 'dpjp',
          serviceType: 'Tindakan IGD'
        }
      ],
      medisSchemes: [{ workUnitId: 'unit-igd', paymentType: 'non_jkn', role: 'dpjp', proportionBps: 6000 }],
      unitRevenues: [],
      unitStaff: [],
      teamUnitConfig: { proportionBps: 2000, fixedPortionBps: 5000 },
      administrationAllocation: 0,
      administrationScores: [],
      attendanceByEmployee: new Map(),
      deductionRules: [],
      minimumCategoryByEmployee: new Map(),
      minimumRequirements: [],
      budgetCap: 30_000_000,
      estimateFlagByEmployee: new Map()
    });

    // gross = 60M, cap = 30M -> scaled down to exactly 30M
    expect(output.budgetCapApplied).toBe(true);
    expect(output.totalNetAmount).toBe(30_000_000);
    const drA = output.results.find((r) => r.employeeId === 'dr-a')!;
    expect(drA.paguAdjustmentAmount).toBe(-30_000_000);
  });
});
