import { calculateMedicalStaff } from "../medical-staff-engine";
import { ProportionKey } from "../types";

describe("calculateMedicalStaff", () => {
  const resolveProportion = (key: ProportionKey) => {
    const table: Record<string, number> = {
      "IGD|JKN|PELAKSANA": 0,
      "IGD|NON_JKN|DPJP": 60,
      "IBS|JKN|OPERATOR": 12,
      "IBS|JKN|CO_OPERATOR": 6,
      "IBS|JKN|ANESTESI": 4,
    };
    const k = `${key.workUnitId}|${key.guaranteeStatus}|${key.serviceRole}`;
    return table[k] ?? null;
  };

  it("sums proportional amounts per employee across multiple transactions and roles", () => {
    const result = calculateMedicalStaff(
      [
        {
          id: "tx1",
          employeeId: "dr-a",
          workUnitId: "IBS",
          guaranteeStatus: "JKN",
          serviceRole: "OPERATOR",
          tariffAmount: 10_000_000,
        },
        {
          id: "tx2",
          employeeId: "dr-a",
          workUnitId: "IBS",
          guaranteeStatus: "JKN",
          serviceRole: "OPERATOR",
          tariffAmount: 5_000_000,
        },
        {
          id: "tx3",
          employeeId: "dr-b",
          workUnitId: "IBS",
          guaranteeStatus: "JKN",
          serviceRole: "CO_OPERATOR",
          tariffAmount: 10_000_000,
        },
        {
          id: "tx4",
          employeeId: "dr-c",
          workUnitId: "IGD",
          guaranteeStatus: "NON_JKN",
          serviceRole: "DPJP",
          tariffAmount: 1_000_000,
        },
      ],
      resolveProportion,
    );

    const byEmployee = Object.fromEntries(result.map((r) => [r.employeeId, r.grossAmount.toString()]));

    // dr-a: 12% of (10M + 5M) = 1,800,000
    expect(byEmployee["dr-a"]).toBe("1800000");
    // dr-b: 6% of 10M = 600,000
    expect(byEmployee["dr-b"]).toBe("600000");
    // dr-c: 60% of 1M = 600,000
    expect(byEmployee["dr-c"]).toBe("600000");
  });

  it("excludes line items with no configured proportion scheme instead of throwing", () => {
    const result = calculateMedicalStaff(
      [
        {
          id: "tx1",
          employeeId: "dr-a",
          workUnitId: "UNKNOWN_UNIT",
          guaranteeStatus: "JKN",
          serviceRole: "DPJP",
          tariffAmount: 1_000_000,
        },
      ],
      () => null,
    );
    expect(result[0].grossAmount.toString()).toBe("0");
    expect(result[0].lineItems).toHaveLength(0);
  });

  it("handles an employee whose transactions span two different units within the same period (mid-period transfer)", () => {
    const resolve = (key: ProportionKey) => (key.workUnitId === "IGD" ? 10 : 20);
    const result = calculateMedicalStaff(
      [
        {
          id: "tx1",
          employeeId: "dr-a",
          workUnitId: "IGD",
          guaranteeStatus: "JKN",
          serviceRole: "DPJP",
          tariffAmount: 1_000_000,
        },
        {
          id: "tx2",
          employeeId: "dr-a",
          workUnitId: "RAWAT_JALAN",
          guaranteeStatus: "JKN",
          serviceRole: "DPJP",
          tariffAmount: 1_000_000,
        },
      ],
      resolve,
    );
    // 10% of 1M (IGD) + 20% of 1M (Rawat Jalan) = 300,000 — each line uses
    // the proportion for the unit it was actually rendered in, so a mid-
    // period transfer is handled correctly without any special-casing.
    expect(result[0].grossAmount.toString()).toBe("300000");
  });
});
