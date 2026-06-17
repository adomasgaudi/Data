import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { SetRecord } from "./domain";
import {
  maxBy,
  filterRecords,
  sortRecords,
  leaderboard,
  personalRecords,
  bestSet,
  distinctExercises,
  selectableExercises,
  distinctUsers,
  exerciseCountsForUser,
  setsForUserExercise,
  workoutsForUser,
  workoutsWithRestDays,
  weeksForUser,
  periodStartOf,
  periodsForUser,
  periodsWithRest,
  setsByWeek,
  weeklySetStats,
  exerciseProgressForUser,
  exerciseProgressByWeek,
  addedWeight1RM,
  scaleToGroup,
  withSyntheticGroups,
  buildActiveExerciseSet,
  nearDuplicateExercises,
  canonicalizeExerciseNames,
  sameExerciseKey,
  athleteSummary,
  decayedStrengthSeries,
} from "./aggregate";
import { epley1RM, strengthRetention } from "./metrics";

/** Minimal record factory for readable fixtures. */
function rec(p: Partial<SetRecord>): SetRecord {
  return {
    user: "User",
    username: "user",
    date: "2024-01-01",
    bodyweight: 80,
    exerciseName: "Bench Press",
    setNumber: 1,
    weight: 100,
    reps: 1,
    notes: "",
    dropset: false,
    percentile: 50,
    ...p,
  };
}

// A small, fully hand-verifiable dataset.
const FIXTURE: SetRecord[] = [
  rec({ user: "Ada", username: "ada", exerciseName: "Bench Press", weight: 100, reps: 1, date: "2024-01-01" }),
  rec({ user: "Ada", username: "ada", exerciseName: "Bench Press", weight: 90, reps: 5, date: "2024-02-01" }), // e1rm 105
  rec({ user: "Bob", username: "bob", exerciseName: "Bench Press", weight: 110, reps: 1, date: "2024-01-15" }),
  rec({ user: "Bob", username: "bob", exerciseName: "Squat", weight: 150, reps: 3, date: "2024-01-20" }), // e1rm 165
  rec({ user: "Ada", username: "ada", exerciseName: "Squat", weight: 140, reps: 1, date: "2024-03-01" }),
];

describe("addedWeight1RM", () => {
  it("equals the plain 1RM for a bar-only lift (no bodyweight share)", () => {
    // origWeight undefined ⇒ bodyweightLoad 0 ⇒ same as estimate1RM.
    const r = rec({ weight: 100, reps: 5 });
    expect(addedWeight1RM(r, "epley")).toBeCloseTo(epley1RM(100, 5)!, 6);
  });

  it("peels the bodyweight share back off for a bodyweight lift", () => {
    // Squat: effective load 200 (= 60 bodyweight share + 140 bar), 3 reps.
    // effective 1RM = 200 × (1 + 3/30) = 220; added-weight 1RM = 220 − 60 = 160.
    const r = rec({ weight: 200, origWeight: 140, reps: 3 });
    expect(addedWeight1RM(r, "epley")).toBeCloseTo(160, 6);
  });

  it("never falls below the added weight actually lifted", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 300, noNaN: true }), // added (bar) weight
        fc.double({ min: 0, max: 120, noNaN: true }), // bodyweight share
        fc.integer({ min: 1, max: 15 }), // within the rep cap (above it there's no 1RM)
        (added, bwLoad, reps) => {
          const r = rec({ weight: added + bwLoad, origWeight: added, reps });
          return addedWeight1RM(r, "epley")! >= added - 1e-9;
        },
      ),
    );
  });

  it("a single rep returns exactly the added weight", () => {
    const r = rec({ weight: 200, origWeight: 140, reps: 1 });
    expect(addedWeight1RM(r, "epley")).toBeCloseTo(140, 6);
  });

  it("returns a value at the cap but null just above it (no clamped estimate)", () => {
    // Exactly at the cap (15) still estimates; above it there's no reliable 1RM.
    expect(addedWeight1RM(rec({ weight: 100, reps: 15 }), "epley")).not.toBeNull();
    expect(addedWeight1RM(rec({ weight: 72, origWeight: null, reps: 30 }), "epley")).toBeNull();
  });

  it("caps Epley/Brzycki above the rep cap, but Nuzzo works the full study range", () => {
    // Epley/Brzycki extrapolate absurdly at high reps → no value above the cap.
    expect(addedWeight1RM(rec({ weight: 100, reps: 40 }), "epley")).toBeNull();
    expect(addedWeight1RM(rec({ weight: 100, reps: 16 }), "brzycki")).toBeNull();
    // Nuzzo is data-derived down to 15% of 1RM, so it estimates at any rep count.
    const nz = addedWeight1RM(rec({ weight: 100, reps: 40 }), "nuzzo");
    expect(nz).not.toBeNull();
    expect(nz!).toBeGreaterThan(100); // a 1RM is never below the weight lifted
  });

  it("excludes isometric holds (seconds-as-reps) from the 1RM", () => {
    expect(addedWeight1RM(rec({ exerciseName: "Deadlift hold", weight: 120, reps: 16 }))).toBeNull();
    expect(addedWeight1RM(rec({ exerciseName: "Pull-up hold", weight: 40, reps: 10 }))).toBeNull();
    expect(addedWeight1RM(rec({ exerciseName: "Bent over row hold", weight: 110, reps: 8 }))).toBeNull();
    // a normal deadlift still estimates fine
    expect(addedWeight1RM(rec({ exerciseName: "Deadlift", weight: 120, reps: 5 }))!).toBeGreaterThan(120);
  });
});

