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

  it("returns null when there is no hole", () => {
    expect(parseLevelNote("")).toBeNull();
    expect(parseLevelNote("felt strong")).toBeNull();
    expect(parseLevelNote("Squat rack po 2")).toBeNull(); // "po" intervenes
    expect(parseLevelNote("10cm")).toBeNull();
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
    expect(levelLabel(8)).toBe("SQ8");
    expect(levelKey("Push Ups", 8)).toBe("Push Ups|sq|8");
  });

  it("seeds a higher hole as easier (scaled down), the floor as the ×1 reference", () => {
    expect(defaultLevelScale(0)).toBe(1); // hole 0 = reference
    expect(defaultLevelScale(8)).toBeLessThan(defaultLevelScale(1)); // higher = easier = smaller
    expect(defaultLevelScale(-1)).toBeGreaterThan(defaultLevelScale(1)); // lower = harder = bigger
    expect(defaultLevelScale(20)).toBeGreaterThanOrEqual(0.1); // clamped
    expect(defaultLevelScale(-40)).toBeLessThanOrEqual(3); // clamped
  });
});
