/**
 * Loads the set log and validates it at the boundary. The data is the StrengthLevel
 * export (src/data/ud.csv), bundled into the build so the dashboard works fully
 * offline — open the built index.html directly and it shows the real data.
 *
 * To refresh the numbers later: replace src/data/ud.csv with a new export and
 * rebuild (npm run build).
 */
import { parseRows, sanityCheck, type ParseResult, type SanityWarning } from "./domain";
import { canonicalizeExerciseNames, type ExerciseMerge } from "./aggregate";
import { attachNoteLevel } from "./variants";
import { parseCsv } from "./csv";
import csvText from "./data/ud.csv?raw";

export interface LoadedData extends ParseResult {
  updatedAt: string | null;
  warnings: SanityWarning[];
  /** Variant exercise spellings that were folded into one canonical name. */
  merges: ExerciseMerge[];
  /** The raw CSV text exactly as bundled, for the "Data" inspection tab. */
  rawCsv: string;
}

export async function loadData(): Promise<LoadedData> {
  return buildLoaded(csvText);
}

/** Parse + canonicalise a CSV string through the same pipeline loadData uses, so a
 * freshly-fetched CSV becomes a LoadedData identical in shape to the bundled one. */
export function buildLoaded(csv: string): LoadedData {
  const rawRows = parseCsv(csv);
  const parsed = parseRows(rawRows);
  // Fold variant spellings of the same exercise into one name. This is done in
  // the app (not the source sheet) because re-exports would otherwise bring the
  // same variants back. Raw names are preserved on each record.
  const { records: canon, merges } = canonicalizeExerciseNames(parsed.records);
  // Then read any squat-rack hole logged in the note (SQ8) and attach it to the
  // set as a per-set LEVEL — without renaming the exercise, so every hole stays
  // one exercise. Done after canonicalisation so it's consistent in every view.
  const records = canon.map(attachNoteLevel);
  // Sanity-check the canonicalised records so warnings reference displayed names.
  return { ...parsed, records, merges, updatedAt: null, warnings: sanityCheck(records), rawCsv: csv };
}

// ── Supabase fetch path ───────────────────────────────────────────────────────

import { fetchSets, type DbSet } from "./supabase";

/** Map a DB row to the shape parseRows expects, then run the same pipeline. */
function dbSetToRawRow(row: DbSet): Record<string, string> {
  return {
    user: row.user_id,           // user field in SetRecord
    username: row.username,
    date: row.date,
    bodyweight: row.bodyweight == null ? "" : String(row.bodyweight),
    exercise_name: row.exercise_name,
    set_number: String(row.set_number),
    weight: row.weight == null ? "" : String(row.weight),
    reps: row.reps == null ? "" : String(row.reps),
    notes: row.notes,
    dropset: row.dropset ? "true" : "false",
    percentile: row.percentile == null ? "" : String(row.percentile),
  };
}

/** Fetch the current user's sets from Supabase and run them through the same
 *  pipeline as the bundled CSV, so all downstream compute is unchanged. */
export async function fetchFromSupabase(): Promise<LoadedData | null> {
  try {
    const rows = await fetchSets();
    if (rows.length === 0) return null;
    const rawRows = rows.map(dbSetToRawRow);
    const parsed = parseRows(rawRows);
    const { records: canon, merges } = canonicalizeExerciseNames(parsed.records);
    const records = canon.map(attachNoteLevel);
    return {
      ...parsed,
      records,
      merges,
      updatedAt: rows[0]?.imported_at ?? null,
      warnings: sanityCheck(records),
      rawCsv: "",
    };
  } catch {
    return null;
  }
}

/** Raw URL of the live ud.csv on the deploy branch. The site is rebuilt from this
 * same file, but the Refresh-data Action can commit a newer CSV a minute before the
 * rebuild finishes — so fetching it lets the dashboard show fresh numbers sooner. */
const GITHUB_CSV_URL =
  "https://raw.githubusercontent.com/adomasgaudi/Data/claude/strength-training-dashboard-SdAlT/src/data/ud.csv";

/** Fetch the latest ud.csv from GitHub. Returns the text, or null on any failure
 * (offline, private repo, timeout, non-CSV) so the caller silently keeps the bundled
 * data. Never throws. */
export async function fetchLatestCsv(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(GITHUB_CSV_URL, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    // Guard against an error page / empty body — must look like the real CSV.
    return text.length > 100 && text.includes(",") ? text : null;
  } catch {
    return null;
  }
}
