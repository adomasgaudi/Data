// ---- Gravity-machine vs cable classification (LIFT / machine-type) ----------
//
// Some lifts — the Lat Pulldown is the motivating case — can be done on either a
// GRAVITY machine (plate-/lever-loaded) or a CABLE stack. The gravity machine
// over-reads relative to the cable: the same NUMBER on the gravity machine is
// worth only ~0.6 of that number on the cable for strength purposes. So a gravity
// set's cable-equivalent strength = its logged weight × GRAVITY_MULT.
//
// The user marks an exercise's machine mode in the Analysis view:
//   • "cable"   — every set is cable; weights stay as logged (the default).
//   • "gravity" — every set is the gravity machine; ×0.6 for all strength maths.
//   • "mixed"   — the log contains both, unlabelled, so we CLASSIFY each set
//                 from its estimated 1RM against the athlete's own cable level.
//
// Mixed-mode rule (owner's spec, "aggressive" cut-offs): using the cable version's
// estimated strength level as the yardstick, a set that is clearly TOO HEAVY to be
// a cable effort is the gravity machine (→ ×0.6); a LOW set is ambiguous — it could
// be a light cable set OR a gravity warm-up — so it's flagged NEEDS REVIEW rather
// than silently trusted. Everything in between is taken as cable.
//
// This module is PURE (no DOM, no storage): it takes estimated-1RM numbers and
// returns a verdict per set, so the heuristic can be unit-tested in isolation.

/** A gravity-machine number is worth this fraction of the same cable number. */
export const GRAVITY_MULT = 0.6;

export type MachineMode = "cable" | "gravity" | "mixed";
export type MachineVerdict = "cable" | "gravity" | "review";

/** Tunable cut-offs for the mixed-mode classifier. */
export interface MixedThresholds {
  /** Minimum ratio between two adjacent (ascending-sorted) estimated-1RMs to call
   * the upper part a SEPARATE (gravity) cluster. The physical gap is ~1/0.6≈1.67×;
   * a lower value catches gravity more eagerly ("aggressive"). */
  gapMin: number;
  /** A cable-side set below this fraction of the cable best (the top cable e1RM) is
   * too light to be sure about → "review" (might be a gravity warm-up). */
  lowFrac: number;
  /** Need at least this many sets before attempting a cable→gravity split; with
   * fewer, everything stays cable (too little to tell). */
  minSets: number;
}

/** The owner's chosen "aggressive" cut-offs. */
export const AGGRESSIVE_THRESHOLDS: MixedThresholds = { gapMin: 1.3, lowFrac: 0.55, minSets: 4 };

/**
 * Classify each set (given its estimated 1RM on the LOGGED weight) as cable /
 * gravity / review for an exercise in MIXED mode.
 *
 * Method: sort the e1RMs ascending. The gravity sets form a high cluster sitting a
 * clear step (~1/0.6) above the cable sets, so we split at the HIGHEST adjacent
 * gap whose ratio ≥ gapMin — everything above it is the gravity cluster (×0.6),
 * and the top cable value below it is the athlete's cable strength level. Among the
 * remaining (cable-side) sets, any that fall below lowFrac × cable-level are flagged
 * "review". Indices in the returned array line up with the input.
 */
export function classifyMixed(e1rms: readonly number[], t: MixedThresholds = AGGRESSIVE_THRESHOLDS): MachineVerdict[] {
  const n = e1rms.length;
  const out: MachineVerdict[] = new Array(n).fill("cable");
  if (n === 0) return out;

  // Sort indices by e1RM ascending so we can find the cluster gap.
  const order = [...e1rms.keys()].sort((a, b) => e1rms[a]! - e1rms[b]!);
  const sorted = order.map((i) => e1rms[i]!);

  // Highest adjacent gap ≥ gapMin → cable/gravity boundary. sorted[split..] = gravity.
  let split = n;
  if (n >= t.minSets) {
    for (let k = n - 1; k >= 1; k--) {
      const prev = sorted[k - 1]!;
      if (prev <= 0) continue;
      if (sorted[k]! / prev >= t.gapMin) {
        split = k;
        break;
      }
    }
  }

  // Cable strength level = the top cable-side e1RM (or the overall max if no split).
  const cableLevel = split > 0 ? sorted[split - 1]! : sorted[n - 1]!;
  for (let s = 0; s < n; s++) {
    const i = order[s]!;
    if (s >= split) out[i] = "gravity";
    else if (cableLevel > 0 && e1rms[i]! < t.lowFrac * cableLevel) out[i] = "review";
    else out[i] = "cable";
  }
  return out;
}

/** The strength multiplier to apply to a set given its machine verdict: gravity
 * sets are scaled to their cable-equivalent; cable / review sets are left as-is
 * (a review set is flagged for the owner, not silently adjusted). */
export function machineMultiplier(verdict: MachineVerdict): number {
  return verdict === "gravity" ? GRAVITY_MULT : 1;
}
