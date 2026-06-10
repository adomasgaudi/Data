// Unilateral (single-arm / single-leg) lifts. One logged set of a unilateral lift
// is performed on BOTH sides, so it counts as a Right set AND a Left set. We STORE
// a single record plus an optional per-set "side divergence"; both sides default
// EQUAL to the logged value (linked), and the owner can record a difference when the
// sides aren't the same. These are pure helpers — main.ts owns the stores (the
// per-exercise on/off override and the per-set divergence) and the DOM glue.

/** Tokens that mark a lift unilateral BY DEFAULT (a per-exercise toggle overrides).
 * Deliberately conservative — only unambiguous single-side names — so we never
 * silently double the set count of a normal two-sided lift. Matches both the raw
 * ("single arm") and normalised ("1-Arm") spellings the app uses. */
export const UNILATERAL_RE =
  /\b(1[-\s]?arm|one[-\s]?arm|single[-\s]?arm|1[-\s]?leg|one[-\s]?leg|single[-\s]?leg|pistol|unilateral)\b/i;

/** Auto-detect from the name alone. */
export function isUnilateralName(name: string): boolean {
  return UNILATERAL_RE.test(name);
}

/** Effective unilateral state: the name auto-detect, overridden per-exercise when the
 * owner has set one (`true` = force on, `false` = force off, `undefined` = auto). */
export function isUnilateral(name: string, override?: boolean): boolean {
  return override === undefined ? isUnilateralName(name) : override;
}

/** Per-set divergence: only the side values that DIFFER from the logged set are
 * stored. An absent field means "same as the logged value" (the linked default). */
export interface SideDivergence {
  rReps?: number;
  rWeight?: number | null;
  lReps?: number;
  lWeight?: number | null;
}

export interface SideVals {
  reps: number | null;
  weight: number | null;
}
export interface BothSides {
  right: SideVals;
  left: SideVals;
}

/** Resolve a unilateral set's two sides from its logged (effective) reps/weight plus
 * any stored divergence. With no divergence both sides equal the logged value — the
 * linked, default-equal behaviour. A stored value of `undefined` falls back to the
 * logged value; a stored `null` weight is an explicit "bodyweight / no weight". */
export function sideValues(reps: number | null, weight: number | null, d?: SideDivergence): BothSides {
  return {
    right: {
      reps: d?.rReps ?? reps,
      weight: d && "rWeight" in d && d.rWeight !== undefined ? d.rWeight : weight,
    },
    left: {
      reps: d?.lReps ?? reps,
      weight: d && "lWeight" in d && d.lWeight !== undefined ? d.lWeight : weight,
    },
  };
}

/** Whether the two sides carry different reps or weight (false = perfectly linked). */
export function sidesDiffer(b: BothSides): boolean {
  return b.right.reps !== b.left.reps || b.right.weight !== b.left.weight;
}

/** Is this divergence empty (no side actually differs) — used to drop the store key
 * so an unchanged unilateral set keeps the clean "linked, equal" default. */
export function divergenceEmpty(d: SideDivergence | undefined): boolean {
  if (!d) return true;
  return (
    d.rReps === undefined &&
    d.lReps === undefined &&
    !("rWeight" in d) &&
    !("lWeight" in d)
  );
}

/** How many sets one record contributes: a unilateral set is a right AND a left set,
 * so it counts as 2; everything else counts as 1. */
export function setUnits(unilateral: boolean): number {
  return unilateral ? 2 : 1;
}

/** Project records for COUNTING / VOLUME: each unilateral record becomes its two sides
 * (right then left), each carrying that side's reps/weight; non-unilateral records pass
 * through unchanged. Use ONLY where sets are counted or volume summed — never for the
 * history rows, which show one row per logged set. The caller supplies how to detect
 * unilateral, the stored divergence, and how to clone a record with new per-side
 * reps/weight (so it can keep setIds distinct). */
export function explodeSides<T extends { reps: number | null; weight: number | null }>(
  records: readonly T[],
  uni: (r: T) => boolean,
  divergence: (r: T) => SideDivergence | undefined,
  clone: (r: T, reps: number | null, weight: number | null, side: "R" | "L") => T,
): T[] {
  const out: T[] = [];
  for (const r of records) {
    if (!uni(r)) {
      out.push(r);
      continue;
    }
    const b = sideValues(r.reps, r.weight, divergence(r));
    out.push(clone(r, b.right.reps, b.right.weight, "R"));
    out.push(clone(r, b.left.reps, b.left.weight, "L"));
  }
  return out;
}
