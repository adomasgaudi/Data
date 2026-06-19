/**
 * Handstand LEAN model (docs/handstand-lean-model.md) — PURE math, no DOM/storage.
 *
 * The lean of a handstand (wall-touch / leaning HSPU / leaning kicks) is the distance
 * from the HANDS to the wall. We store ONE canonical number: the cm from the BASE OF
 * THE PALM (the pivot / lever origin) to the wall. You may MEASURE from any of four
 * hand points, in cm or as a yoga-block side; this module converts that reading to the
 * canonical palm-base cm. Per the owner's locked decisions:
 *   • ONE per-person hand measurement: fingertips → palm-base length L (owner ≈ 16cm).
 *     The in-between points are estimated as fractions of L (≈ half palm / half fingers).
 *   • A yoga block = ONE block, 3 sides ≈ 5 / 15 / 23 cm (small / medium / large).
 *   • Reading at a point that is `offset` cm toward the wall from the palm-base reads a
 *     SHORTER gap, so: canonical = reading + offset(point)  (owner: "3cm from the
 *     fingertips" + ~16cm tips→base ⇒ ~19cm from the base).
 */

export type HandPoint = "fingertips" | "fingerKnuckles" | "knuckles" | "base";

/** Each hand point's position from the palm-base as a FRACTION of the hand length L
 * (base = 0 … fingertips = 1). Anatomical ~half-palm / half-fingers; calibratable. */
export const HAND_POINT_FRACTION: Record<HandPoint, number> = {
  base: 0,
  knuckles: 0.5,      // MCP — where the palm meets the fingers
  fingerKnuckles: 0.7, // PIP — the first finger joint (owner's usual measuring point)
  fingertips: 1.0,
};

/** The owner's default fingertips→palm-base length (cm); overridable per athlete. */
export const DEFAULT_HAND_LENGTH_CM = 16;

/** Owner's usual measuring point — the default the picker pre-selects (shown, not tagged). */
export const DEFAULT_HAND_POINT: HandPoint = "fingerKnuckles";

export type YogaBlockSide = "small" | "medium" | "large";
/** One yoga block, read by the side it stands on (owner-confirmed cm). */
export const YOGA_BLOCK_CM: Record<YogaBlockSide, number> = { small: 5, medium: 15, large: 23 };

/** Offset (cm) from the palm-base to `point`, for a hand of length `handLengthCm`. */
export function handPointOffsetCm(point: HandPoint, handLengthCm: number = DEFAULT_HAND_LENGTH_CM): number {
  return HAND_POINT_FRACTION[point] * handLengthCm;
}

/** Canonical lean (cm from the palm-base to the wall) from a cm reading taken at `point`. */
export function leanCanonicalCm(readingCm: number, point: HandPoint, handLengthCm: number = DEFAULT_HAND_LENGTH_CM): number {
  return readingCm + handPointOffsetCm(point, handLengthCm);
}

/** Canonical lean from a yoga-block reading (the block side fills the gap at `point`). */
export function leanCanonicalFromBlock(side: YogaBlockSide, point: HandPoint, handLengthCm: number = DEFAULT_HAND_LENGTH_CM): number {
  return leanCanonicalCm(YOGA_BLOCK_CM[side], point, handLengthCm);
}

/** Snap a canonical cm to the NEAREST existing lean level key (e.g. "0cm".."23cm"), so a
 * converted reading maps onto the family's discrete `lean` levels without a resolver change.
 * `levelKeys` are the lean dimension's keys; the numeric cm is parsed from each. */
export function snapToLeanLevelCm(canonicalCm: number, levelKeys: readonly string[]): string {
  let best = levelKeys[0] ?? "0cm";
  let bestDiff = Infinity;
  for (const k of levelKeys) {
    const n = parseFloat(k); // "18cm" → 18, "-5cm" → -5
    if (!Number.isFinite(n)) continue;
    const d = Math.abs(n - canonicalCm);
    if (d < bestDiff) { bestDiff = d; best = k; }
  }
  return best;
}

// ── Wall-tap CONTACT (what touches the wall × rest vs light tap) ────────────────
// One tag for the handstand WALL-TAP touch variation. Two attributes (what contacts:
// hips+shoulders vs shoulders-only; and contact: rest vs light tap) → 4 levels. Short
// CODE on the chip, full wording in the picker menu. Owner-confirmed order easiest→hardest.

export type TapContact = "hips_rest" | "sh_rest" | "hips_tap" | "sh_tap";

/** Easiest → hardest (owner-confirmed): more support (hips+shoulders) and resting are easier. */
export const TAP_CONTACT_ORDER: readonly TapContact[] = ["hips_rest", "sh_rest", "hips_tap", "sh_tap"];

/** Short chip label (a code; the full meaning lives in TAP_CONTACT_HINT). */
export const TAP_CONTACT_LABEL: Record<TapContact, string> = {
  hips_rest: "HS·rest",
  sh_rest: "Sh·rest",
  hips_tap: "HS·tap",
  sh_tap: "Sh·tap",
};

/** Picker-menu explanation (small-grey), so the chip stays short. */
export const TAP_CONTACT_HINT: Record<TapContact, string> = {
  hips_rest: "Hips + shoulders, resting on the wall — easiest",
  sh_rest: "Shoulders only, resting on the wall",
  hips_tap: "Hips + shoulders, light tap",
  sh_tap: "Shoulders only, light tap — hardest",
};

// The DIFFICULTY FACTORS for these levels live in the FAMILIES config (variationConfig.ts,
// HANDSTAND.dims.tapContact) — the one place the resolver reads — so they're not duplicated here.
