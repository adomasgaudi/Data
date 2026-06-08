/**
 * Domain model + boundary validation.
 *
 * Everything the dashboard computes on flows through `parseRows`. The external
 * data (StrengthLevel, ingested by the Apps Script into the "UD" sheet and
 * served as JSON) is messy: numeric cells can be numbers, numeric strings, or
 * "" for missing. We parse it ONCE into a strict, typed `SetRecord` and never
 * touch the raw shape again. Anything that fails the schema is collected as an
 * issue rather than silently coerced — this is the AI-development safety net:
 * the boundary fails loud, so downstream pure functions can trust their inputs.
 */
import { z } from "zod";

/** Column order emitted by the Apps Script (OUTPUT_COLUMNS). Kept for reference. */
export const SOURCE_COLUMNS = [
  "user",
  "username",
  "date",
  "bodyweight",
  "exercise_name",
  "set_number",
  "weight",
  "reps",
  "notes",
  "dropset",
  "percentile",
] as const;

/** A single working set — the atomic unit everything is computed from. */
export interface SetRecord {
  user: string;
  username: string;
  /** ISO date "yyyy-MM-dd". */
  date: string;
  bodyweight: number | null;
  exerciseName: string;
  /** The originally-logged name before same-exercise canonicalisation merged
   * variant spellings. Only set when the displayed name differs from the raw
   * one, so the original data is never lost. */
  originalExerciseName?: string;
  setNumber: number;
  weight: number | null;
  /** When the row's weight has been replaced by a bodyweight-inclusive load for
   * 1RM calculation, this holds the originally-logged weight for display. */
  origWeight?: number | null;
  reps: number | null;
  notes: string;
  dropset: boolean;
  percentile: number | null;
  /** Leverage LEVEL on a bodyweight lift whose difficulty is set by geometry,
   * not added weight (e.g. an incline push-up at squat-rack hole 8). It's a
   * per-set "quantified selection" — like the weight on a bar, but it picks a
   * BODYWEIGHT-PART rather than added kilos, so every height stays ONE exercise.
   * `levelDim` is the dimension (squat-rack hole / Smith notch / cm), `levelValue`
   * the setting and `levelLabel` its short tag ("SQ8", "Sm3", "43cm"). Parsed from
   * the note at load, or chosen on the Add form. */
  levelDim?: "sq" | "cm" | "smith";
  levelValue?: number;
  levelLabel?: string;
  /** Set when the exercise is marked "not comparable" (e.g. a static push against
   * the ground): its reps/sets still count, but no 1RM or volume is computed —
   * those numbers are meaningless. Tagged from a per-exercise override at compute. */
  notComparable?: boolean;
  /** Per-NOTE variation difficulty (×1 = baseline). When set (and ≠ 1) the 1RM
   * scales the effective load by it before peeling bodyweight, so an easier
   * bodyweight variation (e.g. a partial/assisted handstand push-up at ×0.53)
   * reports a lower — possibly negative — added-weight 1RM. Stamped by the app's
   * computeRecord; absent on raw records (treated as ×1). */
  difficultyMult?: number;
  /** Band assistance in KILOGRAMS — a band removes a roughly constant force, so it
   * is SUBTRACTED from the (multiplier-scaled) load before the 1RM curve, not
   * multiplied. Stamped by computeRecord; absent / 0 means no band. */
  assistKg?: number;
  /** Machine-type verdict for a gravity-or-cable lift (e.g. Lat Pulldown) when the
   * exercise is in "gravity" or "mixed" mode. "gravity" means the strength weight
   * was scaled to its cable-equivalent (×0.6, logged value kept in origWeight);
   * "review" means a mixed-mode set was too ambiguous to trust and needs checking.
   * Absent on cable / unconfigured exercises. */
  machineType?: "gravity" | "cable" | "review";
  /** Set on SYNTHETIC records only: the id of the combinable/comparable registry
   * group this record was derived for (e.g. "combine.sq-mix", "compare.dl-pattern").
   * Pure logged records never carry it. Lets views/filters tell synthetics apart. */
  syntheticGroupId?: string;
  /** What kind of exercise this record represents (see ExerciseIdentity). Absent
   * on plain logged sets, which read as "original" via exerciseIdentity(). */
  identity?: ExerciseIdentity;
  /** Relationship links (see ExerciseRelationship). IDs here are exercise NAMES —
   * this app identifies exercises by name. All optional; plain lifts have none.
   *   • parentExerciseId    — for a `dissolved` lift: the original it folds into.
   *   • includedExerciseIds — for `combined` / `comparison_group`: the member lifts.
   *   • relationshipType    — names the relationship (defaults via exerciseRelationship). */
  parentExerciseId?: string;
  includedExerciseIds?: string[];
  relationshipType?: ExerciseRelationship;
}

/**
 * The "identity" of an exercise record — how the lift it represents came to be.
 * A small, open enum the views can branch on; everything real defaults to
 * "original" so existing data needs no migration.
 *   • original         — a genuinely logged lift (the default for every set).
 *   • dissolved        — a lift whose sets have been folded into another identity
 *                        (reserved for upcoming merge/split work; nothing emits it yet).
 *   • combined         — a synthetic record merging several lifts into one series.
 *   • comparison_group — a synthetic record standing in for a comparison group.
 */
export const EXERCISE_IDENTITIES = ["original", "dissolved", "combined", "comparison_group"] as const;
export type ExerciseIdentity = (typeof EXERCISE_IDENTITIES)[number];

/**
 * The identity of a record. An explicit `identity` field wins; otherwise it's
 * derived from the synthetic-group id (`combine.*` → combined, `compare.*` →
 * comparison_group). A plain logged set is "original". Total and safe on existing
 * data: a record with neither field reads as "original".
 */
