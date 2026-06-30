/**
 * Plan diagnostics — the PURE, tested core behind the Plan overlay's "Performance" and
 * "Bodyparts" tabs (docs/ceo, owner-defined 2026-06-15). It only JUDGES data that's
 * already computed elsewhere (best 1RM, trailing-month weekly sets, benchmarks, gym
 * percentile, muscle group); main.ts assembles the inputs and renders the result.
 *
 * Owner's definitions:
 *  - BEHIND BY BENCHMARK: below the next benchmark set for the lift; if none is set, below
 *    the 10th gym percentile (bottom ~10% of gym lifters). No standard at all → not judged.
 *  - BEHIND/NEGLECTED BY VOLUME: below the lift's Priorities target if set; else below the
 *    athlete's OWN average weekly sets across the lifts they actually train (relative-to-self).
 *  - A lift is "behind" if it's behind on EITHER axis; a bodypart (muscle group) is
 *    "neglected" if its total weekly sets fall below the average across trained groups.
 *
 * Notes are returned STRUCTURED (booleans, numbers, the offending benchmark) — main.ts
 * builds the user-facing strings so they stay translatable (i18n) and the maths stays pure.
 */
import { type Benchmark, benchmarkKg, sortBenchmarks } from "./benchmarks";

/** The no-benchmark fallback bar: below this gym percentile counts as "behind". */
export const PCTILE_FLOOR = 10;

/** Everything the diagnostic needs about one lift (all pre-computed by main.ts). */
export interface LiftInput {
  name: string;
  e1rm: number | null;           // best estimated 1RM (kg), null if nothing logged
  bodyweight: number;            // athlete bodyweight (kg)
  weeklySets: number;            // trailing-month average weekly (hard) sets
  priorityTarget: number | null; // Priorities target sets for this lift, if set
  benchmarks: Benchmark[];       // global benchmarks for this lift (may be empty)
  percentile: number | null;     // gym percentile of e1rm (null when no standard exists)
  muscleGroup: string;           // primary muscle group, for the bodyparts view
}

export type BenchmarkReason = "none" | "no-data" | "below-benchmark" | "below-percentile";
export interface BenchmarkStanding {
  behind: boolean;
  reason: BenchmarkReason;
  nextBenchmark: Benchmark | null; // set when reason === "below-benchmark"
  percentile: number | null;       // set when reason === "below-percentile"/"none"
  gap: number;                      // 0..1, fraction short — ranks worst-first
}

export type VolumeReason = "none" | "below-target" | "below-average";
export interface VolumeStanding {
  behind: boolean;
  reason: VolumeReason;
  weeklySets: number;
  target: number | null; // the Priorities target (when below-target / met)
  avg: number | null;    // the self-average (when below-average / met)
  deficit: number;       // weekly sets short, for ranking
}

export interface LiftStanding {
  name: string;
  muscleGroup: string;
  benchmark: BenchmarkStanding;
  volume: VolumeStanding;
  behind: boolean; // behind on either axis
  score: number;   // combined worst-first ranking score
}

export interface BodypartStanding {
  muscleGroup: string;
  weeklySets: number; // total across the group's lifts
  avg: number;        // average across trained groups
  behind: boolean;    // below that average
  behindLifts: number; // how many of the group's lifts are benchmark-behind
  deficit: number;    // weekly sets short of the average
}

/** Behind by benchmark: below the next unmet benchmark, else (no benchmark) below the
 *  10th gym percentile. `gap` is a 0..1 "how far behind" for ranking. */
