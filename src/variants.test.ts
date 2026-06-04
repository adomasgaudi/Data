import { describe, it, expect } from "vitest";
import { parseLevelNote, attachNoteLevel, levelLabel, levelKey, defaultLevelScale } from "./variants";
import type { SetRecord } from "./domain";

const rec = (notes: string, exerciseName = "Push Ups"): SetRecord => ({
  user: "U", username: "u", date: "2025-01-01", bodyweight: 80,
  exerciseName, setNumber: 1, weight: null, reps: 11, notes, dropset: false, percentile: null,
});

describe("parseLevelNote", () => {
  it("reads the SQ hole in the formats the owner logs", () => {
    const cases: [string, number][] = [
      ["SQ8", 8], ["sq3", 3], ["Sq 5", 5], ["SQ13", 13], ["SQ-1", -1],
      ["SQ -1", -1], ["SQ 1", 1], ["Squat rack 6", 6], ["Sq13", 13],
    ];
    for (const [note, value] of cases) {
      const v = parseLevelNote(note);
      expect(v, note).not.toBeNull();
      expect(v!.value).toBe(value);
      expect(v!.label).toBe(`SQ${value}`);
    }
  });

  it("finds the hole inside a longer note", () => {
    expect(parseLevelNote("SQ8 felt easy")!.value).toBe(8);
    expect(parseLevelNote("Dipsai ant sq 9")!.value).toBe(9);
  });

  it("returns null when there is no recognised level", () => {
    expect(parseLevelNote("")).toBeNull();
    expect(parseLevelNote("felt strong")).toBeNull();
    expect(parseLevelNote("Squat rack po 2")).toBeNull(); // "po" intervenes
    expect(parseLevelNote("3 reps left")).toBeNull(); // a bare number with no unit
  });
});

describe("attachNoteLevel", () => {
  it("attaches the level WITHOUT renaming the exercise, and peels the tag off the note", () => {
    const out = attachNoteLevel(rec("SQ8 felt easy"));
    expect(out.exerciseName).toBe("Push Ups"); // one exercise — name unchanged
    expect(out.levelDim).toBe("sq");
    expect(out.levelValue).toBe(8);
    expect(out.levelLabel).toBe("SQ8");
    expect(out.notes).toBe("felt easy");
  });

  it("leaves a bare hole note with an empty leftover note", () => {
    const out = attachNoteLevel(rec("SQ8"));
    expect(out.levelValue).toBe(8);
    expect(out.notes).toBe("");
  });

  it("is a no-op without a hole, or when a level is already set", () => {
    expect(attachNoteLevel(rec("felt strong")).levelDim).toBeUndefined();
    const pre = { ...rec("SQ8"), levelDim: "sq" as const, levelValue: 3, levelLabel: "SQ3" };
    expect(attachNoteLevel(pre).levelValue).toBe(3); // not overwritten
  });
});

describe("level scaling helpers", () => {
  it("labels and keys a hole stably", () => {
    expect(levelLabel("sq", 8)).toBe("SQ8");
    expect(levelLabel("cm", 43)).toBe("43cm");
    expect(levelKey("Push Ups", "sq", 8)).toBe("Push Ups|sq|8");
    expect(levelKey("Dips", "cm", 43)).toBe("Dips|cm|43");
  });

  it("seeds a higher hole as easier (scaled down), the floor as the ×1 reference", () => {
    expect(defaultLevelScale("sq", 0)).toBe(1); // hole 0 = reference
    expect(defaultLevelScale("sq", 8)).toBeLessThan(defaultLevelScale("sq", 1)); // higher = easier = smaller
    expect(defaultLevelScale("sq", -1)).toBeGreaterThan(defaultLevelScale("sq", 1)); // lower = harder = bigger
    expect(defaultLevelScale("sq", 20)).toBeGreaterThanOrEqual(0.1); // clamped
    expect(defaultLevelScale("sq", -40)).toBeLessThanOrEqual(3); // clamped
    expect(defaultLevelScale("cm", 43)).toBe(1); // cm is ambiguous → neutral default
  });

  it("reads a centimetre note into a cm level and tags it", () => {
    expect(parseLevelNote("43cm")).toEqual(expect.objectContaining({ dim: "cm", value: 43, label: "43cm" }));
    expect(parseLevelNote("Pakelta 10 cm")).toEqual(expect.objectContaining({ dim: "cm", value: 10 }));
    const out = attachNoteLevel(rec("43cm low"));
    expect(out.levelDim).toBe("cm");
    expect(out.levelValue).toBe(43);
    expect(out.levelLabel).toBe("43cm");
    expect(out.notes).toBe("low");
  });
});
