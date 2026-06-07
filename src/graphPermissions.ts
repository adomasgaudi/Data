/**
 * Per-exercise graph permissions (the "allowed graphs" review system).
 *
 * The owner wants to use ALL exercises and ALL data, but many exercises don't
 * graph well, so each exercise carries an explicit approval level per graph
 * METRIC (by id, see GRAPH_METRICS). Each (exercise × metric) is one of four
 * levels: 0 = no/blocked, 1 = experimental, 2 = confirmed (may change),
 * 3 = certain. Default is BLOCK EVERYTHING (level 0): an exercise with no entry
 * shows no graphs until reviewed and individual metrics switched up a level.
 * Any level ≥ 1 lets the graph draw — the level only records confidence.
 *
 * Pure data + total helpers — no DOM, no storage. main.ts owns the localStorage
 * map and the UI; it reads these to decide what to draw and what to grey out.
 */
import { GRAPH_METRICS } from "./graphMetrics";

/** Approval level for one (exercise × graph metric). 0 = no, 1 = experimental,
 * 2 = confirmed (may change), 3 = certain. Level ≥ 1 = the graph may draw. */
export type GraphLevel = 0 | 1 | 2 | 3;

/** The highest valid level — the cycle wraps back to 0 after it. */
export const MAX_GRAPH_LEVEL: GraphLevel = 3;

/** Short labels for each level (chips / tooltips). */
export const GRAPH_LEVEL_LABEL: Record<GraphLevel, string> = {
  0: "no",
  1: "experimental",
  2: "confirmed",
  3: "certain",
};

/** Exercise name → (metric id → level). A missing exercise, or a missing/0
 * metric, means that graph is blocked. */
export type GraphPermissions = Record<string, Record<string, GraphLevel>>;

/** Every graph metric id, in display order. */
export const ALL_GRAPH_METRIC_IDS: string[] = GRAPH_METRICS.map((m) => m.id);

/** Coerce any stored value (incl. the legacy `string[]` allow-list) into the
 * level map for ONE exercise. Legacy "allowed" ids become level 2 (confirmed),
 * preserving that the owner had deliberately switched them on. */
function levelsForEntry(entry: unknown): Record<string, GraphLevel> {
  const out: Record<string, GraphLevel> = {};
  if (Array.isArray(entry)) {
    for (const id of entry) if (typeof id === "string") out[id] = 2;
  } else if (entry && typeof entry === "object") {
    for (const [id, v] of Object.entries(entry as Record<string, unknown>)) {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n >= 1) out[id] = Math.min(3, Math.max(1, n)) as GraphLevel;
    }
  }
  return out;
}

/** Migrate a whole stored permissions object (any legacy shape) into level maps.
 * Drops empty entries so "unreviewed" and "all-blocked" read identically. */
export function normalizePermissions(raw: unknown): GraphPermissions {
  const out: GraphPermissions = {};
  if (raw && typeof raw === "object") {
    for (const [name, entry] of Object.entries(raw as Record<string, unknown>)) {
      const levels = levelsForEntry(entry);
      if (Object.keys(levels).length) out[name] = levels;
    }
  }
  return out;
}

/** The approval level of one (exercise × metric); 0 when absent. */
export function levelOf(perm: GraphPermissions, name: string, metricId: string): GraphLevel {
  return perm[name]?.[metricId] ?? 0;
}

/** The metrics ALLOWED (level ≥ 1) for ONE exercise, in display order. */
export function allowedMetricsFor(perm: GraphPermissions, name: string): Set<string> {
  const e = perm[name];
  if (!e) return new Set();
  return new Set(ALL_GRAPH_METRIC_IDS.filter((id) => (e[id] ?? 0) >= 1));
}

/** Whether a specific metric is allowed (level ≥ 1) for an exercise. */
export function isMetricAllowed(perm: GraphPermissions, name: string, metricId: string): boolean {
  return levelOf(perm, name, metricId) >= 1;
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

/** Set the level of one (exercise × metric), returning a NEW map (the input is
 * never mutated). Level 0 removes the entry; an exercise left with no metrics is
 * dropped so the map stays small. */
export function setMetricLevel(
  perm: GraphPermissions,
  name: string,
  metricId: string,
  level: GraphLevel,
): GraphPermissions {
  const cur: Record<string, GraphLevel> = { ...(perm[name] ?? {}) };
  if (level <= 0) delete cur[metricId];
  else cur[metricId] = level;
  const next: GraphPermissions = { ...perm };
  if (Object.keys(cur).length === 0) delete next[name];
  else next[name] = cur;
  return next;
}

/** Cycle one (exercise × metric) through 0 → 1 → 2 → 3 → 0, returning a new map. */
export function cycleMetricLevel(perm: GraphPermissions, name: string, metricId: string): GraphPermissions {
  const next = ((levelOf(perm, name, metricId) + 1) % (MAX_GRAPH_LEVEL + 1)) as GraphLevel;
  return setMetricLevel(perm, name, metricId, next);
}

/** Set EVERY metric for an exercise to one level (0 clears the exercise),
 * returning a new map. */
export function setAllMetrics(perm: GraphPermissions, name: string, level: GraphLevel): GraphPermissions {
  const next: GraphPermissions = { ...perm };
  if (level <= 0) {
    delete next[name];
    return next;
  }
  const m: Record<string, GraphLevel> = {};
  for (const id of ALL_GRAPH_METRIC_IDS) m[id] = level;
  next[name] = m;
  return next;
}