export function benchmarkStanding(l: LiftInput): BenchmarkStanding {
  const none: BenchmarkStanding = { behind: false, reason: "none", nextBenchmark: null, percentile: l.percentile, gap: 0 };
  if (l.e1rm == null) return { ...none, reason: "no-data" };
  if (l.benchmarks.length && l.bodyweight > 0) {
    const next = sortBenchmarks(l.benchmarks, l.bodyweight).find((b) => benchmarkKg(b, l.bodyweight) > l.e1rm!);
    if (!next) return none; // met them all
    const nextKg = benchmarkKg(next, l.bodyweight);
    return { behind: true, reason: "below-benchmark", nextBenchmark: next, percentile: l.percentile, gap: nextKg > 0 ? (nextKg - l.e1rm) / nextKg : 0 };
  }
  if (l.percentile == null) return { ...none, reason: "no-data" };
  if (l.percentile < PCTILE_FLOOR) {
    return { behind: true, reason: "below-percentile", nextBenchmark: null, percentile: l.percentile, gap: (PCTILE_FLOOR - l.percentile) / PCTILE_FLOOR };
  }
  return none;
}

/** Behind by volume: below the Priorities target if set, else below the athlete's own
 *  average weekly sets across trained lifts. */
export function volumeStanding(l: LiftInput, userAvgSets: number): VolumeStanding {
  if (l.priorityTarget != null) {
    const behind = l.weeklySets < l.priorityTarget;
    return { behind, reason: behind ? "below-target" : "none", weeklySets: l.weeklySets, target: l.priorityTarget, avg: null, deficit: Math.max(0, l.priorityTarget - l.weeklySets) };
  }
  const behind = userAvgSets > 0 && l.weeklySets < userAvgSets;
  return { behind, reason: behind ? "below-average" : "none", weeklySets: l.weeklySets, target: null, avg: userAvgSets, deficit: Math.max(0, userAvgSets - l.weeklySets) };
}

/** The athlete's average weekly sets across the lifts they ACTUALLY train (sets > 0). */
export function selfAverageSets(lifts: readonly LiftInput[]): number {
  const trained = lifts.filter((l) => l.weeklySets > 0);
  return trained.length ? trained.reduce((s, l) => s + l.weeklySets, 0) / trained.length : 0;
}

/** Every lift judged on both axes, worst-first. */
export function liftStandings(lifts: readonly LiftInput[]): LiftStanding[] {
  const avg = selfAverageSets(lifts);
  return lifts.map((l) => {
    const benchmark = benchmarkStanding(l);
    const volume = volumeStanding(l, avg);
    const score = benchmark.gap + (avg > 0 ? volume.deficit / avg : 0);
    return { name: l.name, muscleGroup: l.muscleGroup, benchmark, volume, behind: benchmark.behind || volume.behind, score };
  }).sort((a, b) => b.score - a.score);
}

/** Just the lifts that are behind on either axis (worst-first). */
export function liftsBehind(lifts: readonly LiftInput[]): LiftStanding[] {
  return liftStandings(lifts).filter((s) => s.behind);
}

/** Muscle groups ranked by how neglected they are: a group is "behind" when its total
 *  weekly sets fall below the average across trained groups. */
export function bodypartStandings(lifts: readonly LiftInput[]): BodypartStanding[] {
  const benchBehind = new Map(liftStandings(lifts).map((s) => [s.name, s.benchmark.behind]));
  const byGroup = new Map<string, { sets: number; behindLifts: number }>();
  for (const l of lifts) {
    if (!l.muscleGroup) continue;
    const e = byGroup.get(l.muscleGroup) ?? { sets: 0, behindLifts: 0 };
    e.sets += l.weeklySets;
    if (benchBehind.get(l.name)) e.behindLifts += 1;
    byGroup.set(l.muscleGroup, e);
  }
  const entries = [...byGroup.entries()];
  const trained = entries.filter(([, e]) => e.sets > 0);
  const avg = trained.length ? trained.reduce((s, [, e]) => s + e.sets, 0) / trained.length : 0;
  return entries
    .map(([muscleGroup, e]) => ({
      muscleGroup,
      weeklySets: Math.round(e.sets * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      behind: avg > 0 && e.sets < avg,
      behindLifts: e.behindLifts,
      deficit: Math.round(Math.max(0, avg - e.sets) * 10) / 10,
    }))
    .sort((a, b) => b.deficit - a.deficit);
}
