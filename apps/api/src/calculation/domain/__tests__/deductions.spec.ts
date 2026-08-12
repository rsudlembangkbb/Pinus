import { applyDeduction, findApplicableTriggers } from "../deductions";
import { AttendanceInput } from "../types";

const baseAttendance: AttendanceInput = {
  employeeId: "e1",
  leaveDays: 0,
  disciplinaryAction: false,
  fightDuringCoaching: false,
  trainingDays: 0,
  studyAssignmentAbsenceDaysPerWeek: 0,
  attendancePercent: 100,
};

const rules = [
  { trigger: "DISCIPLINARY_ACTION" as const, percentage: 50 },
  { trigger: "LEAVE_GE_1_MONTH" as const, percentage: 50 },
  { trigger: "FIGHT_DURING_COACHING" as const, percentage: 50 },
  { trigger: "TRAINING_GT_1_MONTH" as const, percentage: 50 },
  { trigger: "STUDY_ASSIGNMENT_ABSENCE" as const, percentage: 80 },
];

describe("deductions", () => {
  it("applies no deduction for partial leave under the 1-month threshold", () => {
    const attendance = { ...baseAttendance, leaveDays: 10 };
    expect(findApplicableTriggers(attendance)).toEqual([]);
    const outcome = applyDeduction(1_000_000, attendance, rules);
    expect(outcome.amount.toString()).toBe("0");
  });

  it("applies the LEAVE_GE_1_MONTH deduction at exactly the 30-day threshold", () => {
    const attendance = { ...baseAttendance, leaveDays: 30 };
    const outcome = applyDeduction(1_000_000, attendance, rules);
    expect(outcome.trigger).toBe("LEAVE_GE_1_MONTH");
    expect(outcome.amount.toString()).toBe("500000");
  });

  it("picks the highest-percentage trigger when multiple conditions are met", () => {
    const attendance = { ...baseAttendance, leaveDays: 30, studyAssignmentAbsenceDaysPerWeek: 3 };
    const outcome = applyDeduction(1_000_000, attendance, rules);
    expect(outcome.trigger).toBe("STUDY_ASSIGNMENT_ABSENCE");
    expect(outcome.percentage.toString()).toBe("80");
    expect(outcome.amount.toString()).toBe("800000");
  });

  it("returns zero deduction when no attendance record exists for the employee", () => {
    const outcome = applyDeduction(1_000_000, undefined, rules);
    expect(outcome.trigger).toBeNull();
    expect(outcome.amount.toString()).toBe("0");
  });

  it("ignores a triggered condition if no rule is configured for it", () => {
    const attendance = { ...baseAttendance, fightDuringCoaching: true };
    const outcome = applyDeduction(1_000_000, attendance, []);
    expect(outcome.trigger).toBeNull();
    expect(outcome.amount.toString()).toBe("0");
  });
});
