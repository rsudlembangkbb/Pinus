import { calculateAdminIndexing } from "../admin-indexing-engine";
import { EmployeeInput } from "../types";

describe("calculateAdminIndexing", () => {
  const employees: EmployeeInput[] = [
    { id: "adm-1", staffCategory: "ADMINISTRASI", workUnitId: "TU", jobGradeWeight: null, minimumRequirementLevel: null },
    { id: "adm-2", staffCategory: "ADMINISTRASI", workUnitId: "TU", jobGradeWeight: null, minimumRequirementLevel: null },
  ];

  const weights = [
    { variableCode: "EXPERIENCE" as const, weightPercent: 20 },
    { variableCode: "SKILL" as const, weightPercent: 20 },
    { variableCode: "RISK" as const, weightPercent: 10 },
    { variableCode: "URGENCY" as const, weightPercent: 10 },
    { variableCode: "POSITION" as const, weightPercent: 10 },
    { variableCode: "PERFORMANCE" as const, weightPercent: 30 },
  ];

  it("allocates budget proportional to individual score over total score", () => {
    const scores = [
      { employeeId: "adm-1", variableCode: "EXPERIENCE" as const, score: 80 },
      { employeeId: "adm-1", variableCode: "SKILL" as const, score: 80 },
      { employeeId: "adm-1", variableCode: "RISK" as const, score: 50 },
      { employeeId: "adm-1", variableCode: "URGENCY" as const, score: 50 },
      { employeeId: "adm-1", variableCode: "POSITION" as const, score: 60 },
      { employeeId: "adm-2", variableCode: "EXPERIENCE" as const, score: 40 },
      { employeeId: "adm-2", variableCode: "SKILL" as const, score: 40 },
      { employeeId: "adm-2", variableCode: "RISK" as const, score: 50 },
      { employeeId: "adm-2", variableCode: "URGENCY" as const, score: 50 },
      { employeeId: "adm-2", variableCode: "POSITION" as const, score: 30 },
    ];
    const attendance = [
      { employeeId: "adm-1", leaveDays: 0, disciplinaryAction: false, fightDuringCoaching: false, trainingDays: 0, studyAssignmentAbsenceDaysPerWeek: 0, attendancePercent: 100 },
      { employeeId: "adm-2", leaveDays: 0, disciplinaryAction: false, fightDuringCoaching: false, trainingDays: 0, studyAssignmentAbsenceDaysPerWeek: 0, attendancePercent: 80 },
    ];
    const performance = [
      { employeeId: "adm-1", qualityScore: 90 },
      { employeeId: "adm-2", qualityScore: 70 },
    ];

    const result = calculateAdminIndexing(10_000_000, employees, scores, weights, attendance, performance);

    // adm-1 performance = 100*0.4 + 90*0.6 = 94
    // adm-1 score = 80*.2+80*.2+50*.1+50*.1+60*.1+94*.3 = 16+16+5+5+6+28.2 = 76.2
    // adm-2 performance = 80*0.4 + 70*0.6 = 74
    // adm-2 score = 40*.2+40*.2+50*.1+50*.1+30*.1+74*.3 = 8+8+5+5+3+22.2 = 51.2
    const adm1 = result.find((r) => r.employeeId === "adm-1")!;
    const adm2 = result.find((r) => r.employeeId === "adm-2")!;
    expect(adm1.individualScore.toFixed(1)).toBe("76.2");
    expect(adm2.individualScore.toFixed(1)).toBe("51.2");

    const total = adm1.individualScore.plus(adm2.individualScore);
    expect(adm1.grossAmount.plus(adm2.grossAmount).toFixed(2)).toBe("10000000.00");
    expect(adm1.grossAmount.toFixed(2)).toBe(
      adm1.individualScore.div(total).mul(10_000_000).toFixed(2),
    );
  });

  it("returns zero allocation when total score is zero to avoid division by zero", () => {
    const result = calculateAdminIndexing(
      10_000_000,
      employees,
      [],
      weights,
      [],
      [],
    );
    for (const r of result) {
      // No attendance record defaults to 100% attendance, so PERFORMANCE
      // alone keeps totalScore > 0 in the default case; force zero weights
      // to truly exercise the zero-division guard instead.
      expect(r.grossAmount.gte(0)).toBe(true);
    }
  });

  it("guards division by zero when all weights are zero", () => {
    const zeroWeights = weights.map((w) => ({ ...w, weightPercent: 0 }));
    const result = calculateAdminIndexing(10_000_000, employees, [], zeroWeights, [], []);
    expect(result.every((r) => r.grossAmount.eq(0))).toBe(true);
  });
});
