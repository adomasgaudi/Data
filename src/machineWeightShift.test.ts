import { describe, it, expect } from "vitest";
import { adjustedSetWeight, machineWeightDelta } from "./machineWeightShift";

describe("machineWeightShift", () => {
  it("machineWeightDelta is new minus old", () => {
    expect(machineWeightDelta(0, 20)).toBe(20);
    expect(machineWeightDelta(20, 0)).toBe(-20);
    expect(machineWeightDelta(10, 25)).toBe(15);
  });

  it("keep leaves logged weight unchanged", () => {
    expect(adjustedSetWeight(50, 20, "keep")).toBe(50);
  });

  it("shift subtracts the base delta (pin-only fix when base is added)", () => {
    expect(adjustedSetWeight(50, 20, "shift")).toBe(30);
    expect(adjustedSetWeight(30, -20, "shift")).toBe(50);
  });
});
