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
  setNumber: number;
  weight: number | null;
  /** When the row's weight has been replaced by a bodyweight-inclusive load for
   * 1RM calculation, this holds the originally-logged weight for display. */
  origWeight?: number | null;
  reps: number | null;
  notes: string;
  dropset: boolean;
  percentile: number | null;
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
