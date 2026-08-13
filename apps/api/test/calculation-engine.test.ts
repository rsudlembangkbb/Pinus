import { describe, expect, it } from "vitest";
import { runCalculationEngine } from "../src/domain/calculation-engine/engine.js";
import { calculateMedis } from "../src/domain/calculation-engine/medis.js";
import { calculateTimUnit } from "../src/domain/calculation-engine/timUnit.js";
import { calculateIndexing } from "../src/domain/calculation-engine/indexing.js";
import { computeDeduction } from "../src/domain/calculation-engine/deductions.js";
import { applyMinimumRequirement } from "../src/domain/calculation-engine/minimumRequirement.js";
import { computeAdjustmentFactorBp } from "../src/domain/calculation-engine/paguAdjustment.js";
import type {
  CalculationEngineInput,
  EngineDeductionRule,
  EngineEmployee,
  EngineEmployeeDeduction,
  EngineJobGrade,
  EngineMinimumRequirement,
  EngineProportionRule,
  EngineTransaction,
} from "../src/domain/calculation-engine/types.js";

function employee(overrides: Partial<EngineEmployee> & { id: string }): EngineEmployee {
  return {
    category: "MEDIS",
    profession: null,
    workUnitId: "unit-1",
    jobGradeId: null,
    isActive: true,
    ...overrides,
  };
}

describe("calculateMedis", () => {
  it("computes proportional incentive per PRD 9.1 (Rawat Inap JKN 12%)", () => {
    const dr = employee({ id: "dr-1", category: "MEDIS" });
    const tx: EngineTransaction = {
      id: "tx-1",
      employeeId: "dr-1",
      workUnitId: "unit-1",
      serviceCategory: "RAWAT_INAP",
      penjaminanStatus: "JKN",
      serviceRole: "DPJP",
      tariffValue: 1_000_000,
    };
    const rules: EngineProportionRule[] = [
      { serviceCategory: "RAWAT_INAP", penjaminanStatus: "JKN", serviceRole: null, percentBp: 1200 },
    ];
    const rows = calculateMedis([dr], [tx], rules);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.grossAmount).toBe(120_000);
  });

  it("sums multiple transactions and ignores non-medis employees", () => {
    const dr = employee({ id: "dr-1", category: "MEDIS" });
    const nurse = employee({ id: "nurse-1", category: "KEPERAWATAN" });
    const rules: EngineProportionRule[] = [
      { serviceCategory: "RAWAT_JALAN", penjaminanStatus: "NON_JKN", serviceRole: null, percentBp: 6000 },
    ];
    const txs: EngineTransaction[] = [
      {
        id: "tx-1",
        employeeId: "dr-1",
        workUnitId: "unit-1",
        serviceCategory: "RAWAT_JALAN",
        penjaminanStatus: "NON_JKN",
        serviceRole: "DPJP",
        tariffValue: 500_000,
      },
      {
        id: "tx-2",
        employeeId: "dr-1",
        workUnitId: "unit-1",
        serviceCategory: "RAWAT_JALAN",
        penjaminanStatus: "NON_JKN",
        serviceRole: "DPJP",
        tariffValue: 300_000,
      },
      {
        id: "tx-3",
        employeeId: "nurse-1",
        workUnitId: "unit-1",
        serviceCategory: "RAWAT_JALAN",
        penjaminanStatus: "NON_JKN",
        serviceRole: "PERAWAT_PELAKSANA",
        tariffValue: 1_000_000,
      },
    ];
    const rows = calculateMedis([dr, nurse], txs, rules);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.employeeId).toBe("dr-1");
    expect(rows[0]!.grossAmount).toBe(480_000); // (500k+300k) * 60%
  });

  it("splits IBS roles (operator/co-operator/anestesi) using role-specific rates", () => {
    const operator = employee({ id: "op", category: "MEDIS" });
    const coOp = employee({ id: "coop", category: "MEDIS" });
    const anestesi = employee({ id: "anes", category: "MEDIS" });
    const rules: EngineProportionRule[] = [
      { serviceCategory: "IBS", penjaminanStatus: "JKN", serviceRole: "OPERATOR", percentBp: 1200 },
      { serviceCategory: "IBS", penjaminanStatus: "JKN", serviceRole: "CO_OPERATOR", percentBp: 700 },
      { serviceCategory: "IBS", penjaminanStatus: "JKN", serviceRole: "ANESTESI", percentBp: 450 },
    ];
    const tariff = 10_000_000;
    const txs: EngineTransaction[] = [
      { id: "1", employeeId: "op", workUnitId: "ibs", serviceCategory: "IBS", penjaminanStatus: "JKN", serviceRole: "OPERATOR", tariffValue: tariff },
      { id: "2", employeeId: "coop", workUnitId: "ibs", serviceCategory: "IBS", penjaminanStatus: "JKN", serviceRole: "CO_OPERATOR", tariffValue: tariff },
      { id: "3", employeeId: "anes", workUnitId: "ibs", serviceCategory: "IBS", penjaminanStatus: "JKN", serviceRole: "ANESTESI", tariffValue: tariff },
    ];
    const rows = calculateMedis([operator, coOp, anestesi], txs, rules);
    const byId = Object.fromEntries(rows.map((r) => [r.employeeId, r.grossAmount]));
    expect(byId["op"]).toBe(1_200_000);
    expect(byId["coop"]).toBe(700_000);
    expect(byId["anes"]).toBe(450_000);
  });
});

