import { describe, it, expect } from "vitest";
import { bodyComposition, combinableGroupsFor, comparableGroupsFor, COMPARABLE_GROUPS, defaultBwCoeff, EXERCISE_REGISTRY, exerciseCategories, exerciseCategory, exerciseCode, exerciseCodesFor, exercisesForTag, exerciseTier, FUNCTIONAL_PATTERN_TAGS, isAssistablePullup, LIST_CATEGORIES, MUSCLE_GROUP_TAGS, muscleGroup, realPullupWeight, tagsForExercise } from "./profile";

describe("defaultBwCoeff", () => {
  it("gives high-leverage holds a small coefficient (added weight dominates)", () => {
    expect(defaultBwCoeff("Front Lever")).toBe(0.1);
    expect(defaultBwCoeff("Front lever tuck raise")).toBe(0.1);
    expect(defaultBwCoeff("Tuck planche")).toBe(0.1);
    expect(defaultBwCoeff("Human flag")).toBe(0.1);
    expect(defaultBwCoeff("Dragon flag")).toBe(0.15);
    expect(defaultBwCoeff("Leg raise straight 85cm")).toBe(0.1);
    expect(defaultBwCoeff("Hanging Leg Raise")).toBe(0.15);
  });

  it("treats a front-lever row as a front lever, not a row", () => {
    expect(defaultBwCoeff("Front lever row old")).toBe(0.1);
    expect(defaultBwCoeff("Bent Over Row")).toBe(0); // a real row is pure load
  });

  it("scores bodyweight pulling/pushing near full bodyweight", () => {
    expect(defaultBwCoeff("Pull Ups")).toBe(0.95);
    expect(defaultBwCoeff("Chin Ups")).toBe(0.95);
    expect(defaultBwCoeff("Muscle Ups")).toBe(1);
    expect(defaultBwCoeff("Dips")).toBe(0.9);
    expect(defaultBwCoeff("Handstand Push Ups")).toBe(0.9);
    expect(defaultBwCoeff("Push Ups")).toBe(0.65);
  });

  it("distinguishes machine/seated variants from standing bodyweight ones", () => {
    expect(defaultBwCoeff("Seated Dip Machine")).toBe(0); // sits, no bodyweight
    expect(defaultBwCoeff("Triceps Dip (Assisted)")).toBe(0.5);
    expect(defaultBwCoeff("Seated Calf Raise")).toBe(0);
    expect(defaultBwCoeff("Machine Calf Raise")).toBe(0.9);
    expect(defaultBwCoeff("Machine Back Extension")).toBe(0);
    expect(defaultBwCoeff("Back Extension")).toBe(0.4);
  });

  it("scores weighted leg work by how much bodyweight moves", () => {
    expect(defaultBwCoeff("Squat")).toBe(0.6);
    expect(defaultBwCoeff("Smith Machine Squat")).toBe(0.6);
    expect(defaultBwCoeff("Pistol Squat")).toBe(0.85);
    expect(defaultBwCoeff("Bulgarian Split Squat")).toBe(0.7);
    expect(defaultBwCoeff("Deadlift")).toBe(0.3);
    expect(defaultBwCoeff("Romanian Deadlift")).toBe(0.3);
    expect(defaultBwCoeff("Hip Thrust")).toBe(0.2);
  });

  it("returns 0 for pure-load isolation and non-lifts", () => {
    expect(defaultBwCoeff("Bench Press")).toBe(0);
    expect(defaultBwCoeff("Lat Pulldown")).toBe(0);
    expect(defaultBwCoeff("Barbell Curl")).toBe(0);
    expect(defaultBwCoeff("Sled Leg Press")).toBe(0);
    expect(defaultBwCoeff("Cold shower")).toBe(0);
    expect(defaultBwCoeff("Stretch split")).toBe(0);
  });
});