describe("athleteSummary", () => {
  it("rolls up sessions, sets, volume, span and bodyweight change", () => {
    const recs = [
      rec({ username: "ada", date: "2024-01-01", weight: 100, reps: 5, bodyweight: 70 }), // vol 500
      rec({ username: "ada", date: "2024-01-01", weight: 50, reps: 10, bodyweight: 70 }), // vol 500, same day
      rec({ username: "ada", date: "2024-01-15", weight: 100, reps: 3, bodyweight: 72 }), // vol 300
      rec({ username: "bob", date: "2024-01-10", weight: 200, reps: 1, bodyweight: 90 }), // other athlete
    ];
    const s = athleteSummary(recs, "ada");
    expect(s.sessions).toBe(2);
    expect(s.sets).toBe(3);
    expect(s.totalVolume).toBe(1300);
    expect(s.firstDate).toBe("2024-01-01");
    expect(s.lastDate).toBe("2024-01-15");
    expect(s.bodyweightFirst).toBe(70);
    expect(s.bodyweightLast).toBe(72);
    expect(s.sessionsPerWeek).toBeGreaterThan(0);
  });
  it("is empty for an unknown athlete", () => {
    expect(athleteSummary([rec({ username: "ada" })], "nobody").sets).toBe(0);
  });
});

describe("nearDuplicateExercises", () => {
  it("clusters typo/casing/plural variants of the same name", () => {
    const recs = [
      rec({ exerciseName: "Ab curl" }),
      rec({ exerciseName: "Ab curls" }),
      rec({ exerciseName: "Ab Curls" }),
      rec({ exerciseName: "Stairs" }),
      rec({ exerciseName: "Stairss" }),
      rec({ exerciseName: "Bench Press" }), // unique → not flagged
    ];
    const dupes = nearDuplicateExercises(recs);
    const abc = dupes.find((d) => d.names.includes("Ab curl"));
    expect(abc?.names).toEqual(expect.arrayContaining(["Ab curl", "Ab curls", "Ab Curls"]));
    expect(dupes.some((d) => d.names.includes("Stairs") && d.names.includes("Stairss"))).toBe(true);
    expect(dupes.some((d) => d.names.includes("Bench Press"))).toBe(false);
  });
});

describe("sameExerciseKey", () => {
  it("folds casing, whitespace, punctuation, leading enumerator and trailing s", () => {
    expect(sameExerciseKey("Ab curls")).toBe(sameExerciseKey("Ab curl"));
    expect(sameExerciseKey("Ab Curls")).toBe(sameExerciseKey("Ab curl"));
    expect(sameExerciseKey("L-SIT")).toBe(sameExerciseKey("L sit"));
    expect(sameExerciseKey("Plate Lifts ")).toBe(sameExerciseKey("Plate lifts"));
    expect(sameExerciseKey("1 TRX hams curl")).toBe(sameExerciseKey("TRX hams curl"));
    expect(sameExerciseKey("Stairss")).toBe(sameExerciseKey("Stairs"));
  });

  it("keeps meaningful numbers distinct, but folds the Stairs 4 alias", () => {
    expect(sameExerciseKey("Leg 130")).not.toBe(sameExerciseKey("Leg 140"));
    expect(sameExerciseKey("Low wall climb 1")).not.toBe(sameExerciseKey("Low wall climb 2"));
    expect(sameExerciseKey("Stairs 4")).toBe(sameExerciseKey("Stairs")); // explicit alias
  });
});

describe("canonicalizeExerciseNames", () => {
  it("renames variants to the most-logged spelling and keeps the original", () => {
    const recs = [
      rec({ exerciseName: "Ab curls" }),
      rec({ exerciseName: "Ab curls" }),
      rec({ exerciseName: "Ab curl" }),
      rec({ exerciseName: "Leg 130" }),
      rec({ exerciseName: "Leg 140" }),
    ];
    const { records, merges } = canonicalizeExerciseNames(recs);
    // "Ab curls" is the most frequent spelling, so it becomes canonical.
    expect(records.filter((r) => r.exerciseName === "Ab curls")).toHaveLength(3);
    const renamed = records.find((r) => r.originalExerciseName === "Ab curl");
    expect(renamed?.exerciseName).toBe("Ab curls");
    // Distinct leg machine settings are left untouched.
    expect(records.some((r) => r.exerciseName === "Leg 130" && !r.originalExerciseName)).toBe(true);
    expect(records.some((r) => r.exerciseName === "Leg 140")).toBe(true);
    const abMerge = merges.find((m) => m.canonical === "Ab curls");
    expect(abMerge?.variants).toEqual(["Ab curl"]);
    expect(merges.some((m) => m.canonical.startsWith("Leg"))).toBe(false);
  });

  it("folds the Stairs 4 alias into Stairs", () => {
    const recs = [
      rec({ exerciseName: "Stairs" }),
      rec({ exerciseName: "Stairs" }),
      rec({ exerciseName: "Stairs 4" }),
    ];
    const { records } = canonicalizeExerciseNames(recs);
    expect(records.every((r) => r.exerciseName === "Stairs")).toBe(true);
    expect(records.find((r) => r.originalExerciseName === "Stairs 4")).toBeTruthy();
  });

  it("folds owner-confirmed Chin Ups → Pull Ups (and its spellings)", () => {
    const recs = [
      ...Array.from({ length: 5 }, () => rec({ exerciseName: "Pull Ups" })),
      rec({ exerciseName: "Chin Ups" }),
      rec({ exerciseName: "Chin up" }),
      rec({ exerciseName: "Chin ups" }),
      rec({ exerciseName: "One Arm Pull Ups" }), // a DIFFERENT lift — must stay separate
    ];
    const { records, merges } = canonicalizeExerciseNames(recs);
    // Pull Ups is most-logged, so every chin variant folds into it.
    expect(records.filter((r) => r.exerciseName === "Pull Ups")).toHaveLength(8);
    // The distinct one-arm variant is untouched.
    expect(records.some((r) => r.exerciseName === "One Arm Pull Ups" && !r.originalExerciseName)).toBe(true);
    const m = merges.find((x) => x.canonical === "Pull Ups");
    expect(m?.variants).toEqual(expect.arrayContaining(["Chin Ups", "Chin up", "Chin ups"]));
    expect(m?.variants).not.toContain("One Arm Pull Ups");
  });

  it("keeps Smith Machine Squat separate from Squat (combined only in the group)", () => {
    const recs = [
      ...Array.from({ length: 5 }, () => rec({ exerciseName: "Squat" })),
      rec({ exerciseName: "Smith Machine Squat" }),
      rec({ exerciseName: "Smith Machine Bulgarian Split Squat" }), // different lift — stays
      rec({ exerciseName: "Front Squat" }), // different lift — stays
    ];
    const { records, merges } = canonicalizeExerciseNames(recs);
    // Smith Machine Squat is NOT folded into Squat at the data level.
    expect(records.filter((r) => r.exerciseName === "Squat")).toHaveLength(5);
    expect(records.some((r) => r.exerciseName === "Smith Machine Squat")).toBe(true);
    expect(records.some((r) => r.exerciseName === "Smith Machine Bulgarian Split Squat")).toBe(true);
    expect(records.some((r) => r.exerciseName === "Front Squat")).toBe(true);
    expect(merges.some((x) => x.canonical === "Squat")).toBe(false);
  });
});

