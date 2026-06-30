import { describe, it, expect } from "vitest";
import { resolveEquip, type Equipment, type EquipSettings } from "./equipment";

const legacy: EquipSettings = { kgBase: 20, divisor: 2, assisted: true };
const reg: Record<string, Equipment> = {
  cable: { id: "cable", name: "Cable stack", kgBase: 5, divisor: 3, assisted: true },
  bar: { id: "bar", name: "Barbell", kgBase: 0, divisor: 2, assisted: false },
};

describe("resolveEquip (stamp → registry → default)", () => {
  it("uses the registry entry's settings when the id is present and known", () => {
    expect(resolveEquip("cable", reg, legacy)).toEqual({ kgBase: 5, divisor: 3, assisted: true });
    expect(resolveEquip("bar", reg, legacy)).toEqual({ kgBase: 0, divisor: 2, assisted: false });
  });
  it("falls back to the default (legacy per-exercise) settings when there is no id", () => {
    expect(resolveEquip(null, reg, legacy)).toBe(legacy);
    expect(resolveEquip(undefined, reg, legacy)).toBe(legacy);
    expect(resolveEquip("", reg, legacy)).toBe(legacy);
  });
  it("falls back to the default when the id is unknown (e.g. a deleted machine) — never throws", () => {
    expect(resolveEquip("ghost", reg, legacy)).toBe(legacy);
    expect(resolveEquip("cable", {}, legacy)).toBe(legacy);
  });
  it("returns a fresh object for a registry hit (so callers can't mutate the stored Equipment)", () => {
    const out = resolveEquip("cable", reg, legacy);
    out.kgBase = 999;
    expect(reg.cable!.kgBase).toBe(5);
  });
  it("the stamped/current id is what matters — two different ids resolve independently", () => {
    // An OLD set (no stamp) keeps the default even if the CURRENT choice moved to "cable":
    expect(resolveEquip(null, reg, legacy)).toBe(legacy); // old set
    expect(resolveEquip("cable", reg, legacy)).toEqual({ kgBase: 5, divisor: 3, assisted: true }); // new stamped set
  });
});
