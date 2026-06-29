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

/** Match a cm-level KEY like "+25cm" / "0cm" / "-3cm" (the rom/lean dim key shape). */
const CM_KEY_RE = /^[+-]?\d+(\.\d+)?cm$/;

/** Parse a cm level KEY ("+23cm", "0cm", "-3cm") back to a numeric cm value. */
export function parseCmLevelKey(key: string): number | undefined {
  if (!CM_KEY_RE.test(key)) return undefined;
  const n = parseFloat(key);
  return Number.isFinite(n) ? n : undefined;
}

/** Pick the yoga-block side whose cm height is nearest to `cm` (blocks are positive heights). */
export function nearestYogaBlockSide(cm: number): YogaBlockSide {
  const target = Math.max(0, cm);
  let best: YogaBlockSide = "small";
  let bestDiff = Infinity;
  for (const side of ["small", "medium", "large"] as const) {
    const d = Math.abs(YOGA_BLOCK_CM[side] - target);
    if (d < bestDiff) { bestDiff = d; best = side; }
  }
  return best;
}

/** Format a cm value as a level KEY in the table's style: "+32cm" / "0cm" / "-3cm".
 * The inverse of parsing a key with parseFloat — lets a CONTINUOUS cm picker store an
 * exact value (e.g. the owner's 32cm) as a key, instead of snapping to a preset level. */
export function cmLevelKey(cm: number): string {
  const n = Math.round(cm);
  return n > 0 ? `+${n}cm` : `${n}cm`; // n<=0 → "0cm" / "-3cm" (Math.round(-0)===0)
}

/** Linear interpolate / extrapolate a multiplier for a CM-KEYED dimension table (keys
 * like "+25cm".."-20cm", each → a difficulty factor). Returns the factor for `level` (a
 * cm key, possibly NOT present in the table — e.g. "+32cm"), or undefined if the table or
 * `level` isn't cm-shaped (so callers can safely fall through for non-cm dims). Between
 * anchors it interpolates; beyond the ends it extrapolates along the nearest segment,
 * clamped to a small positive floor so the factor can never go ≤0. This is what makes ROM
 * continuous: any typed cm gets a smooth difficulty, not a snapped preset. */
export function interpCmFactor(table: Record<string, number>, level: string): number | undefined {
  if (!CM_KEY_RE.test(level)) return undefined;
  const target = parseFloat(level);
  const pts = Object.keys(table)
    .filter((k) => CM_KEY_RE.test(k))
    .map((k) => ({ cm: parseFloat(k), f: table[k]! }))
    .filter((p) => Number.isFinite(p.cm) && Number.isFinite(p.f))
    .sort((a, b) => a.cm - b.cm);
  if (pts.length < 2) return pts.length === 1 ? pts[0]!.f : undefined;
  const at = (a: { cm: number; f: number }, b: { cm: number; f: number }): number => {
    const f = a.f + ((b.f - a.f) / (b.cm - a.cm)) * (target - a.cm);
    return Math.max(0.05, Math.round(f * 1e4) / 1e4); // floor so it never goes ≤0
  };
  const last = pts.length - 1;
  if (target <= pts[0]!.cm) return target === pts[0]!.cm ? pts[0]!.f : at(pts[0]!, pts[1]!);
  if (target >= pts[last]!.cm) return target === pts[last]!.cm ? pts[last]!.f : at(pts[last - 1]!, pts[last]!);
  for (let i = 0; i < last; i++) if (target >= pts[i]!.cm && target <= pts[i + 1]!.cm) return at(pts[i]!, pts[i + 1]!);
  return undefined;
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
