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
  distinctUsers,
  exerciseCountsForUser,
  setsForUserExercise,
  workoutsForUser,
  workoutsWithRestDays,
  weeksForUser,
  setsByWeek,
  weeklySetStats,
  exerciseProgressForUser,
  exerciseProgressByWeek,
  addedWeight1RM,
  scaleToGroup,
  nearDuplicateExercises,
  canonicalizeExerciseNames,
  sameExerciseKey,
  athleteSummary,
} from "./aggregate";
import { epley1RM } from "./metrics";

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
        fc.integer({ min: 1, max: 20 }),
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

  it("subtracts the whole body load on a bodyweight-only set (origWeight null)", () => {
    // 30 bodyweight squats: effective load 72 (all body), no added weight logged.
    // Body load (72) must be peeled off, and reps are capped at 15, so the answer
    // is a modest "could add ~36 kg" — not a ~190 kg phantom max.
    const r = rec({ weight: 72, origWeight: null, reps: 30 });
    const got = addedWeight1RM(r, "epley")!;
    expect(got).toBeCloseTo(72 * (1 + 15 / 30) - 72, 6); // = 36
    expect(got).toBeLessThan(60);
  });

  it("caps reps so a huge-rep set can't inflate the 1RM", () => {
    const capped = rec({ weight: 100, reps: 40 }); // bar-only, 40 reps
    const at15 = rec({ weight: 100, reps: 15 });
    expect(addedWeight1RM(capped, "epley")).toBeCloseTo(addedWeight1RM(at15, "epley")!, 6);
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