describe("scaleToGroup", () => {
  it("keeps only members, relabels them, and scales load by 1/quotient", () => {
    const recs = [
      rec({ exerciseName: "Deadlift", weight: 200, origWeight: 200, reps: 1 }),
      rec({ exerciseName: "Romanian Deadlift", weight: 140, origWeight: 140, reps: 1 }),
      rec({ exerciseName: "Bench Press", weight: 100, reps: 1 }), // not a member → dropped
    ];
    const out = scaleToGroup(recs, "Deadlift", { Deadlift: 1, "Romanian Deadlift": 0.7 });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.exerciseName === "Deadlift")).toBe(true);
    const rdl = out[1]!;
    expect(rdl.weight).toBeCloseTo(200, 6); // 140 / 0.7
    expect(rdl.origWeight).toBeCloseTo(200, 6);
  });

  it("makes an RDL's 1RM comparable to a deadlift's", () => {
    const [scaled] = scaleToGroup(
      [rec({ exerciseName: "Romanian Deadlift", weight: 140, origWeight: 140, reps: 1 })],
      "Deadlift",
      { "Romanian Deadlift": 0.7 },
    );
    // 140 at quotient 0.7 → a 200 deadlift-equivalent single.
    expect(addedWeight1RM(scaled!, "epley")).toBeCloseTo(200, 6);
  });

  it("remembers the source lift in originalExerciseName", () => {
    const [scaled] = scaleToGroup(
      [rec({ exerciseName: "Romanian Deadlift", weight: 140, reps: 1 })],
      "DL pattern",
      { "Romanian Deadlift": 0.8 },
    );
    expect(scaled!.exerciseName).toBe("DL pattern");
    expect(scaled!.originalExerciseName).toBe("Romanian Deadlift");
  });
});

describe("withSyntheticGroups", () => {
  const groups = [
    { id: "combine.sq-mix", derivedName: "SQ mix", members: { Squat: 1, "Smith Machine Squat": 1 } },
    { id: "compare.dl-pattern", derivedName: "DL pattern", members: { Deadlift: 1, "Romanian Deadlift": 0.8 } },
  ];

  it("emits only the new synthetic records, tagged with their group id", () => {
    const computed = [
      rec({ exerciseName: "Squat", weight: 200, origWeight: 140, reps: 1 }),
      rec({ exerciseName: "Smith Machine Squat", weight: 190, origWeight: 130, reps: 1 }),
      rec({ exerciseName: "Deadlift", weight: 200, origWeight: 200, reps: 1 }),
      rec({ exerciseName: "Romanian Deadlift", weight: 160, origWeight: 160, reps: 1 }),
      rec({ exerciseName: "Bench Press", weight: 100, reps: 1 }), // in no group → ignored
    ];
    const synth = withSyntheticGroups(computed, groups);
    // 2 squat members + 2 deadlift members = 4 synthetic records, none from bench.
    expect(synth).toHaveLength(4);
    expect(synth.every((r) => !!r.syntheticGroupId)).toBe(true);
    expect(synth.filter((r) => r.exerciseName === "SQ mix")).toHaveLength(2);
    expect(synth.filter((r) => r.exerciseName === "DL pattern")).toHaveLength(2);
  });

  it("leaves the pure source records untouched", () => {
    const computed = [rec({ exerciseName: "Deadlift", weight: 200, origWeight: 200, reps: 1 })];
    const before = structuredClone(computed);
    withSyntheticGroups(computed, groups);
    expect(computed).toEqual(before); // inputs not mutated
  });

  it("combinable members keep their load (ratio 1); comparable members are scaled", () => {
    const computed = [
      rec({ exerciseName: "Smith Machine Squat", weight: 190, origWeight: 130, reps: 1 }),
      rec({ exerciseName: "Romanian Deadlift", weight: 160, origWeight: 160, reps: 1 }),
    ];
    const synth = withSyntheticGroups(computed, groups);
    const smith = synth.find((r) => r.originalExerciseName === "Smith Machine Squat")!;
    expect(smith.weight).toBeCloseTo(190, 6); // ratio 1 → unchanged
    const rdl = synth.find((r) => r.originalExerciseName === "Romanian Deadlift")!;
    expect(rdl.weight).toBeCloseTo(200, 6); // 160 / 0.8 → 200 deadlift-equivalent
    expect(addedWeight1RM(rdl, "epley")).toBeCloseTo(200, 6); // 1RM scales cleanly
  });
});

