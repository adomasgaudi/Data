import { describe, it, expect } from "vitest";
import { parseLevelNote, attachNoteLevel, levelLabel, levelKey, defaultLevelScale, levelInclineCm, inclineScale, isInclineLevelExercise } from "./variants";
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

describe("Smith-notch + cm incline (push-up family)", () => {
  it("reads a Smith-machine notch in the owner's spellings", () => {
    for (const [note, value] of [["Smith 3", 3], ["smith4", 4], ["3 smith", 3]] as [string, number][]) {
      const v = parseLevelNote(note);
      expect(v, note).not.toBeNull();
      expect(v!.dim).toBe("smith");
      expect(v!.value).toBe(value);
      expect(v!.label).toBe(`Sm${value}`);
    }
  });

  it("also reads '3 sq' (number-first squat-rack hole)", () => {
    expect(parseLevelNote("3 sq")).toEqual(expect.objectContaining({ dim: "sq", value: 3 }));
  });

  it("reads the owner's LOOSE incline spellings as a Smith notch (Ant N / N level / N lygis / bare)", () => {
    const cases: [string, number][] = [
      ["Ant 2", 2], ["3 level", 3], ["Level 5.666", 5.5], ["3 lygis", 3],
      ["4.5 level", 4.5], ["5", 5], ["3 lygis su dviem pakopom", 3],
    ];
    for (const [note, value] of cases) {
      const v = parseLevelNote(note);
      expect(v, note).not.toBeNull();
      expect(v!.dim, note).toBe("smith");
      expect(v!.value, note).toBe(value);
    }
    // "ant kelių" (on the KNEES) has no number → not a notch; it's the position variation.
    expect(parseLevelNote("ant kelių")).toBeNull();
    expect(parseLevelNote("from knees")).toBeNull();
  });

  it("keeps loose incline notes ONLY on the push-up family (peeling the tag)", () => {
    const out = attachNoteLevel(rec("Ant 2 su pakopa", "Smith Machine Incline Close Grip Push Up"));
    expect(out.levelDim).toBe("smith");
    expect(out.levelValue).toBe(2);
    expect(out.notes).toBe("su pakopa");
    // An HSPU "5 lygis" ladder note must NOT be hijacked as a Smith incline level.
    expect(attachNoteLevel(rec("5 lygis", "Handstand Push Ups")).levelDim).toBeUndefined();
  });

  it("keeps a Smith level only on the push-up family", () => {
    expect(attachNoteLevel(rec("Smith 3", "Smith Machine Incline Close Grip Push Up")).levelDim).toBe("smith");
    expect(attachNoteLevel(rec("Smith 3", "Smith Machine Squat")).levelDim).toBeUndefined(); // not a push-up
  });

  it("converts cm / sq / smith levels onto one cm incline (~15cm per step)", () => {
    expect(levelInclineCm("cm", 20)).toBe(20);
    expect(levelInclineCm("sq", 3)).toBe(45);
    expect(levelInclineCm("smith", 3)).toBe(45);
    expect(levelInclineCm("smith", 2, 10)).toBe(20); // tunable step
  });

  it("scales incline so a floor push-up is hardest (×1) and higher is easier", () => {
    expect(inclineScale(0)).toBe(1); // 0cm = pure push-up = reference
    expect(inclineScale(45)).toBeLessThan(1); // raised hands = easier
    expect(inclineScale(75)).toBeLessThan(inclineScale(45)); // higher still = easier still
    expect(inclineScale(-10)).toBeGreaterThan(1); // below the floor = harder
    expect(inclineScale(500)).toBeGreaterThanOrEqual(0.4); // clamped
  });

  it("knows which exercises are incline (push-up family)", () => {
    expect(isInclineLevelExercise("Smith Machine Incline Close Grip Push Up")).toBe(true);
    expect(isInclineLevelExercise("Push Ups")).toBe(true);
    expect(isInclineLevelExercise("Squat")).toBe(false);
  });
});
