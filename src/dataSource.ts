/**
 * Loads the set log and validates it at the boundary. Returns typed records
 * plus any per-row issues and sanity warnings so the UI can show data health.
 */
import { DATA_URL } from "./config";
import { DataEnvelopeSchema, parseRows, sanityCheck, type ParseResult, type SanityWarning } from "./domain";
import sampleData from "./fixtures/sample.json";

export interface LoadedData extends ParseResult {
  updatedAt: string | null;
  warnings: SanityWarning[];
  /** True when we fell back to the bundled fixture (no live URL configured/reachable). */
  usingFixture: boolean;
}

function finalize(rawRows: unknown[], updatedAt: string | null, usingFixture: boolean): LoadedData {
  const parsed = parseRows(rawRows);
  return { ...parsed, updatedAt, warnings: sanityCheck(parsed.records), usingFixture };
}

export async function loadData(): Promise<LoadedData> {
  if (!DATA_URL) {
    const env = DataEnvelopeSchema.parse(sampleData);
    return finalize(env.rows, env.updatedAt ?? null, true);
  }

  const res = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Data endpoint returned HTTP ${res.status}`);

  const json: unknown = await res.json();
  const env = DataEnvelopeSchema.parse(json); // fail loud on contract drift
  return finalize(env.rows, env.updatedAt ?? null, false);
}
