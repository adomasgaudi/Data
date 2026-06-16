/**
 * Per-set strength metrics. Pure, total functions on primitives — the most
 * heavily tested code in the project because formula bugs are *systematic*:
 * get the 1RM formula subtly wrong and every leaderboard is wrong, confidently.
 * Each formula is unit-tested against hand-computed reference values.
 */

/**
 * Estimated one-rep max via the Epley formula: weight * (1 + reps/30).
 * By definition a single rep returns the weight itself.
 * Returns null when the inputs can't define a 1RM (missing or non-positive).
 */
export function epley1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Estimated one-rep max via the Brzycki formula: weight * 36 / (37 - reps).
 * Undefined at/above 37 reps (denominator <= 0) — returns null there.
 */
export function brzycki1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  if (reps >= 37) return null;
  return (weight * 36) / (37 - reps);
}

/**
 * Bench-press REPS↔%1RM curve from Nuzzo et al. (2024, Sports Medicine) — the
 * meta-analysis of 962 reps-to-failure tests across 7,289 people. We fit a
 * least-squares cubic to ln(reps) against a centred load t = (%1RM − 55) / 40
 * over the study's published bench-press point estimates (R² = 0.995). Unlike
 * the one-size-fits-all Epley/Brzycki, this is bench-specific and data-derived:
 * people manage *fewer* reps per %1RM on bench, so it yields more conservative
 * 1RMs. The coefficients below are precomputed from those estimates; the values
 * they must reproduce are pinned in metrics.test.ts. The page public/reps-1rm.html
 * visualises the same curve.
 */
const BENCH_LN_REPS_COEFFS = [3.189078334, -1.329509482, -0.232660599, -0.6277241766] as const;
const benchT = (pct: number): number => (pct - 55) / 40;

/**
 * The raw bench-press point estimates from Nuzzo et al. (Fig. 3) — [%1RM, avg
 * reps to failure] — that the cubic above is fitted to. Kept here so both the
 * calculator graph and the standalone explainer page (public/reps-1rm.html)
 * plot the *same* study data as dots under the best-fit curve. 95% → 15% of 1RM.
 */
export const BENCH_REPS_STUDY: ReadonlyArray<readonly [number, number]> = [
  [95, 2.59], [90, 4.11], [85, 6.23], [80, 8.82], [75, 11.51], [70, 14.08],
  [65, 16.59], [60, 19.34], [55, 22.79], [50, 27.25], [45, 33.01], [40, 40.45],
  [35, 50.1], [30, 62.62], [25, 78.88], [20, 100.02], [15, 127.49],
];

/** Average bench-press reps to failure at a given % of 1RM (e.g. 70 → ~13.8). */
export function benchRepsAtPct(pct: number): number {
  const t = benchT(pct);
  const [a, b, c, d] = BENCH_LN_REPS_COEFFS;
  return Math.exp(a + b * t + c * t * t + d * t * t * t);
}

/**
 * Inverse of benchRepsAtPct: the % of 1RM that `reps` reps to failure implies on
 * bench. The curve is monotonic, so a bounded bisection pins it down. Clamped to
 * the STUDY's range — about one rep ⇒ 100% (a true single is your 1RM), and the
 * lowest study point ⇒ a 15% floor (≈127 reps), so it stays within the data
 * (Nuzzo et al. only go down to 15% of 1RM) and never returns a load above 100%.
 */