describe("calculateTimUnit", () => {
  it("distributes the unit pool proportionally to job grade weight", () => {
    const nurseA = employee({ id: "n-a", category: "KEPERAWATAN", workUnitId: "unit-1", jobGradeId: "grade-senior" });
    const nurseB = employee({ id: "n-b", category: "KEPERAWATAN", workUnitId: "unit-1", jobGradeId: "grade-junior" });
    const jobGrades: EngineJobGrade[] = [
      { id: "grade-senior", weightBp: 15000 },
      { id: "grade-junior", weightBp: 10000 },
    ];
    const rules: EngineProportionRule[] = [
      { serviceCategory: "RAWAT_INAP", penjaminanStatus: "JKN", serviceRole: null, percentBp: 1000 },
    ];
    const txs: EngineTransaction[] = [
      {
        id: "tx-1",
        employeeId: "n-a", // pooled regardless of which nakes is tagged on the transaction
        workUnitId: "unit-1",
        serviceCategory: "RAWAT_INAP",
        penjaminanStatus: "JKN",
        serviceRole: "PERAWAT_PELAKSANA",
        tariffValue: 10_000_000,
      },
    ];
    const rows = calculateTimUnit([nurseA, nurseB], txs, rules, jobGrades);
    const pool = 1_000_000; // 10% of 10,000,000
    const byId = Object.fromEntries(rows.map((r) => [r.employeeId, r.grossAmount]));
    expect(byId["n-a"]).toBe(Math.round((pool * 15000) / 25000));
    expect(byId["n-b"]).toBe(Math.round((pool * 10000) / 25000));
    expect(byId["n-a"]! + byId["n-b"]!).toBe(pool);
  });

  it("supports the porsi-tetap/porsi-subsidi split when enabled", () => {
    const nurseUnit1 = employee({ id: "n-1", category: "KEPERAWATAN", workUnitId: "unit-1" });
    const nurseUnit2 = employee({ id: "n-2", category: "KEPERAWATAN", workUnitId: "unit-2" });
    const rules: EngineProportionRule[] = [
      { serviceCategory: "RAWAT_INAP", penjaminanStatus: "JKN", serviceRole: null, percentBp: 10000 },
    ];
    const txs: EngineTransaction[] = [
      { id: "1", employeeId: "n-1", workUnitId: "unit-1", serviceCategory: "RAWAT_INAP", penjaminanStatus: "JKN", serviceRole: "PERAWAT_PELAKSANA", tariffValue: 1_000_000 },
    ];
    const rows = calculateTimUnit([nurseUnit1, nurseUnit2], txs, rules, [], {
      enabled: true,
      fixedPortionBp: 2000, // 20% porsi tetap, 80% porsi subsidi
    });
    const byId = Object.fromEntries(rows.map((r) => [r.employeeId, r.grossAmount]));
    // unit-1 keeps 20% fixed (200,000) entirely to itself (only nurse there);
    // the 80% subsidy (800,000) is redistributed hospital-wide -> split evenly (no job grade) between n-1 and n-2.
    expect(byId["n-1"]).toBe(200_000 + 400_000);
    expect(byId["n-2"]).toBe(400_000);
  });
});

describe("calculateIndexing", () => {
  it("allocates the administrasi pool by weighted composite score, with kehadiran 40% + kualitas 60%", () => {
    const admin1 = employee({ id: "a-1", category: "ADMINISTRASI" });
    const admin2 = employee({ id: "a-2", category: "ADMINISTRASI" });
    const weights = [
      { variable: "CAPAIAN_KINERJA" as const, weightBp: 10000, maxScore: 100 },
    ];
    const scores = [
      { employeeId: "a-1", variable: "CAPAIAN_KINERJA" as const, score: 0, attendanceScore: 100, qualityScore: 100 },
      { employeeId: "a-2", variable: "CAPAIAN_KINERJA" as const, score: 0, attendanceScore: 50, qualityScore: 50 },
    ];
    const rows = calculateIndexing([admin1, admin2], weights, scores, 300_000);
    const byId = Object.fromEntries(rows.map((r) => [r.employeeId, r.grossAmount]));
    // a-1 fraction = 1.0, a-2 fraction = 0.5 -> total 1.5 -> shares ~2/3 and ~1/3
    // (basis-point rounding means the two shares land a few rupiah off the
    // naive 200,000/100,000 split; what matters is they sum back to the pool).
    expect(byId["a-1"]).toBe(200_010);
    expect(byId["a-2"]).toBe(99_990);
    expect(byId["a-1"]! + byId["a-2"]!).toBe(300_000);
  });
});

