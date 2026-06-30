import { describe, it, expect } from "vitest";
import { practicalityProfile, pairPracticalityScore, pairPracticalityHint } from "./practicality";

describe("practicalityProfile", () => {
  it("infers a portable Free profile for dumbbell lifts", () => {
    const p = practicalityProfile("DB Curl");
    expect(p.station).toBe("Free");
    expect(p.portable).toBe(true);
  });

  it("infers a heavy fixed Platform for deadlifts", () => {
    const p = practicalityProfile("Romanian Deadlift");
    expect(p.station).toBe("Platform");
    expect(p.setup).toBe("Heavy");
    expect(p.portable).toBe(false);
  });

  it("treats machines as fixed but no-setup", () => {
    const p = practicalityProfile("Leg Press");
    expect(p.station).toBe("Machine");
    expect(p.setup).toBe("None");
    expect(p.portable).toBe(false);
  });

  it("defaults an unknown name to the easy Free/None profile", () => {
    const p = practicalityProfile("Zercher Whatsit");
    expect(p.station).toBe("Free");
    expect(p.setup).toBe("None");
    expect(p.portable).toBe(true);
  });

  it("prefers a specific keyword over a generic one", () => {
    // "leg press" must win over the generic "press" — it's a machine, not a rack lift.
    expect(practicalityProfile("Leg Press").station).toBe("Machine");
  });
});

describe("pairPracticalityScore", () => {
  it("is symmetric", () => {
    expect(pairPracticalityScore("DB Curl", "Bench Press"))
      .toBe(pairPracticalityScore("Bench Press", "DB Curl"));
  });

  it("ranks two portable lifts as the MOST practical", () => {
    const twoDb = pairPracticalityScore("DB Curl", "DB Shrug");
    const dbAndBarbell = pairPracticalityScore("DB Curl", "Barbell Squat");
    const twoHeavy = pairPracticalityScore("Back Squat", "Deadlift");
    expect(twoDb).toBeLessThan(dbAndBarbell);
    expect(dbAndBarbell).toBeLessThan(twoHeavy);
  });

  it("needs only 1 station when either lift is portable", () => {
    // A portable DB lift can be carried to the fixed lift's spot → one station (×10),
    // even though the bench adds heavy-setup cost.
    const score = pairPracticalityScore("DB Curl", "Bench Press");
    expect(score).toBeLessThan(20); // < the 2-station floor
  });

  it("needs 2 stations for two different fixed lifts", () => {
    const score = pairPracticalityScore("Leg Press", "Lat Pulldown");
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it("collapses two same-station fixed lifts to one station", () => {
    // Two cable lifts share the cable station → 1, cheaper than two different machines.
    expect(pairPracticalityScore("Cable Fly", "Cable Row"))
      .toBeLessThan(pairPracticalityScore("Leg Press", "Lat Pulldown"));
  });
});

describe("pairPracticalityHint", () => {
  it("describes a 1-station portable pair", () => {
    expect(pairPracticalityHint("DB Curl", "DB Shrug")).toBe("1 station");
  });
  it("flags heavy setup and 2 stations", () => {
    expect(pairPracticalityHint("Back Squat", "Deadlift")).toBe("2 stations · heavy setup");
  });
});
