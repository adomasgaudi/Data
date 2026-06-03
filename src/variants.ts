/**
 * Leverage variants for bodyweight lifts whose difficulty is set by GEOMETRY,
 * not added weight — an incline push-up at squat-rack hole 8 is far easier than
 * one on the floor, yet both log as "Push Ups". The owner records the setting in
 * the free-text note (e.g. "SQ8", "10cm", "5 level"); here we parse that note
 * into a concrete VARIANT so each height becomes its own tracked exercise
 * ("Push Ups (SQ8)") and can be scaled onto one curve.
 *
 * Three accepted encodings (everything else stays a plain note):
 *   • squat-rack hole   "SQ8", "sq3", "Sq 5", "SQ-1", "Squat rack 6"  → dim "sq"
 *   • centimetres       "10cm", "23cm uninterrupted", "Pakelta 10cm"  → dim "cm"
 *   • smith / level     "5 level", "Level 5.5", "9lygis", "Smith 3"    → dim "smith"
 * The smith/level reading only applies to push-up / smith exercises (so a stray
 * "5 level" note elsewhere is left alone). Pure + unit-tested.
 */
import type { SetRecord } from "./domain";

export type VariantDim = "sq" | "cm" | "smith";

export interface ParsedVariant {
  dim: VariantDim;
  /** The numeric setting: rack hole (can be negative), centimetres, or level. */
  value: number;
  /** Short tag folded into the exercise name, e.g. "SQ8", "10cm", "L5.5". */
  label: string;
  /** The matched substring, so it can be peeled out of the leftover note. */
  matched: string;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
/** Trim a number for display: 5 → "5", 5.5 → "5.5" (no trailing ".0"). */
const numText = (n: number): string => (Number.isInteger(n) ? String(n) : String(round1(n)));
const toNum = (s: string): number => parseFloat(s.replace(",", "."));

const isPushOrSmith = (base: string): boolean => /push|smith|pike|handstand/i.test(base);

/**
 * Parse a logged note into a leverage variant, or null if it carries no
 * recognised setting. `baseName` gates the smith/level reading to push-up-style
 * lifts. cm and squat-rack are recognised on any lift.
 */
export function parseVariantNote(baseName: string, note: string | null | undefined): ParsedVariant | null {
  const raw = (note ?? "").trim();
  if (!raw) return null;

  // 1) Centimetres — "10cm", "23cm uninterrupted", "Pakelta 10cm".
  const cm = raw.match(/(-?\d+(?:[.,]\d+)?)\s*cm\b/i);
  if (cm) {
    const value = Math.round(toNum(cm[1]!));
    return { dim: "cm", value, label: `${numText(value)}cm`, matched: cm[0] };
  }

  // 2) Squat-rack hole — "SQ8", "sq 3", "SQ-1", "Squat rack 6".
  const sq = raw.match(/\bsq\s*(-?\d+)\b/i) ?? raw.match(/\bsquat\s*rack\s*(-?\d+)\b/i);
  if (sq) {
    const value = Math.round(toNum(sq[1]!));
    return { dim: "sq", value, label: `SQ${value}`, matched: sq[0] };
  }

  // 3) Smith / level — only on push-up-style lifts. "Smith 3", "5 level",
  //    "Level 5.5", "9lygis", or a note that is just a number ("3").
  if (isPushOrSmith(baseName)) {
    const smith =
      raw.match(/\bsmith\s*(\d+(?:[.,]\d+)?)/i) ??
      raw.match(/\b(?:level|lygis)\s*(\d+(?:[.,]\d+)?)/i) ??
      raw.match(/(\d+(?:[.,]\d+)?)\s*(?:level|lygis)/i) ??
      raw.match(/^(\d+(?:[.,]\d+)?)$/);
    if (smith) {
      const value = round1(toNum(smith[1]!));
      return { dim: "smith", value, label: `L${numText(value)}`, matched: smith[0] };
    }
  }
  return null;
}

/** The variant exercise name: the base with the tag appended, e.g.
 * "Push Ups" + "SQ8" → "Push Ups (SQ8)". */
export function variantName(baseName: string, label: string): string {
  return `${baseName} (${label})`;
}

/** True when a name already carries a variant tag we folded in (so it isn't
 * re-parsed from a note). Matches a trailing "(SQ8)" / "(10cm)" / "(L5)". */
export function hasVariantTag(name: string): boolean {
  return /\((?:SQ-?\d+|\d+(?:\.\d+)?cm|L\d+(?:\.\d+)?)\)\s*$/.test(name);
}

/** Split a variant name back into its base and tag, or null if it has none. */
export function splitVariant(name: string): { base: string; label: string } | null {
  const m = name.match(/^(.*?)\s*\((SQ-?\d+|\d+(?:\.\d+)?cm|L\d+(?:\.\d+)?)\)\s*$/);
  return m ? { base: m[1]!, label: m[2]! } : null;
}

/** Reverse of the label: read a folded tag ("SQ8", "10cm", "L5.5") back into its
 * dimension + value, so the seed coeff can be recovered from a variant name. */
export function parseVariantLabel(label: string): ParsedVariant | null {
  let m: RegExpMatchArray | null;
  if ((m = label.match(/^SQ(-?\d+)$/i))) return { dim: "sq", value: parseInt(m[1]!, 10), label, matched: label };
  if ((m = label.match(/^(-?\d+(?:\.\d+)?)cm$/i))) return { dim: "cm", value: Math.round(toNum(m[1]!)), label, matched: label };
  if ((m = label.match(/^L(\d+(?:\.\d+)?)$/i))) return { dim: "smith", value: round1(toNum(m[1]!)), label, matched: label };
  return null;
}

/**
 * Fold a logged set's note into a concrete variant exercise, in place of the
 * plain base name. A no-op when the name already carries a variant tag (a set
 * logged through the Add-form picker) or the note carries no recognised setting.
 * The matched token is peeled out of the note so it isn't shown twice; any other
 * note text is kept. Applied once at load (like name canonicalisation), so every
 * view sees the same variant names.
 */
export function foldNoteVariant(record: SetRecord): SetRecord {
  if (hasVariantTag(record.exerciseName)) return record;
  const pv = parseVariantNote(record.exerciseName, record.notes);
  if (!pv) return record;
  const base = record.exerciseName;
  const leftover = record.notes.replace(pv.matched, "").replace(/\s{2,}/g, " ").replace(/^[\s,;:+-]+|[\s,;:+-]+$/g, "").trim();
  return {
    ...record,
    exerciseName: variantName(base, pv.label),
    originalExerciseName: record.originalExerciseName ?? base,
    notes: leftover,
  };
}

/**
 * A sensible DEFAULT bodyweight-part (coeff) for a freshly-seen variant, given
 * the base lift's coeff and the parsed setting. These are only starting points —
 * the owner tunes each variant's % by eye in the exercise view:
 *   • squat-rack: higher hole = hands higher = more upright = easier ⇒ less
 *     bodyweight. Lower/negative holes are nearer the floor / decline ⇒ harder.
 *   • smith level: same shape — higher level = more incline = easier.
 *   • cm: ambiguous (deficit vs range), so leave the base coeff unchanged.
 * Always clamped to a sane band so a default never goes silly.
 */
export function defaultVariantCoeff(baseCoeff: number, v: ParsedVariant): number {
  const clamp = (x: number) => Math.max(0.1, Math.min(1, round1(x)));
  if (v.dim === "sq") return clamp(baseCoeff * (1 - 0.06 * v.value));
  if (v.dim === "smith") return clamp(baseCoeff * (1 - 0.09 * v.value));
  return clamp(baseCoeff); // cm — keep the base, let the owner set it
}