describe("buildActiveExerciseSet", () => {
  const TIERS = [
    { tier: "S", min: 25 },
    { tier: "A", min: 15 },
    { tier: "B", min: 8 },
    { tier: "C", min: 3 },
    { tier: "D", min: 1 },
  ];
  // 10x Squat, 9x Bench (both tier B), 2x Curl (tier D), 1x Plank (tier D).
  const recs = [
    ...Array.from({ length: 10 }, () => rec({ exerciseName: "Squat" })),
    ...Array.from({ length: 9 }, () => rec({ exerciseName: "Bench Press" })),
    ...Array.from({ length: 2 }, () => rec({ exerciseName: "Barbell Curl" })),
    rec({ exerciseName: "Plank" }),
  ];

  it("with no cutoff and no overrides, everything is active", () => {
    const set = buildActiveExerciseSet(recs, null, [], [], TIERS);
    expect(set).toEqual(new Set(["Squat", "Bench Press", "Barbell Curl", "Plank"]));
  });

  it("a tier cutoff keeps only exercises at/above that set count", () => {
    const set = buildActiveExerciseSet(recs, "B", [], [], TIERS); // B = 8+ sets
    expect(set.has("Squat")).toBe(true); // 10
    expect(set.has("Bench Press")).toBe(true); // 9
    expect(set.has("Barbell Curl")).toBe(false); // 2 → below B
    expect(set.has("Plank")).toBe(false); // 1 → below B
  });

  it("an exclude override removes an otherwise-passing exercise", () => {
    const set = buildActiveExerciseSet(recs, "B", [], ["Bench Press"], TIERS);
    expect(set.has("Squat")).toBe(true);
    expect(set.has("Bench Press")).toBe(false); // forced out despite passing
  });

  it("an include override keeps a below-cutoff exercise", () => {
    const set = buildActiveExerciseSet(recs, "B", ["Plank"], [], TIERS);
    expect(set.has("Plank")).toBe(true); // forced in despite 1 set
  });

  it("exclude wins over include for the same exercise", () => {
    const set = buildActiveExerciseSet(recs, null, ["Squat"], ["Squat"], TIERS);
    expect(set.has("Squat")).toBe(false);
  });

  it("judges combinable members individually (a rare member drops out)", () => {
    // Squat is a staple (10), Smith Machine Squat is rare (1) — only Squat passes B.
    const r2 = [...recs, rec({ exerciseName: "Smith Machine Squat" })];
    const set = buildActiveExerciseSet(r2, "B", [], [], TIERS);
    expect(set.has("Squat")).toBe(true);
    expect(set.has("Smith Machine Squat")).toBe(false);
  });
});

describe("maxBy", () => {
  it("finds the element maximizing the selector", () => {
    expect(maxBy([1, 5, 3], (x) => x)).toBe(5);
  });
  it("ignores null-valued elements and returns null when none qualify", () => {
    expect(maxBy([1, 2], () => null)).toBeNull();
  });
  it("returns null for an empty list", () => {
    expect(maxBy([], (x: number) => x)).toBeNull();
  });
  it("is consistent with the array maximum (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1 }), (xs) => {
        expect(maxBy(xs, (x) => x)).toBe(Math.max(...xs));
      }),
    );
  });
});

describe("filterRecords", () => {
  it("filters by username and exercise", () => {
    const out = filterRecords(FIXTURE, { usernames: ["ada"], exercises: ["Bench Press"] });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.username === "ada" && r.exerciseName === "Bench Press")).toBe(true);
  });
  it("filters by inclusive date range", () => {
    const out = filterRecords(FIXTURE, { dateFrom: "2024-01-15", dateTo: "2024-02-01" });
    expect(out.map((r) => r.date).sort()).toEqual(["2024-01-15", "2024-01-20", "2024-02-01"]);
  });
  it("empty criteria returns everything", () => {
    expect(filterRecords(FIXTURE, {})).toHaveLength(FIXTURE.length);
  });
});

describe("filter/max commute (the key correctness invariant)", () => {
  it("max over a filtered subset == filter then max", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ex: fc.constantFrom("A", "B", "C"),
            w: fc.double({ min: 1, max: 300, noNaN: true }),
            r: fc.integer({ min: 1, max: 20 }),
          }),
        ),
        fc.constantFrom("A", "B", "C"),
        (rows, ex) => {
          const records = rows.map((x) => rec({ exerciseName: x.ex, weight: x.w, reps: x.r }));
          const viaFilter = bestSet(filterRecords(records, { exercises: [ex] }));
          const manual = bestSet(records.filter((r) => r.exerciseName === ex));
          expect(viaFilter?.e1rm ?? null).toBe(manual?.e1rm ?? null);
        },
      ),
    );
  });
});

describe("sortRecords", () => {
  it("is a permutation of the input (no rows lost or duplicated)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ w: fc.double({ min: 0, max: 300, noNaN: true }), r: fc.integer({ min: 1, max: 20 }) })),
        fc.constantFrom("asc" as const, "desc" as const),
        (rows, dir) => {
          const records = rows.map((x, i) => rec({ weight: x.w, reps: x.r, setNumber: i }));
          const sorted = sortRecords(records, "e1rm", dir);
          expect(sorted).toHaveLength(records.length);
          expect([...sorted].sort((a, b) => a.setNumber - b.setNumber)).toEqual(
            [...records].sort((a, b) => a.setNumber - b.setNumber),
          );
        },
      ),
    );
  });
  it("orders by weight descending with nulls last", () => {
    const records = [rec({ weight: 50 }), rec({ weight: null }), rec({ weight: 80 })];
    expect(sortRecords(records, "weight", "desc").map((r) => r.weight)).toEqual([80, 50, null]);
  });
});

describe("bestSet", () => {
  it("picks the highest estimated 1RM, not the heaviest weight", () => {
    // 90x5 (e1rm 105) beats 100x1 (e1rm 100)
    const best = bestSet(FIXTURE.filter((r) => r.username === "ada" && r.exerciseName === "Bench Press"));
    expect(best?.record.weight).toBe(90);
    expect(best?.e1rm).toBeCloseTo(105, 6);
  });

  it("ignores above-cap sets (no 1RM) when choosing the best", () => {
    // A heavy-looking 100×30 set is above the rep cap → no 1RM, so the 90×5
    // (e1rm 105) set must win rather than the capped one being clamped in.
    const sets = [
      rec({ exerciseName: "Bench Press", weight: 100, reps: 30 }), // above cap → excluded
      rec({ exerciseName: "Bench Press", weight: 90, reps: 5 }), // e1rm 105
    ];
    const best = bestSet(sets, "epley");
    expect(best?.record.reps).toBe(5);
    expect(best?.e1rm).toBeCloseTo(105, 6);
  });

  it("is null when every set is above the rep cap", () => {
    const sets = [rec({ exerciseName: "Squat", weight: 60, reps: 40 }), rec({ exerciseName: "Squat", weight: 50, reps: 25 })];
    expect(bestSet(sets, "epley")).toBeNull();
  });
});

