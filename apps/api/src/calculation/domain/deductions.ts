import Decimal from "decimal.js";
import { percentOf, ZERO } from "./money";
import { AttendanceInput, DeductionRuleInput, DeductionTriggerCode } from "./types";

export interface DeductionOutcome {
  trigger: DeductionTriggerCode | null;
  percentage: Decimal;
  amount: Decimal;
}

/**
 * PRD §9.5 thresholds. Multiple triggers rarely co-occur in practice (an
 * employee on ≥1-month leave is not simultaneously mid-training); when they
 * do, we apply only the single highest-percentage trigger rather than
 * stacking reductions, since the regulation does not specify additive
 * stacking. This is a documented assumption pending regulatory confirmation.
 */
export function findApplicableTriggers(attendance: AttendanceInput): DeductionTriggerCode[] {
  const triggers: DeductionTriggerCode[] = [];
  if (attendance.disciplinaryAction) triggers.push("DISCIPLINARY_ACTION");
  if (attendance.leaveDays >= 30) triggers.push("LEAVE_GE_1_MONTH");
  if (attendance.fightDuringCoaching) triggers.push("FIGHT_DURING_COACHING");
  if (attendance.trainingDays > 30) triggers.push("TRAINING_GT_1_MONTH");
  if (attendance.studyAssignmentAbsenceDaysPerWeek >= 3) triggers.push("STUDY_ASSIGNMENT_ABSENCE");
  return triggers;
}

export function applyDeduction(
  grossAmount: Decimal.Value,
  attendance: AttendanceInput | undefined,
  rules: DeductionRuleInput[],
): DeductionOutcome {
  if (!attendance) return { trigger: null, percentage: ZERO, amount: ZERO };

  const triggers = findApplicableTriggers(attendance);
  if (triggers.length === 0) return { trigger: null, percentage: ZERO, amount: ZERO };

  const rulesByTrigger = new Map(rules.map((r) => [r.trigger, r.percentage]));
  let best: { trigger: DeductionTriggerCode; percentage: Decimal } | null = null;
  for (const trigger of triggers) {
    const percentage = rulesByTrigger.get(trigger);
    if (percentage === undefined) continue;
    const pct = new Decimal(percentage);
    if (!best || pct.gt(best.percentage)) best = { trigger, percentage: pct };
  }

  if (!best) return { trigger: null, percentage: ZERO, amount: ZERO };

  const amount = percentOf(grossAmount, best.percentage);
  return { trigger: best.trigger, percentage: best.percentage, amount };
}
