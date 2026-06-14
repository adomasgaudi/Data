/**
 * Personal strength benchmarks — the owner's OWN labelled targets per lift, shown
 * alongside the estimated population percentiles on the World Records page (and later
 * the lift card). Phase 3 of docs/ceo/strength-percentiles-benchmarks.md.
 *
 * MODEL (owner-chosen): benchmarks are GLOBAL — one ordered list per lift that applies
 * to every athlete — and each row picks its OWN unit, either a bodyweight ratio (×bw)
 * or an absolute kg. A ×bw row scales with each athlete's bodyweight; a kg row is the
 * same number for everyone. This pure module owns the data shape + the "has this lifter
 * met it?" maths; the editor UI + persistence are thin glue in main.ts.
 */
export type BenchmarkUnit = "x" | "kg";
export interface Benchmark {
  label: string;
  value: number;
  unit: BenchmarkUnit;
}
/** Global per-lift benchmarks: a normalized exercise-name key → its ordered rows. */
export type BenchmarkStore = Record<string, Benchmark[]>;

/** Stable store key for an exercise name (case/space-insensitive). */
export function benchKey(name: string): string {
  return name.trim().toLowerCase();
}

/** A benchmark's threshold expressed in kg for a given bodyweight: a ×bw row scales by
 *  bodyweight, a kg row is already absolute. */
export function benchmarkKg(b: Benchmark, bodyweightKg: number): number {
  return b.unit === "kg" ? b.value : b.value * bodyweightKg;
}

/** Has a lifter (best 1RM in kg, at this bodyweight) reached this benchmark? */
export function isMet(b: Benchmark, e1rmKg: number, bodyweightKg: number): boolean {
  return e1rmKg >= benchmarkKg(b, bodyweightKg);
}

/** The list ordered easiest→hardest by kg threshold at a reference bodyweight, so a
 *  mixed ×bw / kg list still sorts sensibly. */
export function sortBenchmarks(list: Benchmark[], refBodyweightKg: number): Benchmark[] {
  return [...list].sort((a, b) => benchmarkKg(a, refBodyweightKg) - benchmarkKg(b, refBodyweightKg));
}

/** The HARDEST benchmark a lifter has met (their current "rank" in this lift), or null
 *  when they've met none. */
export function topMet(list: Benchmark[], e1rmKg: number, bodyweightKg: number): Benchmark | null {
  let best: Benchmark | null = null;
  let bestKg = -Infinity;
  for (const b of list) {
    if (!isMet(b, e1rmKg, bodyweightKg)) continue;
    const kg = benchmarkKg(b, bodyweightKg);
    if (kg > bestKg) { bestKg = kg; best = b; }
  }
  return best;
}

/** Sanitize a parsed value at the localStorage edge: keep only well-formed rows
 *  (non-empty label, finite positive value, valid unit). */
export function cleanStore(raw: unknown): BenchmarkStore {
  const out: BenchmarkStore = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [key, rows] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    const clean = rows.filter((r): r is Benchmark =>
      !!r && typeof r === "object"
      && typeof (r as Benchmark).label === "string" && (r as Benchmark).label.trim() !== ""
      && typeof (r as Benchmark).value === "number" && Number.isFinite((r as Benchmark).value) && (r as Benchmark).value > 0
      && ((r as Benchmark).unit === "x" || (r as Benchmark).unit === "kg"));
    if (clean.length) out[key] = clean;
  }
  return out;
}
