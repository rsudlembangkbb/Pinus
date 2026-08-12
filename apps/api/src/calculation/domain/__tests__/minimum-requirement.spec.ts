import { applyMinimumRequirement } from "../minimum-requirement";

const requirements = [
  { level: "DOKTER_SPESIALIS", minimumAmount: 15_000_000 },
  { level: "PERAWAT_MAHIR", minimumAmount: 5_000_000 },
];

describe("applyMinimumRequirement", () => {
  it("lifts net amount to the floor when below minimum", () => {
    const outcome = applyMinimumRequirement(10_000_000, "DOKTER_SPESIALIS", requirements);
    expect(outcome.applied).toBe(true);
    expect(outcome.netAmount.toString()).toBe("15000000");
  });

  it("leaves net amount unchanged when at or above minimum", () => {
    const outcome = applyMinimumRequirement(20_000_000, "DOKTER_SPESIALIS", requirements);
    expect(outcome.applied).toBe(false);
    expect(outcome.netAmount.toString()).toBe("20000000");
  });

  it("does nothing when the employee has no minimum requirement level", () => {
    const outcome = applyMinimumRequirement(1_000_000, null, requirements);
    expect(outcome.applied).toBe(false);
    expect(outcome.netAmount.toString()).toBe("1000000");
  });

  it("does nothing when the level has no configured requirement", () => {
    const outcome = applyMinimumRequirement(1_000_000, "DOKTER_UMUM", requirements);
    expect(outcome.applied).toBe(false);
    expect(outcome.netAmount.toString()).toBe("1000000");
  });
});
