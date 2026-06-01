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
import { parseCsv } from "./csv";
import csvText from "./data/ud.csv?raw";

export interface LoadedData extends ParseResult {
  updatedAt: string | null;
  warnings: SanityWarning[];
  /** Variant exercise spellings that were folded into one canonical name. */
  merges: ExerciseMerge[];
}

export async function loadData(): Promise<LoadedData> {
  const rawRows = parseCsv(csvText);
  const parsed = parseRows(rawRows);
  // Fold variant spellings of the same exercise into one name. This is done in
  // the app (not the source sheet) because re-exports would otherwise bring the
  // same variants back. Raw names are preserved on each record.
  const { records, merges } = canonicalizeExerciseNames(parsed.records);
  // Sanity-check the canonicalised records so warnings reference displayed names.
  return { ...parsed, records, merges, updatedAt: null, warnings: sanityCheck(records) };
}
