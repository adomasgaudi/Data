/**
 * Log-curve projection: y = c + b·ln(t + a)
 * where t = (x - x0) / DAY  (days from first data point).
 *
 * Grid-searches 'a' (the shift, in days) to minimise residual sum of squares,
 * then OLS-fits b and c.  Never throws.
 */
import { linearFit } from "./metrics";

const DAY = 86_400_000;

/** Anything that can map a timestamp x to a predicted y (or null off-domain). */
export interface CurveFit {
  predict(x: number): number | null;
}

export interface LogFit extends CurveFit {
  /** Shift parameter (days).  Chosen by grid search. */
  a: number;
  /** ln coefficient. */
  b: number;
  /** Intercept. */
  c: number;
  /** Timestamp of the first data point used for normalisation. */
  x0: number;
  /**
   * Predict y at timestamp x.
   * Returns null when the input is outside the domain (t + a ≤ 0) or the
   * result is not a finite number.
   */
  predict(x: number): number | null;
}

/** Number of grid-search candidates for 'a'. */
const GRID_STEPS = 40;
/** Smallest candidate for a (days). */
const A_MIN = 0.5;
/** Largest candidate for a (days). */
const A_MAX = 3_650;

/**
 * Fit a log curve to pts.  Requires ≥ 3 points.
 * Returns null when fitting is impossible (too few points, degenerate data).
 */
export function fitLog(pts: readonly { x: number; y: number }[]): LogFit | null {
  if (pts.length < 3) return null;

  const x0 = pts[0]!.x;
  const days = pts.map((p) => (p.x - x0) / DAY);
  const ys = pts.map((p) => p.y);

  // Log scale from A_MIN to A_MAX
  const logMin = Math.log(A_MIN);
  const logMax = Math.log(A_MAX);

  let bestA = A_MIN;
  let bestFit: { slope: number; intercept: number } | null = null;
  let bestRss = Infinity;

  for (let i = 0; i <= GRID_STEPS; i++) {
    const a = Math.exp(logMin + (i / GRID_STEPS) * (logMax - logMin));
    const transformed = days.map((t, j) => ({ x: Math.log(t + a), y: ys[j]! }));
    const fit = linearFit(transformed);
    if (!fit) continue;

    let rss = 0;
    for (let j = 0; j < days.length; j++) {
      const pred = fit.intercept + fit.slope * Math.log(days[j]! + a);
      rss += (ys[j]! - pred) ** 2;
    }

    if (rss < bestRss) {
      bestRss = rss;
      bestA = a;
      bestFit = fit;
    }
  }

  if (!bestFit) return null;
  const { slope: b, intercept: c } = bestFit;
  if (!Number.isFinite(b) || !Number.isFinite(c)) return null;

  return {
    a: bestA,
    b,
    c,
    x0,
    predict(x: number): number | null {
      const t = (x - x0) / DAY;
      if (t + bestA <= 0) return null;
      const y = c + b * Math.log(t + bestA);
      return Number.isFinite(y) ? y : null;
    },
  };
}

/**
 * Ceiling-approach fit: y = ceiling − gap, where the gap to the ceiling shrinks
 * exponentially over time — the curve the owner wants: rises steeply early and
 * FLATTENS toward `ceiling` (a lifetime-potential / world-record level).
 *
 * The SHAPE (decay rate `m`) is found by regressing ln(ceiling − y) on t (days):
 * a lifter climbing toward the ceiling has a shrinking gap → m < 0 → asymptotic.
 * The LEVEL is then ANCHORED to the most recent point — the curve continues from
 * where the lifter actually IS, instead of the floating least-squares intercept that
 * left it drifting below the data (the recurring "projection doesn't fit the points"
 * bug — PB-40). So gap(t) = gapNow · e^(m·(t − tNow)); at tNow it equals the real gap.
 *
 * Requires ≥ 3 points strictly BELOW the ceiling, and a genuine approach (m < 0) —
 * flat/declining windows return null so the caller falls back to the plain log fit.
 */
export function fitCeiling(pts: readonly { x: number; y: number }[], ceiling: number): CurveFit | null {
  if (!Number.isFinite(ceiling)) return null;
  const x0 = pts.length ? pts[0]!.x : 0;
  // Only points below the ceiling can be log-distanced; a tiny floor avoids ln(0).
  const usable = pts
    .map((p) => ({ t: (p.x - x0) / DAY, gap: ceiling - p.y }))
    .filter((p) => p.gap > 1e-6);
  if (usable.length < 3) return null;
  const fit = linearFit(usable.map((p) => ({ x: p.t, y: Math.log(p.gap) })));
  if (!fit) return null;
  const m = fit.slope;
  // m ≥ 0 means the gap isn't shrinking (flat/declining window) — the ceiling-approach
  // model doesn't apply, so bail and let predict() fall back to the log fit.
  if (!Number.isFinite(m) || m >= 0) return null;
  // ANCHOR at the latest usable point so the curve passes through the lifter's CURRENT
  // strength and projects forward from there (root fix, PB-40).
  const anchor = usable[usable.length - 1]!;
  return {
    predict(x: number): number | null {
      const t = (x - x0) / DAY;
      const gap = anchor.gap * Math.exp(m * (t - anchor.t));
      if (!Number.isFinite(gap)) return null;
      const y = ceiling - gap;
      return Number.isFinite(y) ? y : null;
    },
  };
}

/**
 * Sample the fitted curve at `steps` evenly-spaced timestamps in [fromX, toX].
 * Points where predict returns null are omitted.
 */
export function sampleProjection(
  fit: CurveFit,
  fromX: number,
  toX: number,
  steps = 60,
): { x: number; y: number }[] {
  if (steps < 2 || fromX >= toX) return [];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = fromX + (i / steps) * (toX - fromX);
    const y = fit.predict(x);
    if (y !== null) out.push({ x, y });
  }
  return out;
}