export function benchPctForReps(reps: number): number {
  if (reps <= benchRepsAtPct(100)) return 100;
  if (reps >= benchRepsAtPct(15)) return 15;
  let lo = 15; // lighter load, more reps — 15% is the study's lowest point
  let hi = 100; // heavier load, fewer reps
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (benchRepsAtPct(mid) > reps) lo = mid; // still too many reps → go heavier
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Estimated 1RM from a bench set via the Nuzzo curve: weight ÷ (%1RM/100), where
 * %1RM comes from the rep count. A single rep is, by definition, the 1RM.
 */
export function nuzzo1RM(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return (weight * 100) / benchPctForReps(reps);
}

/**
 * The load you could lift for `reps` reps on bench, given your 1RM (Nuzzo curve):
 * 1RM × (%1RM/100). The inverse companion to nuzzo1RM.
 */
export function nuzzoWeightForReps(oneRepMax: number | null, reps: number | null): number | null {
  if (oneRepMax === null || reps === null) return null;
  if (oneRepMax <= 0 || reps <= 0) return null;
  return (oneRepMax * benchPctForReps(reps)) / 100;
}

/**
 * The ADDED weight (plate, or −assistance) you could lift for `reps` reps, given your
 * added-weight 1RM and the bodyweight SHARE folded into the lift (coeff × bodyweight).
 *
 * The Nuzzo %-of-1RM relationship holds on the EFFECTIVE load (added + body share), so:
 *   effective(reps) = (added1RM + bodyShare) × pct(reps)/100
 *   added(reps)     = effective(reps) − bodyShare
 * The result goes NEGATIVE once the effective load drops below the body share — i.e. the
 * rep range where you'd need ASSISTANCE (high-rep pull-ups). For a bar-only lift
 * (bodyShare = 0) it reduces to nuzzoWeightForReps. Null on missing/degenerate input.
 */
export function nuzzoAddedWeightForReps(
  added1RM: number | null,
  bodyShare: number,
  reps: number | null,
): number | null {
  if (added1RM === null || reps === null || !Number.isFinite(bodyShare)) return null;
  const eff = nuzzoWeightForReps(added1RM + bodyShare, reps);
  return eff === null ? null : eff - bodyShare;
}

/** The heaviest weight logged at each (rounded) rep count, 1..maxReps — the lifter's
 * real rep-maxes. These are the points that, plotted as %1RM vs reps, should sit ON
 * the Nuzzo curve when the assumed 1RM is right (the card's interactive fit). The cap
 * matches the Nuzzo curve's drawn range (~60 reps / 15% of 1RM) so high-rep sets — a
 * 22kg×30 — still plot instead of vanishing (PB-30: "I don't see the 30-rep dots"). */
export function nuzzoRepMaxes(
  sets: ReadonlyArray<{ weight: number | null; reps: number | null }>,
  maxReps = 60,
): { reps: number; weight: number }[] {
  const best = new Map<number, number>();
  for (const s of sets) {
    const w = s.weight, r = s.reps;
    if (w == null || r == null || !(w > 0) || !(r >= 1)) continue;
    const rr = Math.round(r);
    if (rr < 1 || rr > maxReps) continue;
    best.set(rr, Math.max(best.get(rr) ?? 0, w));
  }
  return [...best.entries()].map(([reps, weight]) => ({ reps, weight })).sort((a, b) => a.reps - b.reps);
}

/** The 1RM that best fits the rep-max points to the Nuzzo %1RM curve, in closed form.
 * Minimising Σ(100·w/R − pct(reps))² over R gives R = Σ(100w)² / Σ(pct·100w). Null
 * when there are no usable points. This is the "snap-to-best-fit" the card offers. */
export function bestFitNuzzo1RM(
  repMaxes: ReadonlyArray<{ reps: number; weight: number }>,
): number | null {
  let num = 0, den = 0;
  for (const { reps, weight } of repMaxes) {
    const a = 100 * weight;
    const t = benchPctForReps(reps);
    num += a * a;
    den += t * a;
  }
  return den > 0 ? num / den : null;
}


/**
 * Predicted bench reps to failure at a given load, given your 1RM (Nuzzo curve):
 * read the curve at (weight/1RM)×100. At or above the 1RM it's a single.
 */
export function nuzzoRepsAtWeight(weight: number | null, oneRepMax: number | null): number | null {
  if (weight === null || oneRepMax === null) return null;
  if (weight <= 0 || oneRepMax <= 0) return null;
  if (weight >= oneRepMax) return 1;
  return benchRepsAtPct((weight / oneRepMax) * 100);
}

/**
 * Above this many reps, the EPLEY/BRZYCKI formulas are guesswork (they were fit on
 * low-rep sets), so a 35-rep set would extrapolate to an absurd 1RM. Sets above
 * this many reps yield NO 1RM under those formulas (addedWeight1RM returns null) —
 * we report "—" rather than a clamped value. The NUZZO curve is data-derived
 * across the study's full range (down to 15% of 1RM ≈ 127 reps), so it is EXEMPT
 * and estimates at any rep count. The Test-tab teaching calculator is exempt too.
 */
export const MAX_1RM_REPS = 15;

export type OneRepMaxFormula = "epley" | "brzycki" | "nuzzo";

export function estimate1RM(
  weight: number | null,
  reps: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (formula === "brzycki") return brzycki1RM(weight, reps);
  if (formula === "nuzzo") return nuzzo1RM(weight, reps);
  return epley1RM(weight, reps);
}

/**
 * Inverse of estimate1RM: the load you could lift for `reps` reps given a 1RM,
 * under the chosen formula. Turns an athlete's estimated max into target working
 * weights (their 5RM / 10RM / 15RM). A single rep is, by definition, the 1RM.
 * Returns null on missing or non-positive inputs.
 *   Epley:   1RM = w(1 + r/30)   → w = 1RM / (1 + r/30)
 *   Brzycki: 1RM = w·36/(37 − r) → w = 1RM·(37 − r)/36   (null at r ≥ 37)
 *   Nuzzo:   bench %1RM curve     → nuzzoWeightForReps
 */
export function weightForReps(
  oneRepMax: number | null,
  reps: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (oneRepMax === null || reps === null) return null;
  if (oneRepMax <= 0 || reps <= 0) return null;
  if (reps === 1) return oneRepMax;
  if (formula === "nuzzo") return nuzzoWeightForReps(oneRepMax, reps);
  if (formula === "brzycki") {
    if (reps >= 37) return null;
    return (oneRepMax * (37 - reps)) / 36;
  }
  return oneRepMax / (1 + reps / 30);
}

/**
 * Inverse of weightForReps in the other direction: given a 1RM and a working
 * load, how many reps should that load allow under the chosen formula. The
 * companion to weightForReps for a two-way calculator (weight → reps).
 * Intentionally does NOT clamp — a load at/above the 1RM yields ≤ 1 rep, a load
 * above it can go fractional/negative, so callers see the raw curve. Returns
 * null only when inputs are missing or non-positive (genuinely undefined).
 *   Epley:   1RM = w(1 + r/30)   → r = 30·(1RM/w − 1)
 *   Brzycki: 1RM = w·36/(37 − r) → r = 37 − 36·w/1RM
 *   Nuzzo:   bench %1RM curve     → nuzzoRepsAtWeight
 */
export function repsForWeight(
  oneRepMax: number | null,
  weight: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (oneRepMax === null || weight === null) return null;
  if (oneRepMax <= 0 || weight <= 0) return null;
  if (formula === "nuzzo") return nuzzoRepsAtWeight(weight, oneRepMax);
  if (formula === "brzycki") return 37 - (36 * weight) / oneRepMax;
  return 30 * (oneRepMax / weight - 1); // epley
}

/**
 * Predicted reps-in-reserve for a set: how many reps the athlete's estimated 1RM
 * says they *should* manage at this load (repsForWeight), minus the reps they
 * actually did. Both the 1RM and the load must be in the SAME frame — feed the
 * effective (bodyweight-inclusive) load and the effective 1RM so bodyweight lifts
 * line up. A positive value means reps left in the tank (a submaximal set); ~0
 * means the set was taken to failure (it's at or defining the 1RM); a negative
 * value means they beat what the 1RM predicts — a sign the estimate is stale/low.
 * Returns null when reps are missing/non-positive or the predicted reps can't be
 * computed (no 1RM, non-positive load, Brzycki out of range).
 */
export function predictedRir(
  oneRepMax: number | null,
  weight: number | null,
  reps: number | null,
  formula: OneRepMaxFormula = "epley",
): number | null {
  if (reps === null || reps <= 0) return null;
  const predicted = repsForWeight(oneRepMax, weight, formula);
  if (predicted === null) return null;
  return predicted - reps;
}

/** Effort class of a set from its reps-in-reserve (logged or predicted): a set
 * near failure is "hard", a clearly-submaximal one is "mid", and a very light one
 * is a "warmup". Big compound leg lifts fatigue more, so their "mid" band runs
 * wider (up to 8 RIR) than other muscles (up to 6) before counting as a warmup. */
export type EffortClass = "hard" | "mid" | "warmup";
export function effortClass(rir: number, bigLegs: boolean): EffortClass {
  if (!Number.isFinite(rir)) return "warmup";
  if (rir < 3) return "hard";
  return rir < (bigLegs ? 8 : 6) ? "mid" : "warmup";
}

/**
 * Ordinary least-squares line through points: returns slope and intercept, or
 * null if there are fewer than two points or all x are equal. Used to read a
 * progression rate (kg per day) off an athlete's estimated-1RM history.
 */
export function linearFit(points: readonly { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

/** Total load moved by a set: weight * reps. Null if either is missing. */
export function setVolume(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  return weight * reps;
}

/**
 * Load to feed the 1RM formula for a movement that lifts part of the body:
 *   coeff * bodyweight + addedWeight.
 * coeff <= 0 means the body isn't part of the load — the added weight passes
 * through unchanged (so a missing weight stays null and is filtered out as
 * before). For coeff > 0 a missing added weight counts as 0 (bodyweight-only
 * set), and an unknown bodyweight contributes 0.
 */
export function effectiveLoad(
  addedWeight: number | null,
  bodyweight: number | null,
  coeff: number,
): number | null {
  if (coeff <= 0) return addedWeight;
  return (bodyweight ?? 0) * coeff + (addedWeight ?? 0);
}

/**
 * Detraining ("use it or lose it") model — a LOGARITHMIC forgetting curve, the
 * mirror of a learning curve: you lose strength fast at first, then ever more
 * slowly. The *loss* grows with the log of time off:
 *
 *   loss(t) = lossPerLog · ln(1 + (t − grace) / S),   retention = 1 − loss (floored)
 *
 * Curved (not the near-straight line an exponential gives) and aggressive: with
 * S = baseStability = 30 and lossPerLog = 0.10/ln2, a freshly-hit lift loses ~10%
 * one month past the grace, ~27% by six months, ~36% by a year.
 *
 * The learning-curve twist: `S` (durability, days) GROWS with each training
 * session (grownStability), so a well-drilled lift fades more slowly than a one-off
 * PR — but only modestly (capped low), so even trained lifts keep a visible,
 * curved fade rather than flattening to a line. Floored so it never hits zero.
 */
export const STRENGTH_DECAY = {
  graceDays: 14, // full strength retained for two weeks after a session
  baseStability: 30, // days; a freshly-hit lift loses ~10% a month past grace
  lossPerLog: 0.1 / Math.LN2, // ⇒ exactly 10% lost one month after the grace ends
  stabilityGrowth: 1.8, // each session makes the lift this much more durable
  maxStability: 90, // modest cap — trained lifts fade slower, but still clearly
  floor: 0.5, // never decays below half the peak (muscle memory)
} as const;

/**
 * Fraction (0–1] of a peak strength still available after `daysSinceTrained` days
 * without training a lift, for a memory of durability `stabilityDays`. Flat
 * through the grace, then a logarithmic decline, floored. Bigger S ⇒ a flatter
 * curve (slower decay) — that's how repeated training weakens the fade.
 */
export function strengthRetention(
  daysSinceTrained: number,
  stabilityDays: number = STRENGTH_DECAY.baseStability,
): number {
  const { graceDays, lossPerLog, floor } = STRENGTH_DECAY;
  if (!Number.isFinite(daysSinceTrained) || daysSinceTrained <= graceDays) return 1;
  const loss = lossPerLog * Math.log(1 + (daysSinceTrained - graceDays) / Math.max(1, stabilityDays));
  return Math.max(floor, 1 - loss);
}

/** Each training session consolidates the lift: durability (stability) grows by
 * the growth factor, capped at maxStability. So every repetition makes the future
 * decay weaker — the more you've trained a lift, the slower it fades. */
export function grownStability(stabilityDays: number): number {
  return Math.min(STRENGTH_DECAY.maxStability, stabilityDays * STRENGTH_DECAY.stabilityGrowth);
}

/** Whole days from ISO date `from` to ISO date `to` (negative if `to` precedes
 * `from`). Both are "yyyy-MM-dd"; parsed as UTC midnight so DST can't skew it. */
export function daysBetweenIso(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
