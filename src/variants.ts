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

export type LevelDim = "sq" | "cm" | "smith";

export interface ParsedLevel {
  dim: LevelDim;
  /** The setting: squat-rack hole / Smith notch (can be negative) or centimetres. */
  value: number;
  /** Short tag for display, e.g. "SQ8", "Sm3" or "43cm". */
  label: string;
  /** The matched substring, so it can be peeled out of the leftover note. */
  matched: string;
}

/** The short tag for a level, e.g. ("sq",8) → "SQ8", ("smith",3) → "Sm3", ("cm",43) → "43cm". */
export function levelLabel(dim: LevelDim, value: number): string {
  return dim === "sq" ? `SQ${value}` : dim === "smith" ? `Sm${value}` : `${value}cm`;
}

/**
 * Read a technique level out of a logged note, or null if there isn't one.
 * Accepts the spellings the owner uses: a height in centimetres ("43cm", "10 cm"),
 * a Smith-machine notch ("Smith 3", "3 smith") or a squat-rack hole ("SQ8", "sq3",
 * "Sq 5", "3 sq", "Squat rack 6"). cm is matched first (it carries an explicit unit).
 *
 * Push-up incline is ALSO logged loosely — "Ant 3" (LT "on notch 3"), "3 level" /
 * "Level 5.66", "3 lygis" (LT level), or a bare number — so those read as a Smith
 * notch too (fractional half-notches kept). These loose forms are matched globally
 * but only KEPT on the push-up family (attachNoteLevel drops a Smith level on any
 * other lift), so an HSPU "5 lygis" ladder note is never hijacked. NB "ant kelių"
 * (on the KNEES) has no number, so it never matches — it's the position variation.
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
  // Smith-machine notch: "Smith 3", "smith3", "3 smith".
  const smith = raw.match(/\bsmith\s*(-?\d+)\b/i) ?? raw.match(/\b(-?\d+)\s*smith\b/i);
  if (smith) {
    const value = parseInt(smith[1]!, 10);
    if (Number.isFinite(value)) return { dim: "smith", value, label: levelLabel("smith", value), matched: smith[0] };
  }
  // Squat-rack hole: "SQ8", "sq 3", "3 sq", "Squat rack 6".
  const sq = raw.match(/\bsq\s*(-?\d+)\b/i) ?? raw.match(/\bsquat\s*rack\s*(-?\d+)\b/i) ?? raw.match(/\b(-?\d+)\s*sq\b/i);
  if (sq) {
    const value = parseInt(sq[1]!, 10);
    if (Number.isFinite(value)) return { dim: "sq", value, label: levelLabel("sq", value), matched: sq[0] };
  }
  // Loose incline (push-up family, kept only there): "Ant 3", "3 level"/"Level 3",
  // "3 lygis"/"lygis 3", or a note that's just a number. Half-notches allowed.
  const inc =
    raw.match(/\bant\s+(\d+(?:[.,]\d+)?)\b/i) ??
    raw.match(/\blygis\s*(\d+(?:[.,]\d+)?)\b/i) ?? raw.match(/\b(\d+(?:[.,]\d+)?)\s*lygis\b/i) ??
    raw.match(/\blevel\s*(\d+(?:[.,]\d+)?)\b/i) ?? raw.match(/\b(\d+(?:[.,]\d+)?)\s*level\b/i) ??
    raw.match(/^(\d+(?:[.,]\d+)?)$/);
  if (inc) {
    const v0 = parseFloat(inc[1]!.replace(",", "."));
    if (Number.isFinite(v0)) {
      const value = Math.round(v0 * 2) / 2; // nearest half-notch
      return { dim: "smith", value, label: levelLabel("smith", value), matched: inc[0] };
    }
  }
  return null;
}

/** Default cm of incline per equipment STEP — a squat-rack hole or a Smith notch.
 * The canonical incline measure is centimetres; sq & smith notes convert at this
 * step so all three units line up on one cm scale. (~15cm per step; tune per level
 * in the exercise's ⚙ Technique scaling if a level reads off.) */
export const CM_PER_LEVEL_STEP = 15;

/** A level's incline height in CENTIMETRES (the canonical measure): cm as-is; a
 * squat-rack hole / Smith notch × the per-step cm. */
export function levelInclineCm(dim: LevelDim, value: number, cmPerStep: number = CM_PER_LEVEL_STEP): number {
  return dim === "cm" ? value : value * cmPerStep;
}

/** Incline difficulty factor for a push-up done at `cm` of incline: 0cm (hands on
 * the floor — a pure push-up) is the HARDEST, the ×1 reference; raising the hands
 * (more cm) is EASIER (<1); below the floor (negative cm) is harder (>1). The slope
 * is the owner's calibration: ~0.05 per Smith notch, i.e. per 15cm (cm/300). Clamped. */
export function inclineScale(cm: number): number {
  return Math.max(0.4, Math.min(1.6, Math.round((1 - cm / 300) * 100) / 100));
}

/** Exercises whose technique LEVEL is an incline height (the push-up family): their
 * sq / smith / cm levels all read as ONE cm incline that drives {@link inclineScale}
 * — so a Smith-machine incline push-up and a floor push-up sit on one effort scale. */
export function isInclineLevelExercise(name: string): boolean {
  const n = name.toLowerCase();
  // A HANDSTAND push-up is vertical — not an incline — and its "N lygis" / "lad5"
  // notes are LADDER heights for the HSPU model, so it must be excluded (otherwise a
  // loose incline note would hijack them as a Smith notch).
  if (n.includes("handstand") || n.includes("hspu")) return false;
  return n.includes("push up") || n.includes("pushup") || n.includes("push-up");
}

/**
 * Attach a technique level to a logged set, read from its note, WITHOUT changing
 * the exercise name. A no-op when the set already carries a level (chosen on the
 * Add form) or the note has no recognised level. The matched token is peeled out
 * of the note so it isn't shown twice; any other note text is kept. Applied once
 * at load (like name canonicalisation). A Smith-notch level is only kept on the
 * push-up family (where "Smith N" means an incline notch); elsewhere "smith" in a
 * note isn't a level.
 */
export function attachNoteLevel(record: SetRecord): SetRecord {
  if (record.levelDim !== undefined) return record;
  const lv = parseLevelNote(record.notes);
  if (!lv) return record;
  if (lv.dim === "smith" && !isInclineLevelExercise(record.exerciseName)) return record;
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
 * (<1), lower/negative holes harder ⇒ scaled up (>1). Centimetres / Smith notches
 * are ambiguous out of context, so they default to ×1 (the push-up family overrides
 * this with the cm-incline model in levelScaleFor).
 */
export function defaultLevelScale(dim: LevelDim, value: number): number {
  if (dim !== "sq") return 1;
  const x = 1 - 0.06 * value;
  return Math.max(0.1, Math.min(3, Math.round(x * 100) / 100));
}