describe("exerciseTier (main / second)", () => {
  it("tags the owner's core compound lifts as main, across spelling variants", () => {
    for (const name of [
      "Squat", "Deadlift", "Smith Machine Squat", "Romanian Deadlift", "RDL",
      "Bench Press", "Dumbbell Bench Press", "Shoulder Press", "Dumbbell Shoulder Press",
      "Push Ups", "Push-Up", "Pull Ups", "Pullup", "Chin Ups", "Lat Pulldown",
    ])
      expect(exerciseTier(name)).toBe("main");
  });

  it("leaves accessory/isolation strength work as second", () => {
    for (const name of [
      "Front Squat", "Hack Squat", "Incline Bench Press", "Seated Shoulder Press",
      "Lat Pullover", "Bicep Curl", "Leg Press", "Plank",
    ])
      expect(exerciseTier(name)).toBe("second");
  });

  it("puts non-strength work (cardio, mobility, warm-ups) in the third tier", () => {
    for (const name of ["Treadmill Run", "Assault Bike", "Ski Erg", "Sled Push"])
      expect(exerciseTier(name)).toBe("third"); // cardio / calorie / conditioning
    for (const name of ["Hamstring Stretch", "Ankle Mobility", "Pancake Stretch"])
      expect(exerciseTier(name)).toBe("third"); // mobility
    expect(exerciseTier("Warm-up Cycle")).toBe("third");
  });
});

describe("exerciseCode (uppercase core + lowercase modifier prefix)", () => {
  it("gives bare movement cores in uppercase", () => {
    expect(exerciseCode("Squat")).toBe("SQ");
    expect(exerciseCode("Deadlift")).toBe("DL");
    expect(exerciseCode("Bench Press")).toBe("BP");
    expect(exerciseCode("Chest Press")).toBe("CP");
    expect(exerciseCode("Romanian Deadlift")).toBe("RDL");
  });

  it("prefixes the equipment/variant in lowercase", () => {
    expect(exerciseCode("Dumbbell Bench Press")).toBe("dBP"); // d = dumbbell
    expect(exerciseCode("Front Squat")).toBe("fSQ"); // f = front
    expect(exerciseCode("Hex Bar Deadlift")).toBe("hDL"); // h = hex bar
  });

  it("honours the owner's explicit sumo exception", () => {
    expect(exerciseCode("Sumo Deadlift")).toBe("S-DL");
  });

  it("uses the single-dumbbell prefix and stacks where it makes sense", () => {
    // "Single Dumbbell Cossack Squat": sd prefix + SQ core.
    expect(exerciseCode("Single Dumbbell Cossack Squat")).toBe("sdSQ");
  });

  it("falls back to initials when there is no recognised movement core", () => {
    expect(exerciseCode("Cable Crossover")).toBe("CCA"); // C + C, pad 'a' from Cable
  });

  it("makes a set of codes unique with a numeric suffix on collision", () => {
    // Two distinct names that derive the same base code get 'X', 'X2', …
    const codes = exerciseCodesFor(["Bench Press", "Barbell Bench Press"]);
    const vals = [...codes.values()];
    expect(new Set(vals).size).toBe(vals.length); // all unique
    expect(codes.get("Bench Press")).toBe("BP");
  });
});

describe("bodyComposition (FFMI / nFFMI)", () => {
  it("computes lean mass, FFMI and the height-normalised nFFMI", () => {
    // 80 kg, 180 cm, 20% fat → lean 64 kg, height 1.8 m → FFMI = 64 / 3.24.
    const c = bodyComposition({ height: 180, weight: 80, bodyFat: 0.2 })!;
    expect(c).not.toBeNull();
    expect(c.leanMass).toBeCloseTo(64, 6);
    expect(c.ffmi).toBeCloseTo(64 / (1.8 * 1.8), 4);
    // At exactly 1.8 m the normalisation term is 0, so nFFMI === FFMI.
    expect(c.nffmi).toBeCloseTo(c.ffmi, 6);
  });

  it("adds the +6.1×(1.8−h) term so shorter lifters are scaled up", () => {
    const short = bodyComposition({ height: 160, weight: 60, bodyFat: 0.2 })!;
    expect(short.nffmi).toBeCloseTo(short.ffmi + 6.1 * (1.8 - 1.6), 6);
    expect(short.nffmi).toBeGreaterThan(short.ffmi);
  });

  it("returns null for impossible inputs", () => {
    expect(bodyComposition({ height: 0, weight: 80, bodyFat: 0.2 })).toBeNull();
    expect(bodyComposition({ height: 180, weight: 0, bodyFat: 0.2 })).toBeNull();
    expect(bodyComposition({ height: 180, weight: 80, bodyFat: 1 })).toBeNull();
    expect(bodyComposition({ height: 180, weight: 80, bodyFat: -0.1 })).toBeNull();
  });
});