export function exerciseIdentity(
  r: Pick<SetRecord, "identity" | "syntheticGroupId">,
): ExerciseIdentity {
  if (r.identity) return r.identity;
  const g = r.syntheticGroupId;
  if (g?.startsWith("combine.")) return "combined";
  if (g?.startsWith("compare.")) return "comparison_group";
  return "original";
}

/**
 * How an exercise relates to others — the verb that pairs with its identity:
 *   • none          — a standalone lift (the default).
 *   • dissolved_into— this lift's sets fold into a parent (parentExerciseId).
 *   • combined_from — a merged lift built from several members (includedExerciseIds).
 *   • comparison_of — a comparison group over several members (includedExerciseIds).
 */
export const EXERCISE_RELATIONSHIPS = ["none", "dissolved_into", "combined_from", "comparison_of"] as const;
export type ExerciseRelationship = (typeof EXERCISE_RELATIONSHIPS)[number];

/**
 * The relationship of a record. An explicit `relationshipType` wins; otherwise it
 * is derived from the identity (combined → combined_from, comparison_group →
 * comparison_of, dissolved → dissolved_into). A plain logged set is "none". Total
 * and safe on existing data.
 */
export function exerciseRelationship(
  r: Pick<SetRecord, "identity" | "syntheticGroupId" | "relationshipType">,
): ExerciseRelationship {
  if (r.relationshipType) return r.relationshipType;
  switch (exerciseIdentity(r)) {
    case "combined":
      return "combined_from";
    case "comparison_group":
      return "comparison_of";
    case "dissolved":
      return "dissolved_into";
    default:
      return "none";
  }
}

/** The member exercise names a combined / comparison record is built from (the
 * `includedExerciseIds`), or [] for a lift that includes nothing. */
export function includedExercises(r: Pick<SetRecord, "includedExerciseIds">): string[] {
  return r.includedExerciseIds ?? [];
}

/** "" / null / undefined -> null; otherwise coerce to a finite number or fail. */
const numericOrNull = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `not a number: ${JSON.stringify(v)}` });
      return z.NEVER;
    }
    return n;
  });

/** Truthy across the shapes the sheet/API produce: true, 1, "1", "true", "yes". */
const looseBoolean = z
  .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === true || v === 1) return true;
    if (typeof v === "string") return ["1", "true", "yes", "y"].includes(v.trim().toLowerCase());
    return false;
  });

const stringOrEmpty = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? "" : String(v)).trim());

/** Schema for one raw row object as served by the JSON endpoint. */
export const RawSetRowSchema = z
  .object({
    user: stringOrEmpty,
    username: stringOrEmpty,
    date: stringOrEmpty,
    bodyweight: numericOrNull,
    exercise_name: stringOrEmpty,
    set_number: numericOrNull,
    weight: numericOrNull,
    reps: numericOrNull,
    notes: stringOrEmpty,
    dropset: looseBoolean,
    percentile: numericOrNull,
  })
  .transform(
    (r): SetRecord => ({
      user: r.user,
      username: r.username,
      date: r.date,
      bodyweight: r.bodyweight,
      exerciseName: r.exercise_name,
      setNumber: r.set_number ?? 0,
      weight: r.weight,
      reps: r.reps,
      notes: r.notes,
      dropset: r.dropset,
      percentile: r.percentile,
    }),
  );

/** Envelope returned by the data endpoint. */
export const DataEnvelopeSchema = z.object({
  updatedAt: z.string().optional(),
  rows: z.array(z.unknown()),
});

export interface ParseResult {
  records: SetRecord[];
  /** Per-row rejections (row index + zod message). Surfaced in the UI. */
  issues: { index: number; message: string }[];
}

/**
 * Parse an array of raw rows into typed records. A row that fails validation is
 * dropped and recorded in `issues` rather than throwing — one bad row should not
 * blank the whole dashboard, but it must be visible.
 */
export function parseRows(rawRows: unknown[]): ParseResult {
  const records: SetRecord[] = [];
  const issues: ParseResult["issues"] = [];

  rawRows.forEach((raw, index) => {
    const parsed = RawSetRowSchema.safeParse(raw);
    if (parsed.success) {
      records.push(parsed.data);
    } else {
      issues.push({ index, message: parsed.error.issues.map((i) => i.message).join("; ") });
    }
  });

  return { records, issues };
}

/** Plausibility bounds. Outside these almost certainly signals a data/unit bug. */
export const SANITY = {
  weightKg: { min: 0, max: 600 },
  reps: { min: 0, max: 100 },
  bodyweightKg: { min: 20, max: 400 },
  percentile: { min: 0, max: 100 },
} as const;

export interface SanityWarning {
  field: keyof typeof SANITY;
  value: number;
  record: SetRecord;
}

/**
 * Range-check parsed records. Returns warnings (not errors) — these are the
 * dashboard's "eyes" on data it cannot eyeball: a 2000 kg bench surfaces here
 * instead of silently winning a leaderboard.
 */
export function sanityCheck(records: SetRecord[]): SanityWarning[] {
  const warnings: SanityWarning[] = [];
  const check = (field: keyof typeof SANITY, value: number | null, record: SetRecord) => {
    if (value === null) return;
    const { min, max } = SANITY[field];
    if (value < min || value > max) warnings.push({ field, value, record });
  };
  for (const r of records) {
    check("weightKg", r.weight, r);
    check("reps", r.reps, r);
    check("bodyweightKg", r.bodyweight, r);
    check("percentile", r.percentile, r);
  }
  return warnings;
}
