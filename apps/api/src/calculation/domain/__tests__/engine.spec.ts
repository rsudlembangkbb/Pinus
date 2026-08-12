import { calculatePeriod } from "../engine";
import { EmployeeInput, ProportionKey, ServiceTransactionInput } from "../types";

describe("calculatePeriod (end-to-end orchestration)", () => {
  const employees: EmployeeInput[] = [
    { id: "dr-a", staffCategory: "MEDIS", workUnitId: "IBS", jobGradeWeight: null, minimumRequirementLevel: "DOKTER_SPESIALIS" },
    { id: "perawat-1", staffCategory: "KEPERAWATAN", workUnitId: "RAWAT_INAP", jobGradeWeight: 1, minimumRequirementLevel: null },
    { id: "adm-1", staffCategory: "ADMINISTRASI", workUnitId: "TU", jobGradeWeight: null, minimumRequirementLevel: null },
  ];

  const transactions: ServiceTransactionInput[] = [
    { id: "tx1", employeeId: "dr-a", workUnitId: "IBS", guaranteeStatus: "JKN", serviceRole: "OPERATOR", tariffAmount: 200_000_000 },
    { id: "tx2", employeeId: "dpjp-x", workUnitId: "RAWAT_INAP", guaranteeStatus: "JKN", serviceRole: "DPJP", tariffAmount: 50_000_000 },
  ];

  const resolveProportion = (key: ProportionKey) => {
    if (key.workUnitId === "IBS" && key.guaranteeStatus === "JKN" && key.serviceRole === "OPERATOR") return 12;
    if (key.workUnitId === "RAWAT_INAP" && key.guaranteeStatus === "JKN" && key.serviceRole === "PELAKSANA") return 10;
    return null;
  };

  it("produces a fully itemized, auditable result for a mixed-category period", () => {
    const result = calculatePeriod({
      employees,
      transactions,
      attendance: [
        { employeeId: "dr-a", leaveDays: 0, disciplinaryAction: false, fightDuringCoaching: false, trainingDays: 0, studyAssignmentAbsenceDaysPerWeek: 0, attendancePercent: 100 },
      ],
      performance: [],
      indexingScores: [
        { employeeId: "adm-1", variableCode: "EXPERIENCE", score: 70 },
      ],
      indexingWeights: [
        { variableCode: "EXPERIENCE", weightPercent: 100 },
      ],
      deductionRules: [{ trigger: "LEAVE_GE_1_MONTH", percentage: 50 }],
      minimumRequirements: [{ level: "DOKTER_SPESIALIS", minimumAmount: 10_000_000 }],
      resolveProportion,
      adminBudget: 8_000_000,
      performanceBudgetCap: null,
    });

    const drA = result.employees.find((e) => e.employeeId === "dr-a")!;
    // 12% of 200M = 24,000,000 — well above the 10M minimum, so unaffected.
    expect(drA.grossAmount).toBe("24000000");
    expect(drA.minimumRequirementApplied).toBe(false);
    expect(drA.netAmount).toBe("24000000");

    const perawat1 = result.employees.find((e) => e.employeeId === "perawat-1")!;
    // pool = 10% of 50M = 5,000,000; sole KEPERAWATAN employee gets it all.
    expect(perawat1.grossAmount).toBe("5000000");

    const adm1 = result.employees.find((e) => e.employeeId === "adm-1")!;
    // sole ADMINISTRASI employee -> gets 100% of admin budget.
    expect(adm1.grossAmount).toBe("8000000");

    // every result carries a fully reconstructible component breakdown.
    for (const e of result.employees) {
      expect(e.components).toBeDefined();
      expect(e.formulaVersion).toBe("pinus-jaspel-v1");
    }
  });

  it("lifts a below-minimum specialist to the guaranteed floor", () => {
    const lowTariffTx: ServiceTransactionInput[] = [
      { id: "tx1", employeeId: "dr-a", workUnitId: "IBS", guaranteeStatus: "JKN", serviceRole: "OPERATOR", tariffAmount: 10_000_000 },
    ];
    const result = calculatePeriod({
      employees: [employees[0]],
      transactions: lowTariffTx,
      attendance: [],
      performance: [],
      indexingScores: [],
      indexingWeights: [],
      deductionRules: [],
      minimumRequirements: [{ level: "DOKTER_SPESIALIS", minimumAmount: 15_000_000 }],
      resolveProportion,
      adminBudget: 0,
      performanceBudgetCap: null,
    });
    const drA = result.employees.find((e) => e.employeeId === "dr-a")!;
    // 12% of 10M = 1.2M, well under the 15M floor.
    expect(drA.grossAmount).toBe("1200000");
    expect(drA.minimumRequirementApplied).toBe(true);
    expect(drA.netAmount).toBe("15000000");
  });

  it("proportionally cuts every recipient when the hospital-wide pagu is exceeded", () => {
    const result = calculatePeriod({
      employees,
      transactions,
      attendance: [],
      performance: [],
      indexingScores: [],
      indexingWeights: [{ variableCode: "PERFORMANCE", weightPercent: 100 }],
      deductionRules: [],
      minimumRequirements: [],
      resolveProportion,
      adminBudget: 8_000_000,
      performanceBudgetCap: 18_500_000, // half of the ~37M unadjusted total
    });

    const total = result.employees.reduce((acc, e) => acc + Number(e.netAmount), 0);
    expect(total).toBeLessThanOrEqual(18_500_000);
    expect(result.paguAdjustmentFactor).not.toBe("1");
    for (const e of result.employees) {
      expect(Number(e.netAmount)).toBeLessThan(Number(e.grossAmount));
    }
  });

  it("applies a leave deduction on top of the proportional gross amount", () => {
    const result = calculatePeriod({
      employees: [employees[0]],
      transactions: [
        { id: "tx1", employeeId: "dr-a", workUnitId: "IBS", guaranteeStatus: "JKN", serviceRole: "OPERATOR", tariffAmount: 200_000_000 },
      ],
      attendance: [
        { employeeId: "dr-a", leaveDays: 31, disciplinaryAction: false, fightDuringCoaching: false, trainingDays: 0, studyAssignmentAbsenceDaysPerWeek: 0, attendancePercent: 50 },
      ],
      performance: [],
      indexingScores: [],
      indexingWeights: [],
      deductionRules: [{ trigger: "LEAVE_GE_1_MONTH", percentage: 50 }],
      minimumRequirements: [],
      resolveProportion,
      adminBudget: 0,
      performanceBudgetCap: null,
    });
    const drA = result.employees[0];
    expect(drA.grossAmount).toBe("24000000");
    expect(drA.deductionTrigger).toBe("LEAVE_GE_1_MONTH");
    expect(drA.deductionAmount).toBe("12000000");
    expect(drA.netAmount).toBe("12000000");
  });
});