describe("exerciseCategory", () => {
  it("classifies the main muscle groups", () => {
    expect(exerciseCategory("Squat")).toBe("Legs");
    expect(exerciseCategory("Romanian Deadlift")).toBe("Legs");
    expect(exerciseCategory("Bench Press")).toBe("Chest");
    expect(exerciseCategory("Lat Pulldown")).toBe("Back");
    expect(exerciseCategory("Seated Shoulder Press")).toBe("Shoulders");
    expect(exerciseCategory("Barbell Curl")).toBe("Arms");
    expect(exerciseCategory("Hanging Leg Raise")).toBe("Core");
  });
  it("routes skills and non-lifts before muscle groups", () => {
    expect(exerciseCategory("Front lever row old")).toBe("Skill");
    expect(exerciseCategory("Handstand")).toBe("Skill");
    expect(exerciseCategory("Handstand Push Ups")).toBe("Shoulders"); // push-up trains shoulders
    expect(exerciseCategory("Stretch split")).toBe("Mobility");
    expect(exerciseCategory("Bike machine Cardio")).toBe("Cardio");
  });
  it("falls back to Other for the noise", () => {
    expect(exerciseCategory("Cold shower")).toBe("Mobility");
    expect(exerciseCategory("KG - track food")).toBe("Other");
  });
});

describe("muscleGroup (fine split)", () => {
  it("splits the legs into the prime mover", () => {
    expect(muscleGroup("Squat")).toBe("Quads");
    expect(muscleGroup("Leg Extension")).toBe("Quads");
    expect(muscleGroup("Romanian Deadlift")).toBe("Hamstrings");
    expect(muscleGroup("Lying Leg Curl")).toBe("Hamstrings");
    expect(muscleGroup("Hip Thrust")).toBe("Glutes");
    expect(muscleGroup("Standing Calf Raise")).toBe("Calves");
  });
  it("splits the upper body, specific before broad", () => {
    expect(muscleGroup("Close Grip Bench Press")).toBe("Triceps");
    expect(muscleGroup("Tricep Pushdown")).toBe("Triceps");
    expect(muscleGroup("Barbell Curl")).toBe("Biceps");
    expect(muscleGroup("Bench Press")).toBe("Chest");
    expect(muscleGroup("Seated Shoulder Press")).toBe("Shoulders");
  });
  it("splits the back into lower / upper / lats (pulls vs rows)", () => {
    expect(muscleGroup("Bent Over Row")).toBe("Lats (rows)");
    expect(muscleGroup("Seated Cable Row")).toBe("Lats (rows)");
    expect(muscleGroup("Lat Pulldown")).toBe("Lats (pulls)");
    expect(muscleGroup("Pull Ups")).toBe("Lats (pulls)");
    expect(muscleGroup("Back Extension")).toBe("Lower back");
    expect(muscleGroup("Deadlift")).toBe("Lower back"); // erectors brace the load
    expect(muscleGroup("Barbell Shrug")).toBe("Upper back");
    expect(muscleGroup("Face Pull")).toBe("Upper back");
    expect(muscleGroup("Inverted deadlift")).toBe("Lats (rows)"); // a lat row, not a deadlift
  });
  it("keeps core and non-lifts out of the muscle splits", () => {
    expect(muscleGroup("Hanging Leg Raise")).toBe("Core");
    expect(muscleGroup("Plank")).toBe("Core");
    expect(muscleGroup("Treadmill Run")).toBe("Cardio");
    expect(muscleGroup("KG - track food")).toBe("Other");
  });
});