describe("leaderboard", () => {
  it("ranks each user's best by estimated 1RM, high to low", () => {
    const lb = leaderboard(FIXTURE, "Bench Press");
    expect(lb.map((e) => e.username)).toEqual(["bob", "ada"]); // bob 110 > ada 105
    expect(lb[0]!.e1rm).toBeCloseTo(110, 6);
    expect(lb[1]!.e1rm).toBeCloseTo(105, 6);
  });
  it("entry e1rm dominates every set the user logged for that exercise", () => {
    const lb = leaderboard(FIXTURE, "Bench Press");
    for (const entry of lb) {
      const userSets = FIXTURE.filter((r) => r.username === entry.username && r.exerciseName === "Bench Press");
      for (const s of userSets) expect(entry.e1rm + 1e-9).toBeGreaterThanOrEqual(epley1RM(s.weight, s.reps)!);
    }
  });

  it("drops a user whose only set for the exercise is above the rep cap", () => {
    const recs = [
      rec({ user: "Ada", username: "ada", exerciseName: "Squat", weight: 100, reps: 3 }),
      rec({ user: "Bob", username: "bob", exerciseName: "Squat", weight: 80, reps: 40 }), // above cap → no 1RM
    ];
    const lb = leaderboard(recs, "Squat", "epley");
    expect(lb.map((e) => e.username)).toEqual(["ada"]); // bob excluded, not clamped in
  });
});

describe("personalRecords", () => {
  it("reports heaviest weight and best e1rm per user/exercise", () => {
    const prs = personalRecords(FIXTURE);
    const adaBench = prs.find((p) => p.username === "ada" && p.exerciseName === "Bench Press")!;
    expect(adaBench.topWeight.weight).toBe(100); // heaviest single
    expect(adaBench.bestE1rm.e1rm).toBeCloseTo(105, 6); // best estimate (90x5)
  });
});

describe("distinct helpers", () => {
  it("lists unique exercises, most popular first", () => {
    expect(distinctExercises(FIXTURE)).toEqual(["Bench Press", "Squat"]); // Bench 3 > Squat 2
  });
  it("orders by instance count, not alphabetically", () => {
    const recs = [
      rec({ exerciseName: "Zercher" }),
      rec({ exerciseName: "Zercher" }),
      rec({ exerciseName: "Ab Wheel" }),
    ];
    // "Ab Wheel" is first alphabetically but has fewer sets, so it ranks below.
    expect(distinctExercises(recs)).toEqual(["Zercher", "Ab Wheel"]);
  });
  it("lists unique users with labels", () => {
    expect(distinctUsers(FIXTURE)).toEqual([
      { username: "ada", user: "Ada" },
      { username: "bob", user: "Bob" },
    ]);
  });
  it("counts one athlete's exercises by sets, most-performed first", () => {
    // Ada: Bench Press x2, Squat x1; Bob's rows must be ignored.
    expect(exerciseCountsForUser(FIXTURE, "ada")).toEqual([
      { exerciseName: "Bench Press", count: 2 },
      { exerciseName: "Squat", count: 1 },
    ]);
  });
  it("returns one athlete's sets for one exercise, newest first", () => {
    const sets = setsForUserExercise(FIXTURE, "ada", "Bench Press");
    expect(sets.map((s) => s.date)).toEqual(["2024-02-01", "2024-01-01"]);
    expect(sets.every((s) => s.username === "ada" && s.exerciseName === "Bench Press")).toBe(true);
  });
  it("groups an athlete's sets into workout days, newest first", () => {
    const days = workoutsForUser(FIXTURE, "ada");
    expect(days.map((d) => d.date)).toEqual(["2024-03-01", "2024-02-01", "2024-01-01"]);
    expect(days.every((d) => d.totalSets === 1)).toBe(true);
    expect(days[0]!.exercises).toEqual([{ exerciseName: "Squat", count: 1 }]);
  });
  it("fills gaps with empty rest days between first and last workout", () => {
    const days = workoutsWithRestDays(workoutsForUser(FIXTURE, "ada"));
    expect(days.length).toBe(61); // 2024-01-01 .. 2024-03-01 inclusive (leap Feb)
    expect(days[0]!.date).toBe("2024-03-01");
    expect(days[days.length - 1]!.date).toBe("2024-01-01");
    expect(days.find((d) => d.date === "2024-02-01")!.totalSets).toBe(1);
    const rest = days.find((d) => d.date === "2024-01-02")!;
    expect(rest.totalSets).toBe(0);
    expect(rest.exercises).toEqual([]);
  });
  it("groups one athlete's training by week (Monday), newest first", () => {
    const weeks = weeksForUser(FIXTURE, "ada");
    expect(weeks.map((w) => w.weekStart)).toEqual(["2024-02-26", "2024-01-29", "2024-01-01"]);
    expect(weeks.every((w) => w.totalSets === 1)).toBe(true);
    expect(weeks[2]!.exercises).toEqual([{ exerciseName: "Bench Press", count: 1 }]);
  });
  it("groups a list of sets into weeks, newest week first", () => {
    const sets = setsForUserExercise(FIXTURE, "ada", "Bench Press"); // 2024-02-01, 2024-01-01
    const weeks = setsByWeek(sets);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2024-01-29", "2024-01-01"]);
    expect(weeks[0]!.sets[0]!.date).toBe("2024-02-01");
  });
  it("builds an exercise time series oldest-first with best e1RM per day", () => {
    const series = exerciseProgressForUser(FIXTURE, "ada", "Bench Press", "epley");
    expect(series.map((p) => p.date)).toEqual(["2024-01-01", "2024-02-01"]);
    expect(series[0]).toEqual({ date: "2024-01-01", sets: 1, bestE1rm: 100 }); // 100x1
    expect(series[1]!.bestE1rm).toBeCloseTo(105, 6); // 90x5 → Epley 105
  });
  it("rolls the daily series up into Monday-start weeks, oldest first", () => {
    // ada's two bench dates fall in different weeks, so they stay separate.
    const series = exerciseProgressByWeek(FIXTURE, "ada", "Bench Press", "epley");
    expect(series.map((p) => p.date)).toEqual(["2024-01-01", "2024-01-29"]); // the two Mondays
    expect(series[0]).toEqual({ date: "2024-01-01", sets: 1, bestE1rm: 100 });
    expect(series[1]!.bestE1rm).toBeCloseTo(105, 6);
  });
  it("sums all of a week's sets and keeps that week's best e1RM", () => {
    // Three bench days inside one Mon–Sun week (2024-01-01 .. 2024-01-07).
    const sets: SetRecord[] = [
      rec({ username: "ada", exerciseName: "Bench Press", weight: 80, reps: 1, date: "2024-01-01" }), // 80
      rec({ username: "ada", exerciseName: "Bench Press", weight: 100, reps: 1, date: "2024-01-03", setNumber: 2 }), // 100 (best)
      rec({ username: "ada", exerciseName: "Bench Press", weight: 90, reps: 1, date: "2024-01-07", setNumber: 3 }), // 90
    ];
    const series = exerciseProgressByWeek(sets, "ada", "Bench Press", "epley");
    expect(series).toEqual([{ date: "2024-01-01", sets: 3, bestE1rm: 100 }]);
  });
});

