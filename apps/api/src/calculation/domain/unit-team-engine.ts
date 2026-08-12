import Decimal from "decimal.js";
import { money, percentOf, sum, ZERO } from "./money";
import { EmployeeInput, ProportionResolver, ServiceTransactionInput, UnitTeamSubsidyConfig } from "./types";

export interface UnitTeamLineItem {
  workUnitId: string;
  unitPoolShare: string;
  crossUnitSubsidyShare: string;
  weight: string;
  amount: string;
}

export interface UnitTeamResult {
  employeeId: string;
  grossAmount: Decimal;
  lineItems: UnitTeamLineItem[];
}

interface UnitRevenue {
  workUnitId: string;
  jknTotal: Decimal;
  nonJknTotal: Decimal;
}

/**
 * PRD §9.2 — tenaga kesehatan (perawat & nakes non-keperawatan) are paid from
 * a unit-level pool, not per transaction. Each unit's pool = its JKN revenue
 * x the unit's JKN team % + its Non-JKN revenue x the unit's Non-JKN team %
 * (both resolved via ProportionScheme with serviceRole "PELAKSANA", the role
 * used for team/pooled distribution). The pool is then split into a fixed
 * portion (stays and is distributed within the unit) and, if a subsidy
 * config is supplied, a cross-unit subsidy portion pooled hospital-wide and
 * redistributed to every eligible employee by job-grade weight — mirroring
 * the reference "20% tetap / 80% subsidi" pattern found in the Kemenkes
 * document (PRD §9.2), which RSUD Lembang has not yet confirmed adopting.
 * Without a subsidyConfig, 100% of every unit's pool is fixed (distributed
 * only within that unit) — the conservative default.
 */
export function calculateUnitTeam(
  transactions: ServiceTransactionInput[],
  employees: EmployeeInput[],
  resolveProportion: ProportionResolver,
  subsidyConfig?: UnitTeamSubsidyConfig,
): UnitTeamResult[] {
  const eligible = employees.filter(
    (e) => e.staffCategory === "KEPERAWATAN" || e.staffCategory === "NAKES_LAIN",
  );
  if (eligible.length === 0) return [];

  const revenueByUnit = new Map<string, UnitRevenue>();
  for (const tx of transactions) {
    const entry = revenueByUnit.get(tx.workUnitId) ?? {
      workUnitId: tx.workUnitId,
      jknTotal: ZERO,
      nonJknTotal: ZERO,
    };
    if (tx.guaranteeStatus === "JKN") entry.jknTotal = entry.jknTotal.plus(tx.tariffAmount);
    else entry.nonJknTotal = entry.nonJknTotal.plus(tx.tariffAmount);
    revenueByUnit.set(tx.workUnitId, entry);
  }

  const fixedPortionPercent = money(subsidyConfig?.fixedPortionPercent ?? 100);
  const subsidyPortionPercent = money(100).minus(fixedPortionPercent);

  const employeesByUnit = new Map<string, EmployeeInput[]>();
  for (const emp of eligible) {
    const list = employeesByUnit.get(emp.workUnitId) ?? [];
    list.push(emp);
    employeesByUnit.set(emp.workUnitId, list);
  }

  const weightOf = (emp: EmployeeInput) => money(emp.jobGradeWeight ?? 1);

  const unitFixedShare = new Map<string, Decimal>();
  const unitSubsidyContribution = new Map<string, Decimal>();
  let totalSubsidyPool = ZERO;

  for (const [workUnitId, revenue] of revenueByUnit) {
    const jknPercent = resolveProportion({
      workUnitId,
      guaranteeStatus: "JKN",
      serviceRole: "PELAKSANA",
    });
    const nonJknPercent = resolveProportion({
      workUnitId,
      guaranteeStatus: "NON_JKN",
      serviceRole: "PELAKSANA",
    });

    const pool = (jknPercent !== null ? percentOf(revenue.jknTotal, jknPercent) : ZERO).plus(
      nonJknPercent !== null ? percentOf(revenue.nonJknTotal, nonJknPercent) : ZERO,
    );

    const fixed = percentOf(pool, fixedPortionPercent);
    const subsidy = pool.minus(fixed);
    unitFixedShare.set(workUnitId, fixed);
    unitSubsidyContribution.set(workUnitId, subsidy);
    totalSubsidyPool = totalSubsidyPool.plus(subsidy);
  }

  const totalWeightAllUnits = sum(eligible.map((e) => weightOf(e).toString()));

  const results: UnitTeamResult[] = [];
  for (const [workUnitId, unitEmployees] of employeesByUnit) {
    const fixedPool = unitFixedShare.get(workUnitId) ?? ZERO;
    const unitWeightTotal = sum(unitEmployees.map((e) => weightOf(e).toString()));

    for (const emp of unitEmployees) {
      const weight = weightOf(emp);
      const fixedShare =
        unitWeightTotal.gt(0) && fixedPool.gt(0)
          ? fixedPool.mul(weight).div(unitWeightTotal)
          : ZERO;
      const subsidyShare =
        subsidyPortionPercent.gt(0) && totalSubsidyPool.gt(0) && totalWeightAllUnits.gt(0)
          ? totalSubsidyPool.mul(weight).div(totalWeightAllUnits)
          : ZERO;

      const amount = fixedShare.plus(subsidyShare);
      results.push({
        employeeId: emp.id,
        grossAmount: amount,
        lineItems: [
          {
            workUnitId,
            unitPoolShare: fixedShare.toString(),
            crossUnitSubsidyShare: subsidyShare.toString(),
            weight: weight.toString(),
            amount: amount.toString(),
          },
        ],
      });
    }
  }

  return results;
}
