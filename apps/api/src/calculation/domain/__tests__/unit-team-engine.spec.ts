import { calculateUnitTeam } from "../unit-team-engine";
import { EmployeeInput, ProportionKey, ServiceTransactionInput } from "../types";

describe("calculateUnitTeam", () => {
  const transactions: ServiceTransactionInput[] = [
    {
      id: "tx1",
      employeeId: "dpjp-1",
      workUnitId: "RAWAT_INAP",
      guaranteeStatus: "JKN",
      serviceRole: "DPJP",
      tariffAmount: 100_000_000,
    },
  ];

  const employees: EmployeeInput[] = [
    { id: "perawat-1", staffCategory: "KEPERAWATAN", workUnitId: "RAWAT_INAP", jobGradeWeight: 2, minimumRequirementLevel: null },
    { id: "perawat-2", staffCategory: "KEPERAWATAN", workUnitId: "RAWAT_INAP", jobGradeWeight: 1, minimumRequirementLevel: null },
  ];

  const resolveProportion = (key: ProportionKey) =>
    key.guaranteeStatus === "JKN" && key.serviceRole === "PELAKSANA" ? 10 : null;

  it("distributes the unit pool within the unit by job-grade weight when no subsidy config is given", () => {
    const result = calculateUnitTeam(transactions, employees, resolveProportion);
    // pool = 10% of 100M = 10,000,000; split 2:1 -> 6,666,666.67 / 3,333,333.33
    const byEmployee = Object.fromEntries(result.map((r) => [r.employeeId, r.grossAmount.toFixed(2)]));
    expect(byEmployee["perawat-1"]).toBe("6666666.67");
    expect(byEmployee["perawat-2"]).toBe("3333333.33");
  });

  it("redistributes the subsidy portion hospital-wide by weight across units", () => {
    const employeesTwoUnits: EmployeeInput[] = [
      { id: "perawat-1", staffCategory: "KEPERAWATAN", workUnitId: "RAWAT_INAP", jobGradeWeight: 1, minimumRequirementLevel: null },
      { id: "perawat-2", staffCategory: "KEPERAWATAN", workUnitId: "IGD", jobGradeWeight: 1, minimumRequirementLevel: null },
    ];
    const txTwoUnits: ServiceTransactionInput[] = [
      {
        id: "tx1",
        employeeId: "dpjp-1",
        workUnitId: "RAWAT_INAP",
        guaranteeStatus: "JKN",
        serviceRole: "DPJP",
        tariffAmount: 100_000_000,
      },
    ];
    // Only RAWAT_INAP has revenue; IGD has none. With a 20% fixed / 80%
    // subsidy split, RAWAT_INAP's employee still gets a share of the
    // hospital-wide subsidy pool, and so does the IGD employee who
    // generated no revenue this period but is part of the subsidy pool.
    const result = calculateUnitTeam(txTwoUnits, employeesTwoUnits, resolveProportion, {
      fixedPortionPercent: 20,
    });
    const byEmployee = Object.fromEntries(result.map((r) => [r.employeeId, r.grossAmount.toString()]));
    // pool = 10,000,000; fixed = 2,000,000 (all to perawat-1, sole RAWAT_INAP staff)
    // subsidy = 8,000,000 split 1:1 across both employees = 4,000,000 each
    expect(byEmployee["perawat-1"]).toBe("6000000");
    expect(byEmployee["perawat-2"]).toBe("4000000");
  });

  it("returns no results when there are no eligible KEPERAWATAN/NAKES_LAIN employees", () => {
    const medisOnly: EmployeeInput[] = [
      { id: "dr-1", staffCategory: "MEDIS", workUnitId: "RAWAT_INAP", jobGradeWeight: null, minimumRequirementLevel: null },
    ];
    expect(calculateUnitTeam(transactions, medisOnly, resolveProportion)).toEqual([]);
  });
});
