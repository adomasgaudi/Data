/**
 * World-record (world-class) reference per exercise, by sex, used to show "% of
 * world record" for an athlete. A record is one number — the best 1RM-equivalent
 * (kg) — set at ONE bodyweight, so to compare it to an athlete of a DIFFERENT
 * bodyweight we scale it allometrically: strength rises roughly with
 * bodyweight^(2/3) (the same idea behind Wilks/IPF points), so
 *
 *   WR(at athlete bw) = recordKg × (athleteBw / recordBw) ^ (2/3).
 *
 * The seed below is a small set of well-documented RAW powerlifting records at
 * roughly the holder's bodyweight — deliberately editable: the owner sets/corrects
 * any exercise (and the many calisthenics ones, where records are competition- and
 * format-specific) in the exercise info page. Units match the app's "added-weight
 * 1RM": for barbell lifts that's the bar weight; for weighted calisthenics it's the
 * added weight at 1 rep.
 */

/** A world record for one sex: `kg` (the lift) achieved at bodyweight `bw` (kg). */
export interface WrRef {
  kg: number;
  bw: number;
}

export const WR_SCALING_EXP = 2 / 3;

/** Scale a record to a target bodyweight (allometric ^2/3). */
export function scaleWr(ref: WrRef, atBodyweight: number): number {
  if (ref.bw <= 0 || atBodyweight <= 0) return ref.kg;
  return Math.round(ref.kg * Math.pow(atBodyweight / ref.bw, WR_SCALING_EXP) * 10) / 10;
}

/**
 * Seed of editable world records, keyed by exercise name → per sex. Approximate
 * raw, open, all-time figures (kg) at ~the holder's bodyweight — meant as a
 * starting point the owner refines. Empty for everything else until set.
 */
export const WORLD_RECORDS_SEED: Record<string, { m?: WrRef; f?: WrRef }> = {
  Squat: { m: { kg: 490, bw: 180 }, f: { kg: 300, bw: 120 } },
  "Bench Press": { m: { kg: 350, bw: 180 }, f: { kg: 207, bw: 110 } },
  Deadlift: { m: { kg: 488, bw: 180 }, f: { kg: 290, bw: 150 } },
};
