import { applyPaguAdjustment } from "../pagu-adjustment";

describe("applyPaguAdjustment", () => {
  const results = [
    { employeeId: "e1", netAmount: 6_000_000 },
    { employeeId: "e2", netAmount: 4_000_000 },
  ];

  it("leaves amounts unchanged when total is within the budget cap", () => {
    const summary = applyPaguAdjustment(results, 20_000_000);
    expect(summary.adjustmentFactor.toString()).toBe("1");
    expect(summary.results.find((r) => r.employeeId === "e1")!.netAmount.toString()).toBe("6000000");
  });

  it("leaves amounts unchanged when no budget cap is configured", () => {
    const summary = applyPaguAdjustment(results, null);
    expect(summary.adjustmentFactor.toString()).toBe("1");
  });

  it("proportionally cuts every recipient by the same factor when total exceeds the cap", () => {
    const summary = applyPaguAdjustment(results, 5_000_000);
    // factor = 5,000,000 / 10,000,000 = 0.5
    expect(summary.adjustmentFactor.toString()).toBe("0.5");
    const e1 = summary.results.find((r) => r.employeeId === "e1")!;
    const e2 = summary.results.find((r) => r.employeeId === "e2")!;
    expect(e1.netAmount.toString()).toBe("3000000");
    expect(e2.netAmount.toString()).toBe("2000000");
    // total after adjustment must not exceed the cap
    expect(e1.netAmount.plus(e2.netAmount).lte(5_000_000)).toBe(true);
  });

  it("rounds each employee's adjusted amount to the nearest whole rupiah", () => {
    const summary = applyPaguAdjustment(
      [
        { employeeId: "e1", netAmount: 1_000_000 },
        { employeeId: "e2", netAmount: 1_000_000 },
        { employeeId: "e3", netAmount: 1_000_000 },
      ],
      2_000_000,
    );
    for (const r of summary.results) {
      expect(r.netAmount.isInteger()).toBe(true);
    }
  });
});
