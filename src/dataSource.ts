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
  /** True when we fell back to the bundled fixture (live endpoint unreachable). */
  usingFixture: boolean;
  /** Athletes the live fetcher could not resolve (only present for live data). */
  skipped?: string[];
}

function finalize(
  rawRows: unknown[],
  updatedAt: string | null,
  usingFixture: boolean,
  skipped?: string[],
): LoadedData {
  const parsed = parseRows(rawRows);
  const base = { ...parsed, updatedAt, warnings: sanityCheck(parsed.records), usingFixture };
  return skipped ? { ...base, skipped } : base;
}

function loadFixture(): LoadedData {
  const env = DataEnvelopeSchema.parse(sampleData);
  return finalize(env.rows, env.updatedAt ?? null, true);
}

export async function loadData(): Promise<LoadedData> {
  // Live path: the serverless fetcher at DATA_URL (defaults to /api/data).
  // If it's unreachable — e.g. the HTML was opened as a bare local file with no
  // server — fall back to the bundled sample so the page still renders.
  try {
    const res = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return loadFixture();
    const json: unknown = await res.json();
    const env = DataEnvelopeSchema.parse(json); // fail loud on contract drift
    const skipped = Array.isArray((json as { skipped?: unknown }).skipped)
      ? ((json as { skipped: string[] }).skipped)
      : undefined;
    return finalize(env.rows, env.updatedAt ?? null, false, skipped);
  } catch {
    return loadFixture();
  }
}