describe("weeklySetStats", () => {
  // 9 sets in one March week (the peak) + 4 sets in the week of "today".
  const TODAY = "2026-06-01";
  const SETS: SetRecord[] = [
    ...Array.from({ length: 9 }, (_, i) => rec({ date: "2026-03-10", setNumber: i + 1 })),
    ...Array.from({ length: 4 }, (_, i) => rec({ date: TODAY, setNumber: i + 1 })),
  ];

  it("returns all zeros for an empty log", () => {
    expect(weeklySetStats([], TODAY)).toEqual({
      peakPerWeek: 0,
      thisWeek: 0,
      monthAvgPerWeek: 0,
      threeMonthAvgPerWeek: 0,
    });
  });

  it("finds the busiest week and counts the current week", () => {
    const s = weeklySetStats(SETS, TODAY);
    expect(s.peakPerWeek).toBe(9); // the March week
    expect(s.thisWeek).toBe(4); // the four sets dated today
  });

  it("averages sets per week over the trailing 30 / 90 day windows", () => {
    const s = weeklySetStats(SETS, TODAY);
    // 30-day window only catches the 4 recent sets: 4 ÷ (30/7) ≈ 0.9.
    expect(s.monthAvgPerWeek).toBeCloseTo(0.9, 6);
    // 90-day window catches all 13 sets: 13 ÷ (90/7) ≈ 1.0.
    expect(s.threeMonthAvgPerWeek).toBeCloseTo(1.0, 6);
  });
});

describe("bestSet detraining decay (asOf)", () => {
  // An old monster single vs a solid recent one. Without decay the old PR wins;
  // with decay (asOf today) the year-old lift fades and the fresh one takes over.
  const oldPr = rec({ exerciseName: "Squat", weight: 200, reps: 1, date: "2024-01-01", bodyweight: 80 });
  const recent = rec({ exerciseName: "Squat", weight: 150, reps: 1, date: "2025-01-01", bodyweight: 80 });

  it("ignores age when no asOf date is given (all-time peak)", () => {
    const best = bestSet([oldPr, recent], "epley");
    expect(best?.record.weight).toBe(200);
    expect(best?.e1rm).toBeCloseTo(200, 6);
  });

  it("fades old lifts so a fresh set can win, and reports the decayed value", () => {
    // "Today" is right after the recent set: the old PR is ~a year stale.
    const best = bestSet([oldPr, recent], "epley", "2025-01-05");
    expect(best?.record.weight).toBe(150); // the recent, barely-decayed set
    expect(best?.e1rm).toBeLessThan(200); // and below the all-time peak
    expect(best?.e1rm).toBeGreaterThan(140); // still near its fresh value
  });

  it("never exceeds the all-time peak once decay is on", () => {
    const peak = bestSet([oldPr, recent], "epley")!.e1rm;
    const current = bestSet([oldPr, recent], "epley", "2025-06-01")!.e1rm;
    expect(current).toBeLessThanOrEqual(peak + 1e-9);
  });
});

