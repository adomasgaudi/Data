/**
 * Per-exercise graph permissions (the "allowed graphs" review system).
 *
 * The owner wants to use ALL exercises and ALL data, but many exercises don't
 * graph well, so each exercise carries an explicit allow-list of which graph
 * METRICS (by id, see GRAPH_METRICS) are permitted. The default is BLOCK
 * EVERYTHING: an exercise with no entry (or an empty list) shows no graphs until
 * it has been reviewed and individual metrics switched on.
 *
 * Pure data + total helpers — no DOM, no storage. main.ts owns the localStorage
 * map and the UI; it reads these to decide what to draw and what to grey out.
 */
import { GRAPH_METRICS } from "./graphMetrics";

/** Exercise name → allowed metric ids. Missing/empty entry = nothing allowed. */
export type GraphPermissions = Record<string, string[]>;

/** Every graph metric id, in display order. */
export const ALL_GRAPH_METRIC_IDS: string[] = GRAPH_METRICS.map((m) => m.id);

/** The metrics allowed for ONE exercise (a fresh set; empty when unreviewed). */
export function allowedMetricsFor(perm: GraphPermissions, name: string): Set<string> {
  return new Set(perm[name] ?? []);
}

/** Whether a specific metric is allowed for an exercise. */
export function isMetricAllowed(perm: GraphPermissions, name: string, metricId: string): boolean {
  return (perm[name] ?? []).includes(metricId);
}

/**
 * The metrics allowed for EVERY exercise in scope (the intersection). This is
 * what a graph plotting several exercises at once may safely draw: a metric is
 * "available in scope" only when none of the plotted exercises blocks it. An
 * empty scope (nothing plotted) yields nothing allowed.
 */
export function metricsAllowedForScope(perm: GraphPermissions, names: readonly string[]): Set<string> {
  if (names.length === 0) return new Set();
  let acc: Set<string> | null = null;
  for (const n of names) {
    const a = allowedMetricsFor(perm, n);
    if (acc === null) {
      acc = a;
    } else {
      const prev: Set<string> = acc;
      acc = new Set([...prev].filter((x) => a.has(x)));
    }
    if (acc.size === 0) break; // can only shrink — stop once empty
  }
  return acc ?? new Set();
}

/** Which of the plotted exercises BLOCK a given metric (i.e. still need review
 * for it). Used to explain an unavailable state and point at what to review. */
export function exercisesBlockingMetric(
  perm: GraphPermissions,
  names: readonly string[],
  metricId: string,
): string[] {
  return names.filter((n) => !isMetricAllowed(perm, n, metricId));
}

/** Exercises in scope that have NO allowed graphs at all (fully unreviewed). */
export function fullyBlockedExercises(perm: GraphPermissions, names: readonly string[]): string[] {
  return names.filter((n) => allowedMetricsFor(perm, n).size === 0);
}

/** Toggle one metric for one exercise, returning a NEW permissions map (the
 * input is never mutated). Removing the last allowed metric drops the entry so
 * the map stays small and "unreviewed" and "all-blocked" read identically. */
export function toggleMetric(perm: GraphPermissions, name: string, metricId: string): GraphPermissions {
  const cur = new Set(perm[name] ?? []);
  if (cur.has(metricId)) cur.delete(metricId);
  else cur.add(metricId);
  const next: GraphPermissions = { ...perm };
  if (cur.size === 0) delete next[name];
  else next[name] = ALL_GRAPH_METRIC_IDS.filter((id) => cur.has(id)); // keep display order
  return next;
}

/** Set an exercise to ALL metrics allowed, or NONE (clear), returning a new map. */
export function setAllMetrics(perm: GraphPermissions, name: string, allow: boolean): GraphPermissions {
  const next: GraphPermissions = { ...perm };
  if (allow) next[name] = [...ALL_GRAPH_METRIC_IDS];
  else delete next[name];
  return next;
}