describe("exerciseCategories (multi-membership)", () => {
  it("puts a deadlift in Legs, Back and Core (and its pattern + leg splits)", () => {
    const c = exerciseCategories("Deadlift");
    expect(c).toContain("Legs (all)");
    expect(c).toContain("Legs (quads/glutes/hams)");
    expect(c).toContain("Back");
    expect(c).toContain("Core");
    expect(c).toContain("Deadlift pattern");
  });
  it("groups squat variants under the Squat pattern + leg splits", () => {
    expect(exerciseCategories("Front Squat")).toContain("Squat pattern");
    expect(exerciseCategories("Front Squat")).toContain("Legs (quads/glutes/hams)");
    expect(exerciseCategories("Hack Squat")).toContain("Squat pattern");
  });
  it("treats plain RDL / back extension / good morning as the Deadlift pattern, not accessory", () => {
    expect(exerciseCategories("Romanian Deadlift")).toContain("Deadlift pattern");
    expect(exerciseCategories("Romanian Deadlift")).not.toContain("Deadlift accessory");
    expect(exerciseCategories("Back Extension")).toContain("Deadlift pattern");
    expect(exerciseCategories("Back Extension")).not.toContain("Deadlift accessory");
    expect(exerciseCategories("Good Morning")).toContain("Deadlift pattern");
    // Variant RDLs and reverse hypers remain accessories.
    expect(exerciseCategories("Deficit Romanian Deadlift")).toContain("Deadlift accessory");
    expect(exerciseCategories("Reverse Hyperextension")).toContain("Deadlift accessory");
  });
  it("keeps calves out of the narrow quads/glutes/hams split but in Legs (all)", () => {
    const calf = exerciseCategories("Standing Calf Raise");
    expect(calf).toContain("Legs (all)");
    expect(calf).not.toContain("Legs (quads/glutes/hams)");
  });
  it("returns a single non-strength bucket for cardio/mobility/skill", () => {
    expect(exerciseCategories("Bike machine Cardio")).toEqual(["Cardio"]);
    expect(exerciseCategories("Stretch split")).toEqual(["Mobility"]);
    expect(exerciseCategories("Handstand")).toEqual(["Skill"]);
  });
  it("only ever returns names from LIST_CATEGORIES, and Other for noise", () => {
    for (const name of ["Deadlift", "Bench Press", "Standing Calf Raise", "Plank"])
      for (const cat of exerciseCategories(name)) expect(LIST_CATEGORIES).toContain(cat);
    expect(exerciseCategories("KG - track food")).toEqual(["Other"]);
  });
});

describe("exercise tag registry", () => {
  it("tags a Romanian Deadlift with its muscle, the Hinge pattern and the DL-pattern group", () => {
    const tags = tagsForExercise("Romanian Deadlift").map((t) => t.id);
    expect(tags).toContain("muscle.hams"); // prime mover muscle
    expect(tags).toContain("pattern.hinge"); // functional pattern
    expect(tags).toContain("compare.dl-pattern"); // comparable group member
  });

  it("tags both squat members of the SQ-mix combinable group", () => {
    expect(combinableGroupsFor("Squat").map((t) => t.id)).toContain("combine.sq-mix");
    expect(combinableGroupsFor("Smith Machine Squat").map((t) => t.id)).toContain("combine.sq-mix");
    expect(combinableGroupsFor("Bench Press")).toEqual([]); // not a member of any
  });

  it("returns the DL-pattern comparable group for its members only", () => {
    expect(comparableGroupsFor("Deadlift").map((t) => t.id)).toContain("compare.dl-pattern");
    expect(comparableGroupsFor("Romanian Deadlift").map((t) => t.id)).toContain("compare.dl-pattern");
    expect(comparableGroupsFor("Squat")).toEqual([]);
  });

  it("keeps the registry internally consistent (unique ids, valid ratios)", () => {
    const ids = EXERCISE_REGISTRY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length); // every id unique
    for (const t of EXERCISE_REGISTRY)
      for (const m of t.members ?? []) expect(m.ratio).toBeGreaterThan(0);
    // Comparable ratios are a fraction of the reference (0 < r <= ~1.2).
    for (const t of COMPARABLE_GROUPS)
      for (const m of t.members ?? []) expect(m.ratio).toBeLessThanOrEqual(1.2);
  });
});