describe("decayedStrengthSeries (the chart 'Current strength' line)", () => {
  const DAY = 86_400_000;
  const base = Date.parse("2024-01-01");
  const at = (d: number) => base + d * DAY;

  it("sags during a layoff: a lone peak fades below itself by the end", () => {
    // One 100 kg peak on day 0, no training since; 'today' is day 200.
    const line = decayedStrengthSeries([{ x: at(0), y: 100 }], at(200));
    const last = line[line.length - 1]!;
    expect(last.x).toBe(at(200)); // extended to today
    expect(last.y).toBeLessThan(100); // it dipped
    // And by exactly the model's amount (within rounding).
    expect(last.y).toBeCloseTo(100 * strengthRetention(200), 1);
  });

  it("holds flat through the 2-week grace, then strictly declines", () => {
    const line = decayedStrengthSeries([{ x: at(0), y: 100 }], at(120), 2);
    const yAt = (d: number) => line.find((p) => p.x === at(d))?.y;
    expect(yAt(0)).toBe(100);
    expect(yAt(14)).toBe(100); // grace: nothing lost yet
    expect(yAt(44)!).toBeLessThan(100); // a month past grace: down ~10%
    expect(yAt(44)!).toBeCloseTo(90, 0);
    // Monotonic non-increasing across the whole single-peak line.
    for (let i = 1; i < line.length; i++) {
      expect(line[i]!.y).toBeLessThanOrEqual(line[i - 1]!.y + 1e-9);
    }
  });

  it("pops back up on the next training day after a long gap", () => {
    // Peak 100 on day 0, then a fresh 95 set on day 100 (well past grace).
    const line = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(100), y: 95 }], at(140), 4);
    const justBefore = line.filter((p) => p.x < at(100)).pop()!;
    const onTrainingDay = line.find((p) => p.x === at(100))!;
    expect(justBefore.y).toBeLessThan(95); // sagged below the fresh set during the gap
    expect(onTrainingDay.y).toBeCloseTo(95, 1); // …then pops up to the fresh lift
    expect(onTrainingDay.y).toBeGreaterThan(justBefore.y); // a visible upward step
  });

  it("never shows more than the all-time peak", () => {
    const line = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(50), y: 80 }], at(300));
    for (const p of line) expect(p.y).toBeLessThanOrEqual(100 + 1e-9);
  });

  it("regular training holds strength flat — every set resets the clock, even light ones", () => {
    // Peak 100 on day 0, then a much lighter (50) set every 10 days for 200 days.
    // No gap ever exceeds the 2-week grace, so nothing should be lost.
    const pts = [{ x: at(0), y: 100 }];
    for (let d = 10; d <= 200; d += 10) pts.push({ x: at(d), y: 50 });
    const line = decayedStrengthSeries(pts, at(200), 4);
    for (const p of line) expect(p.y).toBeCloseTo(100, 1); // flat at 100 throughout
  });

  it("the MORE you train, the slower it fades — frequent light sets beat one long layoff", () => {
    // A) hit a 100 peak, then keep training a light 50 every 30 days for 180 days.
    const trained = [{ x: at(0), y: 100 }];
    for (let d = 30; d <= 180; d += 30) trained.push({ x: at(d), y: 50 });
    const aEnd = decayedStrengthSeries(trained, at(180)).at(-1)!.y;
    // B) hit the same peak once, then nothing for 180 days.
    const bEnd = decayedStrengthSeries([{ x: at(0), y: 100 }], at(180)).at(-1)!.y;
    // Training must keep MORE strength — each session makes the decay weaker, so
    // repeated training can never drop faster than idling (the old bug).
    expect(aEnd).toBeGreaterThan(bEnd);
  });

  it("a >2-week gap costs ~10%/month, then a light set restarts the clock (no further loss)", () => {
    // Peak 100 (day 0); nothing for 44 days (grace + a month) → ~10% lost; then a
    // light 60 set on day 44 and another on day 54. Training resets the timer, so
    // the second light set 10 days later holds the line flat (no extra decay).
    const line = decayedStrengthSeries(
      [{ x: at(0), y: 100 }, { x: at(44), y: 60 }, { x: at(54), y: 60 }],
      at(54),
      4,
    );
    const yAt = (d: number) => line.find((p) => p.x === at(d))?.y;
    expect(yAt(44)!).toBeCloseTo(90, 0); // ~10% lost over the gap
    expect(yAt(54)!).toBeCloseTo(90, 0); // light set 10 days later: held, not decayed further
  });

  it("is empty for no points", () => {
    expect(decayedStrengthSeries([], at(10))).toEqual([]);
  });

  // Adaptive mechanisms (A / B / C) — added with the RIR-confidence / rate-limit / calibration update

  it("A) a high-RIR set contributes less to the level than a near-failure set of the same weight", () => {
    // Both scenarios: peak 100 on day 0, gap to day 100, then a set showing e1rm=95.
    // RIR 0 (failure) → full credit; RIR 8 (very easy) → blended with decayed level.
    const lineHard = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(100), y: 95, rir: 0 }], at(100), 4);
    const lineEasy = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(100), y: 95, rir: 8 }], at(100), 4);
    const hardLevel = lineHard[lineHard.length - 1]!.y;
    const easyLevel = lineEasy[lineEasy.length - 1]!.y;
    // Hard set is trusted fully → level rises to the full 95.
    // Easy set is blended with decayed level (which is lower) → level is lower.
    expect(hardLevel).toBeGreaterThan(easyLevel);
  });

  it("A) without RIR info, the series matches a RIR-0 set of the same value (full confidence)", () => {
    // A set with no RIR behaves identically to a RIR-0 set (fully trusted).
    const noRir = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(100), y: 90 }], at(150), 4);
    const rir0 = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(100), y: 90, rir: 0 }], at(150), 4);
    expect(noRir).toEqual(rir0);
  });

  it("B) a single-session jump beyond 8% above the all-time peak is rate-limited", () => {
    // Peak 100 on day 0; after a long layoff, user shows an e1rm of 130 (30% jump).
    // Rate-limiting caps this at 108 (8% above 100), not 130.
    const line = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(90), y: 130, rir: 0 }], at(90), 4);
    const levelAfter = line[line.length - 1]!.y;
    expect(levelAfter).toBeLessThanOrEqual(100 * 1.08 + 0.1); // capped near 108
    expect(levelAfter).toBeGreaterThan(100); // but still higher than the old peak
  });

  it("B) a set WITHIN the all-time peak is NOT rate-limited", () => {
    // Peak 100; after a layoff user shows 95 — no rate-limiting needed.
    const line = decayedStrengthSeries([{ x: at(0), y: 100 }, { x: at(90), y: 95, rir: 0 }], at(90), 4);
    const levelAfter = line[line.length - 1]!.y;
    expect(levelAfter).toBeCloseTo(95, 1); // no cap — recovery to previous level is fine
  });

  it("C) a strength level maintained through a long gap calibrates stability upward → slower future decay", () => {
    // User peaked 100 on day 0, then maintained 96+ for 80 days (one set on day 80 shows 96 at RIR 2).
    // Stability should be updated to ≥ 80 days → future decay is slower than the base 30-day model.
    const withLongGap = decayedStrengthSeries(
      [{ x: at(0), y: 100 }, { x: at(80), y: 96, rir: 2 }],
      at(200), 4,
    );
    // Compare to a user with the same history but at a much shorter gap (no calibration triggered).
    const withShortGap = decayedStrengthSeries(
      [{ x: at(0), y: 100 }, { x: at(10), y: 96, rir: 2 }],
      at(200), 4,
    );
    const longEnd = withLongGap[withLongGap.length - 1]!.y;
    const shortEnd = withShortGap[withShortGap.length - 1]!.y;
    // After the same total time, the user with the calibrated long gap retains more strength.
    expect(longEnd).toBeGreaterThan(shortEnd);
  });

  it("C) a high-RIR set (> 4) does NOT trigger stability calibration even if strength appears maintained", () => {
    // RIR 8 is unreliable evidence; its observed ratio should not update stability.
    const withHighRir = decayedStrengthSeries(
      [{ x: at(0), y: 100 }, { x: at(80), y: 96, rir: 8 }],
      at(200), 4,
    );
    // Compare to a near-failure set (RIR 2) that does calibrate.
    const withLowRir = decayedStrengthSeries(
      [{ x: at(0), y: 100 }, { x: at(80), y: 96, rir: 2 }],
      at(200), 4,
    );
    const highRirEnd = withHighRir[withHighRir.length - 1]!.y;
    const lowRirEnd = withLowRir[withLowRir.length - 1]!.y;
    // Low-RIR triggers calibration → stability boosted → slower future decay → higher end value.
    expect(lowRirEnd).toBeGreaterThanOrEqual(highRirEnd);
  });
});

