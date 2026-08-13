import { applyBps } from '@/lib/money';
import { CalculationLine, EmployeeGrossResult, TeamUnitConfig, UnitRevenue, UnitStaffMember } from './types';

/**
 * Tenaga Kesehatan (tim kerja unit) incentive per PRD 5.3.2 / 9.2:
 * 1. Each unit's Jaspel pool = unit revenue x proportion.
 * 2. The pool splits into a "porsi tetap" kept within the unit and
 *    distributed by weight (job grade x attendance) among that unit's own
 *    staff, and a "porsi subsidi antar-unit": all units' subsidy amounts
 *    are pooled together and redistributed to every eligible staff member
 *    hospital-wide, proportional to weight - so lower-revenue units are
 *    subsidised by higher-revenue ones.
 */
export function calculateTeamUnitIncentives(
  unitRevenues: UnitRevenue[],
  staff: UnitStaffMember[],
  config: TeamUnitConfig
): EmployeeGrossResult[] {
  const staffByUnit = new Map<string, UnitStaffMember[]>();
  for (const s of staff) {
    const list = staffByUnit.get(s.workUnitId) ?? [];
    list.push(s);
    staffByUnit.set(s.workUnitId, list);
  }

  const perEmployee = new Map<string, { total: number; lines: CalculationLine[] }>();
  const addAmount = (employeeId: string, amount: number, line: CalculationLine) => {
    if (amount === 0) return;
    const entry = perEmployee.get(employeeId) ?? { total: 0, lines: [] };
    entry.total += amount;
    entry.lines.push(line);
    perEmployee.set(employeeId, entry);
  };

  let subsidyPool = 0;

  for (const unit of unitRevenues) {
    const pool = applyBps(unit.totalRevenue, config.proportionBps);
    const fixedPortion = applyBps(pool, config.fixedPortionBps);
    const subsidyPortion = pool - fixedPortion;
    subsidyPool += subsidyPortion;

    const unitStaff = staffByUnit.get(unit.workUnitId) ?? [];
    const totalWeight = sumWeight(unitStaff);
    if (totalWeight > 0) {
      for (const member of unitStaff) {
        const share = weightedShare(fixedPortion, effectiveWeight(member), totalWeight);
        addAmount(member.employeeId, share, {
          label: `Porsi tetap unit (${unit.workUnitId})`,
          amount: share,
          meta: { unitPool: pool, fixedPortion, weightBps: effectiveWeight(member) }
        });
      }
    }
  }

  const totalWeightAllStaff = sumWeight(staff);
  if (totalWeightAllStaff > 0 && subsidyPool > 0) {
    for (const member of staff) {
      const share = weightedShare(subsidyPool, effectiveWeight(member), totalWeightAllStaff);
      addAmount(member.employeeId, share, {
        label: 'Porsi subsidi antar-unit',
        amount: share,
        meta: { subsidyPool, weightBps: effectiveWeight(member) }
      });
    }
  }

  return Array.from(perEmployee.entries()).map(([employeeId, v]) => {
    const member = staff.find((s) => s.employeeId === employeeId);
    return {
      employeeId,
      category: member?.category ?? 'keperawatan',
      grossAmount: v.total,
      breakdown: v.lines
    };
  });
}

function effectiveWeight(member: UnitStaffMember): number {
  return Math.round((member.jobGradeWeightBps * member.attendanceFactorBps) / 10_000);
}

function sumWeight(members: UnitStaffMember[]): number {
  return members.reduce((acc, m) => acc + effectiveWeight(m), 0);
}

function weightedShare(pool: number, weight: number, totalWeight: number): number {
  if (totalWeight === 0) return 0;
  return Math.round((pool * weight) / totalWeight);
}