describe("computeDeduction", () => {
  it("applies cuti >=1 bulan at 50% and reports the rule code", () => {
    const rules: EngineDeductionRule[] = [{ code: "CUTI_GE_1_BULAN", percentBp: 5000 }];
    const employeeDeductions: EngineEmployeeDeduction[] = [{ employeeId: "e-1", ruleCode: "CUTI_GE_1_BULAN" }];
    const result = computeDeduction("e-1", 1_000_000, rules, employeeDeductions);
    expect(result.amount).toBe(500_000);
    expect(result.ruleCodes).toEqual(["CUTI_GE_1_BULAN"]);
  });

  it("takes the harshest rule when multiple conditions apply, never stacking", () => {
    const rules: EngineDeductionRule[] = [
      { code: "CUTI_GE_1_BULAN", percentBp: 5000 },
      { code: "TUGAS_BELAJAR", percentBp: 8000 },
    ];
    const employeeDeductions: EngineEmployeeDeduction[] = [
      { employeeId: "e-1", ruleCode: "CUTI_GE_1_BULAN" },
      { employeeId: "e-1", ruleCode: "TUGAS_BELAJAR" },
    ];
    const result = computeDeduction("e-1", 1_000_000, rules, employeeDeductions);
    expect(result.amount).toBe(800_000);
    expect(result.percentBp).toBe(8000);
  });

  it("honours an explicit override percentage for disciplinary decrees", () => {
    const rules: EngineDeductionRule[] = [{ code: "PEMBINAAN_DISIPLIN", percentBp: 0 }];
    const employeeDeductions: EngineEmployeeDeduction[] = [
      { employeeId: "e-1", ruleCode: "PEMBINAAN_DISIPLIN", overridePercentBp: 3000 },
    ];
    const result = computeDeduction("e-1", 1_000_000, rules, employeeDeductions);
    expect(result.amount).toBe(300_000);
  });
});

describe("applyMinimumRequirement", () => {
  const minReqs: EngineMinimumRequirement[] = [{ professionKey: "Dokter Spesialis", minAmount: 5_000_000 }];

  it("raises the amount to the floor when below minimum", () => {
    const dr = employee({ id: "d-1", profession: "Dokter Spesialis" });
    const result = applyMinimumRequirement(dr, 3_000_000, minReqs);
    expect(result.applied).toBe(true);
    expect(result.flooredAmount).toBe(5_000_000);
  });

  it("leaves the amount untouched when already above minimum", () => {
    const dr = employee({ id: "d-1", profession: "Dokter Spesialis" });
    const result = applyMinimumRequirement(dr, 8_000_000, minReqs);
    expect(result.applied).toBe(false);
    expect(result.flooredAmount).toBe(8_000_000);
  });

  it("is a no-op for professions with no configured minimum", () => {
    const nurse = employee({ id: "n-1", profession: "Perawat Terampil" });
    const result = applyMinimumRequirement(nurse, 100_000, minReqs);
    expect(result.applied).toBe(false);
    expect(result.flooredAmount).toBe(100_000);
  });
});

describe("computeAdjustmentFactorBp", () => {
  it("returns 100% when total is within pagu", () => {
    expect(computeAdjustmentFactorBp(900_000, 1_000_000)).toBe(10000);
  });

  it("scales down proportionally when total exceeds pagu", () => {
    expect(computeAdjustmentFactorBp(1_000_000, 800_000)).toBe(8000);
  });

  it("is a no-op when pagu is not configured", () => {
    expect(computeAdjustmentFactorBp(1_000_000, null)).toBe(10000);
  });
});

