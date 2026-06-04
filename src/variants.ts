/**
 * Technique LEVELS for lifts that are made easier/harder by a setup change rather
 * than by the weight — done at a squat-rack hole ("SQ8") or at a height in
 * centimetres ("43cm"). The owner logs it in the note; here we read it into a
 * per-set level so the set keeps its real weight & 1RM, but carries a TECHNIQUE
 * SCALING FACTOR used only to produce a separate "scaled effort 1RM" for lining
 * up sets done at different difficulties. The exercise name never changes — every
 * level is ONE exercise. Pure + tested.
 *
 *   • squat-rack hole  "SQ8" / "sq3" / "Squat rack 6"   → dim "sq"
 *   • centimetres      "43cm" / "10 cm" / "Pakelta 10cm" → dim "cm"
 */
import type { SetRecord } from "./domain";

export type LevelDim = "sq" | "cm";

export interface ParsedLevel {
  dim: LevelDim;
  /** The setting: squat-rack hole (can be negative) or centimetres. */
  value: number;
  /** Short tag for display, e.g. "SQ8" or "43cm". */
  label: string;
  /** The matched substring, so it can be peeled out of the leftover note. */
  matched: string;
}

/** The short tag for a level, e.g. ("sq",8) → "SQ8", ("cm",43) → "43cm". */
export function levelLabel(dim: LevelDim, value: number): string {
  return dim === "sq" ? `SQ${value}` : `${value}cm`;
}

/**
 * Read a technique level out of a logged note, or null if there isn't one.
 * Accepts the spellings the owner uses: a squat-rack hole ("SQ8", "sq3", "Sq 5",
 * "SQ-1", "Squat rack 6") or a height in centimetres ("43cm", "10 cm").
 */
export function parseLevelNote(note: string | null | undefined): ParsedLevel | null {
  const raw = (note ?? "").trim();
  if (!raw) return null;
  // Centimetres first (it carries an explicit unit).
  const cm = raw.match(/(-?\d+(?:[.,]\d+)?)\s*cm\b/i);
  if (cm) {
    const value = Math.round(parseFloat(cm[1]!.replace(",", ".")));
    if (Number.isFinite(value)) return { dim: "cm", value, label: levelLabel("cm", value), matched: cm[0] };
  }
  const sq = raw.match(/\bsq\s*(-?\d+)\b/i) ?? raw.match(/\bsquat\s*rack\s*(-?\d+)\b/i);
  if (sq) {
    const value = parseInt(sq[1]!, 10);
    if (Number.isFinite(value)) return { dim: "sq", value, label: levelLabel("sq", value), matched: sq[0] };
  }
  return null;
}

/**
 * Attach a technique level to a logged set, read from its note, WITHOUT changing
 * the exercise name. A no-op when the set already carries a level (chosen on the
 * Add form) or the note has no recognised level. The matched token is peeled out
 * of the note so it isn't shown twice; any other note text is kept. Applied once
 * at load (like name canonicalisation).
 */
export function attachNoteLevel(record: SetRecord): SetRecord {
  if (record.levelDim !== undefined) return record;
  const lv = parseLevelNote(record.notes);
  if (!lv) return record;
  const leftover = record.notes
    .replace(lv.matched, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:+-]+|[\s,;:+-]+$/g, "")
    .trim();
  return { ...record, levelDim: lv.dim, levelValue: lv.value, levelLabel: lv.label, notes: leftover };
}

/** Stable key for a per-exercise, per-level scaling-factor override, e.g.
 * "Push Ups|sq|8" or "Dips|cm|43". Used by the on-device technique-scale store. */
export function levelKey(exerciseName: string, dim: LevelDim, value: number): string {
  return `${exerciseName}|${dim}|${value}`;
}

/**
 * A sensible DEFAULT technique scaling factor for a level — only a starting point,
 * the owner tunes each by eye so equal-effort levels line up. For a squat-rack
 * hole, hole 0 (floor) is the ×1 reference; higher holes are easier ⇒ scaled down
 * (<1), lower/negative holes harder ⇒ scaled up (>1). Centimetres are ambiguous
 * (deficit vs assisting height), so they default to ×1 for the owner to set.
 */
export function defaultLevelScale(dim: LevelDim, value: number): number {
  if (dim !== "sq") return 1;
  const x = 1 - 0.06 * value;
  return Math.max(0.1, Math.min(3, Math.round(x * 100) / 100));
}
