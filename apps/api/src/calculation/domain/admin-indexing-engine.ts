import Decimal from "decimal.js";
import { money, sum, ZERO } from "./money";
import {
  AttendanceInput,
  EmployeeInput,
  IndexingScoreInput,
  IndexingWeightInput,
  PerformanceInput,
} from "./types";

export interface AdminIndexingLineItem {
  variableCode: string;
  score: string;
  weightPercent: string;
  weightedScore: string;
}

export interface AdminIndexingResult {
  employeeId: string;
  grossAmount: Decimal;
  individualScore: Decimal;
  totalScoreAllEmployees: Decimal;
  lineItems: AdminIndexingLineItem[];
}

const ATTENDANCE_WEIGHT = money(40);
const QUALITY_WEIGHT = money(60);

/**
 * PRD §9.3 — administrative/structural staff: insentif = budget x
 * (individual score / total score of all ADMINISTRASI+STRUKTURAL staff).
 * Individual score = sum(variable weight% x variable score), where the
 * PERFORMANCE variable is itself composed as attendance 40% + quality 60%
 * rather than a manually-entered raw score.
 */
export function calculateAdminIndexing(
  adminBudget: Decimal.Value,
  employees: EmployeeInput[],
  indexingScores: IndexingScoreInput[],
  indexingWeights: IndexingWeightInput[],
  attendance: AttendanceInput[],
  performance: PerformanceInput[],
): AdminIndexingResult[] {
  const eligible = employees.filter(
    (e) => e.staffCategory === "ADMINISTRASI" || e.staffCategory === "STRUKTURAL",
  );
  if (eligible.length === 0) return [];

  const scoresByEmployee = new Map<string, Map<string, Decimal>>();
  for (const s of indexingScores) {
    const map = scoresByEmployee.get(s.employeeId) ?? new Map<string, Decimal>();
    map.set(s.variableCode, money(s.score));
    scoresByEmployee.set(s.employeeId, map);
  }

  const attendanceByEmployee = new Map(attendance.map((a) => [a.employeeId, a]));
  const performanceByEmployee = new Map(performance.map((p) => [p.employeeId, p]));

  const employeeLineItems = new Map<string, AdminIndexingLineItem[]>();
  const employeeScore = new Map<string, Decimal>();

  for (const emp of eligible) {
    const scores = scoresByEmployee.get(emp.id) ?? new Map<string, Decimal>();
    const att = attendanceByEmployee.get(emp.id);
    const perf = performanceByEmployee.get(emp.id);

    // PERFORMANCE is derived, not looked up directly.
    const performanceScore = money(att?.attendancePercent ?? 100)
      .mul(ATTENDANCE_WEIGHT)
      .div(100)
      .plus(money(perf?.qualityScore ?? 0).mul(QUALITY_WEIGHT).div(100));

    const lineItems: AdminIndexingLineItem[] = [];
    let individualScore = ZERO;

    for (const w of indexingWeights) {
      const rawScore = w.variableCode === "PERFORMANCE" ? performanceScore : scores.get(w.variableCode) ?? ZERO;
      const weightedScore = rawScore.mul(w.weightPercent).div(100);
      individualScore = individualScore.plus(weightedScore);
      lineItems.push({
        variableCode: w.variableCode,
        score: rawScore.toString(),
        weightPercent: money(w.weightPercent).toString(),
        weightedScore: weightedScore.toString(),
      });
    }

    employeeLineItems.set(emp.id, lineItems);
    employeeScore.set(emp.id, individualScore);
  }

  const totalScore = sum(Array.from(employeeScore.values()).map((s) => s.toString()));

  return eligible.map((emp) => {
    const individualScore = employeeScore.get(emp.id) ?? ZERO;
    const grossAmount = totalScore.gt(0)
      ? money(adminBudget).mul(individualScore).div(totalScore)
      : ZERO;
    return {
      employeeId: emp.id,
      grossAmount,
      individualScore,
      totalScoreAllEmployees: totalScore,
      lineItems: employeeLineItems.get(emp.id) ?? [],
    };
  });
}
