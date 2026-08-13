import { describe, expect, it } from 'vitest';
import { calculateTeamUnitIncentives } from '@/domain/calculation/kesehatan';
import { TeamUnitConfig, UnitRevenue, UnitStaffMember } from '@/domain/calculation/types';

const config: TeamUnitConfig = { proportionBps: 3000, fixedPortionBps: 2000 }; // 30% pool, 20% fixed / 80% subsidy

describe('calculateTeamUnitIncentives', () => {
  it('distributes the fixed portion within the unit by weight', () => {
    const revenues: UnitRevenue[] = [{ workUnitId: 'unit-a', totalRevenue: 100_000_000 }];
    const staff: UnitStaffMember[] = [
      { employeeId: 'nurse-1', workUnitId: 'unit-a', category: 'keperawatan', jobGradeWeightBps: 20_000, attendanceFactorBps: 10_000 },
      { employeeId: 'nurse-2', workUnitId: 'unit-a', category: 'keperawatan', jobGradeWeightBps: 10_000, attendanceFactorBps: 10_000 }
    ];
    const result = calculateTeamUnitIncentives(revenues, staff, config);
    const byId = Object.fromEntries(result.map((r) => [r.employeeId, r.grossAmount]));
    // pool = 30% of 100M = 30M; fixed = 20% of 30M = 6M; subsidy = 24M (all goes back to this unit since it's the only one)
    // nurse-1 weight 2x nurse-2 -> gets 2x the fixed portion and 2x the subsidy portion
    expect(byId['nurse-1']).toBeGreaterThan(byId['nurse-2']!);
    const ratio = byId['nurse-1']! / byId['nurse-2']!;
    expect(ratio).toBeCloseTo(2, 1);
  });

  it('subsidises a low-revenue unit from a high-revenue unit pool', () => {
    const revenues: UnitRevenue[] = [
      { workUnitId: 'unit-rich', totalRevenue: 200_000_000 },
      { workUnitId: 'unit-poor', totalRevenue: 0 }
    ];
    const staff: UnitStaffMember[] = [
      { employeeId: 'rich-1', workUnitId: 'unit-rich', category: 'keperawatan', jobGradeWeightBps: 10_000, attendanceFactorBps: 10_000 },
      { employeeId: 'poor-1', workUnitId: 'unit-poor', category: 'keperawatan', jobGradeWeightBps: 10_000, attendanceFactorBps: 10_000 }
    ];
    const result = calculateTeamUnitIncentives(revenues, staff, config);
    const poor = result.find((r) => r.employeeId === 'poor-1');
    expect(poor).toBeDefined();
    expect(poor!.grossAmount).toBeGreaterThan(0); // received subsidy despite unit revenue = 0
  });

  it('reduces effective weight for partial attendance', () => {
    const revenues: UnitRevenue[] = [{ workUnitId: 'unit-a', totalRevenue: 100_000_000 }];
    const staff: UnitStaffMember[] = [
      { employeeId: 'full', workUnitId: 'unit-a', category: 'keperawatan', jobGradeWeightBps: 10_000, attendanceFactorBps: 10_000 },
      { employeeId: 'half', workUnitId: 'unit-a', category: 'keperawatan', jobGradeWeightBps: 10_000, attendanceFactorBps: 5_000 }
    ];
    const result = calculateTeamUnitIncentives(revenues, staff, config);
    const byId = Object.fromEntries(result.map((r) => [r.employeeId, r.grossAmount]));
    expect(byId['full']).toBeGreaterThan(byId['half']!);
  });
});
