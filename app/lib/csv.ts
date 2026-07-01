import Papa from "papaparse";
// The bundled set log, imported as raw text (Vite `?raw`) and parsed with PapaParse
// — replacing the hand-rolled RFC-4180 parser (src/csv.ts) in this new app.
import udCsv from "../../src/data/ud.csv?raw";

export interface SetRow {
  user: string;
  username: string;
  date: string;
  bodyweight: string;
  exercise_name: string;
  set_number: string;
  weight: string;
  reps: string;
  notes: string;
  dropset: string;
  percentile: string;
}

/** Parse CSV text into header-keyed rows using PapaParse. */
export function parseSets(text: string): SetRow[] {
  const res = Papa.parse<SetRow>(text, { header: true, skipEmptyLines: true });
  return res.data;
}

/** The bundled sample data, parsed once at module load. */
export const sampleSets: SetRow[] = parseSets(udCsv);
