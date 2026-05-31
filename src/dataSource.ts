/**
 * Loads the set log and validates it at the boundary. The data is the StrengthLevel
 * export (src/data/ud.csv), bundled into the build so the dashboard works fully
 * offline — open the built index.html directly and it shows the real data.
 *
 * To refresh the numbers later: replace src/data/ud.csv with a new export and
 * rebuild (npm run build).
 */
import { parseRows, sanityCheck, type ParseResult, type SanityWarning } from "./domain";
import { parseCsv } from "./csv";
import csvText from "./data/ud.csv?raw";

export interface LoadedData extends ParseResult {
  updatedAt: string | null;
  warnings: SanityWarning[];
}

export async function loadData(): Promise<LoadedData> {
  const rawRows = parseCsv(csvText);
  const parsed = parseRows(rawRows);
  return { ...parsed, updatedAt: null, warnings: sanityCheck(parsed.records) };
}
