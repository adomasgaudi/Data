/**
 * Squat-rack LEVEL for push-up-style bodyweight lifts. An incline push-up done
 * with the hands on a squat-rack bar is easier the higher the bar; the owner
 * logs which hole in the note ("SQ8"). Rather than splitting that into separate
 * exercises, the hole is a per-set "quantified selection": like the weight on a
 * bar, but instead of added kilos it picks a BODYWEIGHT-PART. So "Push Ups" stays
 * ONE exercise; each set just carries which hole it was done at, and a per-hole
 * bodyweight-% (the scaling) turns that into the effective load. Pure + tested.
 *
 * Lower hole = hands lower = nearer the floor = HARDER (more of your weight).
 */
import type { SetRecord } from "./domain";

export type LevelDim = "sq";

export interface ParsedLevel {
  dim: LevelDim;
  /** The squat-rack hole (can be negative for below-hole-1 / decline). */
  value: number;
  /** Short tag for display, e.g. "SQ8". */
  label: string;
  /** The matched substring, so it can be peeled out of the leftover note. */
  matched: string;
}

/** The short tag for a hole, e.g. 8 → "SQ8". */
export function levelLabel(value: number): string {
  return `SQ${Math.round(value)}`;
}

/**
 * Read a squat-rack hole out of a logged note, or null if there isn't one.
 * Accepts the spellings the owner actually uses: "SQ8", "sq3", "Sq 5", "SQ-1",
 * "Squat rack 6". Anything else stays a plain note.
 */
export function parseLevelNote(note: string | null | undefined): ParsedLevel | null {
  const raw = (note ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/\bsq\s*(-?\d+)\b/i) ?? raw.match(/\bsquat\s*rack\s*(-?\d+)\b/i);
  if (!m) return null;
  const value = parseInt(m[1]!, 10);
  if (!Number.isFinite(value)) return null;
  return { dim: "sq", value, label: levelLabel(value), matched: m[0] };
}

/**
 * Attach a squat-rack level to a logged set, read from its note, WITHOUT changing
 * the exercise name — so every hole stays one exercise. A no-op when the set
 * already carries a level (chosen on the Add form) or the note has no hole in it.
 * The matched token is peeled out of the note so it isn't shown twice; any other
 * note text is kept. Applied once at load (like name canonicalisation).
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

/** Stable key for a per-exercise, per-hole bodyweight-% override, e.g.
 * "Push Ups|sq|8". Used by the on-device scaling store. */
export function levelCoeffKey(exerciseName: string, value: number): string {
  return `${exerciseName}|sq|${value}`;
}

/**
 * A sensible DEFAULT bodyweight-part for a hole, given the lift's base coeff (its
 * floor / no-rack value). Only a starting point — the owner tunes each hole's %
 * by eye. Higher hole = hands higher = more upright = easier ⇒ less bodyweight;
 * lower/negative holes are nearer the floor / decline ⇒ harder. Clamped sane.
 */
export function defaultLevelCoeff(baseCoeff: number, value: number): number {
  const x = baseCoeff * (1 - 0.06 * value);
  return Math.max(0.1, Math.min(1, Math.round(x * 100) / 100));
}
