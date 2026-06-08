/**
 * World-record reference data + the bodyweight→weight-class→record lookup, for the
 * "World records" page. Pure & tested (the page glue in main.ts wires it to the
 * roster + the natural-potential model in profile.ts).
 *
 * Scope for now: the POWERLIFTING TRIO (squat, bench, deadlift) + total, under the
 * IPF "Classic" (raw, unequipped) OPEN division — the federation/division most
 * comparable to how these lifters train.
 *
 * ⚠ DATA PROVENANCE: the official record databases (goodlift.info,
 * powerlifting.sport, openpowerlifting.org) block automated fetching, so the kg
 * values below were seeded from known IPF Classic Open records and are marked
 * PROVISIONAL — verify/refresh against {@link RECORDS_SOURCE_URL}. They live in ONE
 * table so a correction is a single edit. Update RECORDS_AS_OF when you refresh.
 */

export type Sex = "m" | "f";
/** The three competition lifts plus their sum. */
export type PowerLift = "squat" | "bench" | "deadlift" | "total";
export const POWER_LIFTS: PowerLift[] = ["squat", "bench", "deadlift", "total"];

/** The logged exercise name each record lift maps to (for the lifter's own best).
 * "total" has no single exercise — it sums the three. */
export const LIFT_EXERCISE: Record<Exclude<PowerLift, "total">, string> = {
  squat: "Squat",
  bench: "Bench Press",
  deadlift: "Deadlift",
};
export const LIFT_LABEL: Record<PowerLift, string> = {
  squat: "Squat",
  bench: "Bench Press",
  deadlift: "Deadlift",
  total: "Total",
};

/** Where the numbers come from, and how current they are (shown on the page). */
export const RECORDS_FEDERATION = "IPF Classic (raw) · Open";
export const RECORDS_SOURCE_URL = "https://goodlift.info/records.php";
export const RECORDS_AS_OF = "2024";
/** True while the kg values are seeded-from-knowledge, not verified against the
 * official database — the page shows a "provisional" flag while this is on. */
export const RECORDS_PROVISIONAL = true;

export interface LiftSet { squat: number; bench: number; deadlift: number; total: number; }

/** A weight class: its inclusive upper bound (kg) or null for the unbounded "+"
 * class, plus the label shown on the page ("−83" / "120+"). */
export interface WeightClass { sex: Sex; max: number | null; label: string; }

/** IPF Open bodyweight-class upper bounds (kg). The final entry is the "+" class. */
export const MEN_CLASS_BOUNDS: number[] = [59, 66, 74, 83, 93, 105, 120];
export const WOMEN_CLASS_BOUNDS: number[] = [47, 52, 57, 63, 69, 76, 84];

/** All classes for a sex, ascending, ending in the unbounded "+" class. */
export function weightClasses(sex: Sex): WeightClass[] {
  const bounds = sex === "f" ? WOMEN_CLASS_BOUNDS : MEN_CLASS_BOUNDS;
  const top = bounds[bounds.length - 1]!;
  return [
    ...bounds.map((b) => ({ sex, max: b, label: `−${b}` })),
    { sex, max: null, label: `${top}+` },
  ];
}

/** The IPF Open weight class a bodyweight (kg) falls into: the lightest class whose
 * upper bound is ≥ the bodyweight, else the unbounded "+" class. */
export function weightClassFor(sex: Sex, bodyweightKg: number): WeightClass {
  const classes = weightClasses(sex);
  for (const c of classes) if (c.max !== null && bodyweightKg <= c.max) return c;
  return classes[classes.length - 1]!; // the "+" class
}

/**
 * IPF Classic (raw) OPEN world records, kg, keyed by class label.
 * ⚠ PROVISIONAL — see the file header. squat/bench/deadlift are single-lift
 * records; total is the best meet total (not the sum of the three single-lift
 * records, which come from different lifters).
 */
export const WORLD_RECORDS: Record<Sex, Record<string, LiftSet>> = {
  m: {
    "−59": { squat: 245, bench: 158.5, deadlift: 289.5, total: 663 },
    "−66": { squat: 270, bench: 178, deadlift: 305, total: 718 },
    "−74": { squat: 303, bench: 200.5, deadlift: 322.5, total: 800 },
    "−83": { squat: 320.5, bench: 220.5, deadlift: 350, total: 865 },
    "−93": { squat: 361, bench: 240, deadlift: 362.5, total: 920 },
    "−105": { squat: 385, bench: 251.5, deadlift: 380.5, total: 977.5 },
    "−120": { squat: 400, bench: 261.5, deadlift: 396, total: 1010 },
    "120+": { squat: 490.5, bench: 270, deadlift: 400.5, total: 1117.5 },
  },
  f: {
    "−47": { squat: 156, bench: 90, deadlift: 192, total: 430 },
    "−52": { squat: 171, bench: 100.5, deadlift: 207.5, total: 463 },
    "−57": { squat: 191, bench: 115, deadlift: 226, total: 502.5 },
    "−63": { squat: 202.5, bench: 118.5, deadlift: 232.5, total: 525 },
    "−69": { squat: 214, bench: 130, deadlift: 240, total: 565 },
    "−76": { squat: 224, bench: 138.5, deadlift: 252.5, total: 576 },
    "−84": { squat: 230.5, bench: 145, deadlift: 261, total: 600 },
    "84+": { squat: 261, bench: 160, deadlift: 272.5, total: 660 },
  },
};

/** The record (kg) for a sex + class + lift, or null if the class isn't in the
 * table (shouldn't happen for a valid class label). */
export function recordFor(sex: Sex, classLabelStr: string, lift: PowerLift): number | null {
  const set = WORLD_RECORDS[sex][classLabelStr];
  return set ? set[lift] : null;
}

/** Percent of the world record a lift represents (0–100+), rounded to one decimal;
 * null when either input is missing or the record is non-positive. */
export function percentOfRecord(lift: number | null, record: number | null): number | null {
  if (lift === null || record === null || record <= 0) return null;
  return Math.round((lift / record) * 1000) / 10;
}