describe("exercisesForTag (browse a group's members)", () => {
  const names = ["Squat", "Smith Machine Squat", "Front Squat", "Deadlift", "Romanian Deadlift", "Bench Press", "Lat Pulldown"];
  it("lists a muscle group by prime mover", () => {
    const quads = MUSCLE_GROUP_TAGS.find((t) => t.label === "Quads")!;
    const got = exercisesForTag(quads, names);
    expect(got).toContain("Squat");
    expect(got).toContain("Front Squat");
    expect(got).not.toContain("Bench Press");
    expect(got).not.toContain("Deadlift"); // deadlift's prime mover is Back, not Quads
  });
  it("lists a functional pattern by keyword", () => {
    const squatPat = FUNCTIONAL_PATTERN_TAGS.find((t) => t.label === "Squat pattern")!;
    expect(exercisesForTag(squatPat, names)).toEqual(["Squat", "Smith Machine Squat", "Front Squat"]);
    const hinge = FUNCTIONAL_PATTERN_TAGS.find((t) => t.label === "Hinge")!;
    expect(exercisesForTag(hinge, names)).toEqual(["Deadlift", "Romanian Deadlift"]);
  });
  it("lists a combinable/comparable group by its explicit members", () => {
    const dl = COMPARABLE_GROUPS.find((t) => t.id === "compare.dl-pattern")!;
    expect(exercisesForTag(dl, names)).toEqual(["Deadlift", "Romanian Deadlift"]);
  });
});

describe("deadlift pattern vs accessory (hand-curated include/exclude)", () => {
  const ids = (n: string) => tagsForExercise(n).map((t) => t.id);
  it("holds and the one-arm side deadlift are accessories, not the pattern", () => {
    expect(ids("Deadlift hold")).toContain("pattern.deadlift-accessory");
    expect(ids("Deadlift hold")).not.toContain("pattern.deadlift");
    expect(ids("Barbell One Arm Side Deadlift")).toContain("pattern.deadlift-accessory");
    expect(ids("Barbell One Arm Side Deadlift")).not.toContain("pattern.deadlift");
  });
  it("good mornings and back extensions are the deadlift pattern, not accessories", () => {
    expect(ids("Good Morning")).toContain("pattern.deadlift");
    expect(ids("Good Morning")).not.toContain("pattern.deadlift-accessory");
    expect(ids("Machine Back Extension")).toContain("pattern.deadlift");
    expect(ids("Machine Back Extension")).not.toContain("pattern.deadlift-accessory");
  });
  it("plain RDLs are the pattern; variant RDLs and reverse hypers stay accessories", () => {
    expect(ids("Romanian Deadlift")).toContain("pattern.deadlift");
    expect(ids("Romanian Deadlift")).not.toContain("pattern.deadlift-accessory");
    expect(ids("Single Leg Romanian Deadlift")).not.toContain("pattern.deadlift-accessory");
    expect(ids("Deficit Romanian Deadlift")).toContain("pattern.deadlift-accessory");
    expect(ids("Reverse Hyperextension")).toContain("pattern.deadlift-accessory");
  });
  it("the inverted deadlift is a lats row, not any deadlift pattern", () => {
    expect(ids("Inverted deadlift")).not.toContain("pattern.deadlift");
    expect(ids("Inverted deadlift")).not.toContain("pattern.deadlift-accessory");
    expect(ids("Inverted deadlift")).not.toContain("pattern.hinge");
    expect(muscleGroup("Inverted deadlift")).toBe("Lats (rows)");
  });
});

describe("realPullupWeight", () => {
  it("identifies bar pull-up / chin-up movements (not pulldowns)", () => {
    expect(isAssistablePullup("Pull Ups")).toBe(true);
    expect(isAssistablePullup("Assisted Pull-up")).toBe(true);
    expect(isAssistablePullup("Pullup")).toBe(true);
    expect(isAssistablePullup("Chin Up")).toBe(true);
    expect(isAssistablePullup("Lat Pulldown")).toBe(false);
    expect(isAssistablePullup("Pullover")).toBe(false);
    expect(isAssistablePullup("Bench Press")).toBe(false);
  });

  it("halves a negative (machine-assisted) pull-up weight", () => {
    expect(realPullupWeight("Pull Ups", -30)).toBe(-15);
    expect(realPullupWeight("Assisted Chin Ups", -20)).toBe(-10);
  });

  it("leaves positive added weight and zero untouched", () => {
    expect(realPullupWeight("Pull Ups", 15)).toBe(15);
    expect(realPullupWeight("Pull Ups", 0)).toBe(0);
    expect(realPullupWeight("Pull Ups", null)).toBe(null);
  });

  it("does not touch other exercises, even when negative", () => {
    expect(realPullupWeight("Lat Pulldown", -30)).toBe(-30);
    expect(realPullupWeight("Assisted Dip", -40)).toBe(-40);
  });
});