describe("runCalculationEngine (integration)", () => {
  function baseInput(overrides: Partial<CalculationEngineInput> = {}): CalculationEngineInput {
    return {
      employees: [],
      transactions: [],
      proportionRules: [],
      jobGrades: [],
      deductionRules: [],
      employeeDeductions: [],
      minimumRequirements: [],
      indexingWeights: [],
      performanceScores: [],
      administrasiAllocationAmount: 0,
      paguAmount: null,
      exemptMinimumFromAdjustment: false,
      ...overrides,
    };
  }

  it("produces netAmount equal to grossAmount when no deductions/floor/pagu apply", () => {
    const dr = employee({ id: "dr-1", category: "MEDIS" });
    const output = runCalculationEngine(
      baseInput({
        employees: [dr],
        transactions: [
          {
            id: "tx-1",
            employeeId: "dr-1",
            workUnitId: "unit-1",
            serviceCategory: "RAWAT_INAP",
            penjaminanStatus: "JKN",
            serviceRole: "DPJP",
            tariffValue: 1_000_000,
          },
        ],
        proportionRules: [{ serviceCategory: "RAWAT_INAP", penjaminanStatus: "JKN", serviceRole: null, percentBp: 1000 }],
      }),
    );
    expect(output.results).toHaveLength(1);
    expect(output.results[0]!.grossAmount).toBe(100_000);
    expect(output.results[0]!.netAmount).toBe(100_000);
    expect(output.results[0]!.adjustmentFactorBp).toBe(10000);
    expect(output.paguExceeded).toBe(false);
  });

  it("scales every recipient uniformly when the pagu is exceeded (default policy)", () => {
    const dr1 = employee({ id: "dr-1", category: "MEDIS" });
    const dr2 = employee({ id: "dr-2", category: "MEDIS" });
    const tx = (employeeId: string, id: string): EngineTransaction => ({
      id,
      employeeId,
      workUnitId: "unit-1",
      serviceCategory: "RAWAT_INAP",
      penjaminanStatus: "JKN",
      serviceRole: "DPJP",
      tariffValue: 10_000_000,
    });
    const output = runCalculationEngine(
      baseInput({
        employees: [dr1, dr2],
        transactions: [tx("dr-1", "tx-1"), tx("dr-2", "tx-2")],
        proportionRules: [{ serviceCategory: "RAWAT_INAP", penjaminanStatus: "JKN", serviceRole: null, percentBp: 1000 }],
        paguAmount: 1_500_000, // total gross would be 2,000,000
      }),
    );
    expect(output.totalBeforeAdjustment).toBe(2_000_000);
    expect(output.adjustmentFactorBp).toBe(7500); // 1,500,000 / 2,000,000
    expect(output.totalAfterAdjustment).toBe(1_500_000);
    for (const r of output.results) expect(r.netAmount).toBe(750_000);
  });

  it("exempts minimum-requirement earners from the pagu cut when configured", () => {
    const dr1 = employee({ id: "dr-1", category: "MEDIS", profession: "Dokter Spesialis" });
    const dr2 = employee({ id: "dr-2", category: "MEDIS" });
    const output = runCalculationEngine(
      baseInput({
        employees: [dr1, dr2],
        transactions: [
          { id: "tx-1", employeeId: "dr-1", workUnitId: "u", serviceCategory: "RAWAT_JALAN", penjaminanStatus: "JKN", serviceRole: "DPJP", tariffValue: 1_000_000 },
          { id: "tx-2", employeeId: "dr-2", workUnitId: "u", serviceCategory: "RAWAT_JALAN", penjaminanStatus: "JKN", serviceRole: "DPJP", tariffValue: 20_000_000 },
        ],
        proportionRules: [{ serviceCategory: "RAWAT_JALAN", penjaminanStatus: "JKN", serviceRole: null, percentBp: 1000 }],
        minimumRequirements: [{ professionKey: "Dokter Spesialis", minAmount: 5_000_000 }],
        paguAmount: 4_000_000, // less than dr-1's own floor
        exemptMinimumFromAdjustment: true,
      }),
    );
    const byId = Object.fromEntries(output.results.map((r) => [r.employeeId, r]));
    expect(byId["dr-1"]!.minimumRequirementApplied).toBe(true);
    expect(byId["dr-1"]!.netAmount).toBe(5_000_000); // untouched by the cut
    expect(byId["dr-2"]!.netAmount).toBe(0); // remainingPagu (4,000,000 - 5,000,000 -> floored at 0) leaves nothing
  });

  it("keeps the calculation deterministic and idempotent for the same input", () => {
    const input = baseInput({
      employees: [employee({ id: "dr-1", category: "MEDIS" })],
      transactions: [
        { id: "tx-1", employeeId: "dr-1", workUnitId: "u", serviceCategory: "IGD", penjaminanStatus: "NON_JKN", serviceRole: "DPJP", tariffValue: 733_333 },
      ],
      proportionRules: [{ serviceCategory: "IGD", penjaminanStatus: "NON_JKN", serviceRole: null, percentBp: 6500 }],
    });
    const a = runCalculationEngine(input);
    const b = runCalculationEngine(input);
    expect(a).toEqual(b);
  });
});