describe("originals stay selectable when variants/groups exist (TASK 11)", () => {
  const base = [
    rec({ username: "ada", exerciseName: "Pull Ups" }),
    rec({ username: "ada", exerciseName: "Pull Ups" }),
    rec({ username: "ada", exerciseName: "Assisted Pull Up" }),
    rec({ username: "ada", exerciseName: "Gravity Machine Pull Up" }),
  ];
  const groups = [
    { id: "combine.pulls", derivedName: "Pull mix", members: { "Pull Ups": 1, "Assisted Pull Up": 1 } },
  ];

  it("original and both variants all appear in the selector list", () => {
    const names = selectableExercises(base);
    expect(names).toEqual(
      expect.arrayContaining(["Pull Ups", "Assisted Pull Up", "Gravity Machine Pull Up"]),
    );
  });

  it("creating a combined group never removes an original, and the group is also selectable", () => {
    const withGroup = [...base, ...withSyntheticGroups(base, groups)];
    const before = selectableExercises(base);
    const after = new Set(selectableExercises(withGroup));
    for (const n of before) expect(after.has(n)).toBe(true); // every original/variant survives
    expect(after.has("Pull mix")).toBe(true); // …and the combined appears alongside them
  });

  it("the per-athlete selector keeps the original next to the variant", () => {
    const names = exerciseCountsForUser(base, "ada").map((c) => c.exerciseName);
    expect(names).toContain("Pull Ups");
    expect(names).toContain("Assisted Pull Up");
    expect(names).toContain("Gravity Machine Pull Up");
  });

  it("EXTRA_EXERCISES catalog lifts are selectable even with zero logged sets (PB-25)", () => {
    // "Knee Raise" is in EXTRA_EXERCISES but appears in no record here.
    expect(distinctExercises(base)).not.toContain("Knee Raise"); // record-derived: invisible
    expect(selectableExercises(base)).toContain("Knee Raise"); // catalog union: selectable
    // Appended last (0 sets = least-used), never displacing a logged lift.
    const names = selectableExercises(base);
    expect(names[0]).toBe("Pull Ups"); // most-logged still leads
    expect(names.indexOf("Knee Raise")).toBeGreaterThan(names.indexOf("Pull Ups"));
  });

  it("a catalog lift that gets logged is not duplicated (dedupe)", () => {
    const logged = [...base, rec({ username: "ada", exerciseName: "Knee Raise" })];
    const names = selectableExercises(logged);
    expect(names.filter((n) => n === "Knee Raise")).toHaveLength(1);
  });
});

describe("history periods", () => {
  const rec = (date: string): SetRecord => ({ username: "u", user: "U", exerciseName: "Squat", date, weight: 100, reps: 5, setNumber: 1 } as SetRecord);

  it("periodStartOf buckets by week/2-week (Monday) and month/quarter", () => {
    // 2025-06-04 is a Wednesday → its Monday is 2025-06-02.
    expect(periodStartOf("2025-06-04", "week")).toBe("2025-06-02");
    expect(periodStartOf("2025-06-04", "month")).toBe("2025-06-01");
    expect(periodStartOf("2025-06-04", "3month")).toBe("2025-04-01"); // Apr–Jun quarter
    expect(periodStartOf("2025-01-15", "3month")).toBe("2025-01-01");
    expect(periodStartOf("2025-11-15", "3month")).toBe("2025-10-01");
    // 2-week buckets: a block's start is idempotent, both its weeks share it, and
    // the following Monday starts the next block.
    const block = periodStartOf("2025-06-02", "2week"); // the 2-wk block containing this Monday
    expect(periodStartOf(block, "2week")).toBe(block); // idempotent (it IS a block start)
    expect(periodStartOf("2025-06-08", "2week")).toBe(block); // Sunday of the same week → same block
    expect(periodStartOf("2025-06-09", "2week")).not.toBe(block); // next Monday → next block
  });

  it("periodsForUser groups sets newest-first by month", () => {
    const got = periodsForUser([rec("2025-04-10"), rec("2025-06-02"), rec("2025-06-20")], "u", "month");
    expect(got.map((g) => g.periodStart)).toEqual(["2025-06-01", "2025-04-01"]);
    expect(got[0]!.totalSets).toBe(2); // two June sets
  });

  it("periodsForUser orders a bucket's sets by DATE then set number", () => {
    const mk = (date: string, setNumber: number): SetRecord =>
      ({ username: "u", user: "U", exerciseName: "Squat", date, weight: 100, reps: 5, setNumber } as SetRecord);
    // One June bucket: a Jun 20 set (#1) plus two Jun 2 sets (#1, #2). The earlier
    // day must come first regardless of set number (the old sort used set # only).
    const g = periodsForUser([mk("2025-06-20", 1), mk("2025-06-02", 1), mk("2025-06-02", 2)], "u", "month");
    expect(g[0]!.sets.map((s) => s.date)).toEqual(["2025-06-02", "2025-06-02", "2025-06-20"]);
    expect(g[0]!.sets.map((s) => s.setNumber)).toEqual([1, 2, 1]);
  });

  it("periodsWithRest fills the empty month between two active ones", () => {
    const active = periodsForUser([rec("2025-04-10"), rec("2025-06-20")], "u", "month");
    const filled = periodsWithRest(active, "month");
    expect(filled.map((g) => g.periodStart)).toEqual(["2025-06-01", "2025-05-01", "2025-04-01"]);
    expect(filled[1]!.totalSets).toBe(0); // May is an empty (rest) month
  });
});
