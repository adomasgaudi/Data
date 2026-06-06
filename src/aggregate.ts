/**
 * Filter / sort / compute over the set log. This is the "find the highest value
 * among certain exercises" core. Everything here is a pure function of its
 * inputs so it can be exhaustively unit- and property-tested; the 10K-row scale
 * is trivial for plain JS, so the only thing that matters is correctness.
 */
import type { SetRecord, ExerciseIdentity, ExerciseRelationship } from "./domain";
import {
  estimate1RM,
  MAX_1RM_REPS,
  daysBetweenIso,
  strengthRetention,
  grownStability,
  STRENGTH_DECAY,
  type OneRepMaxFormula,
} from "./metrics";
import { isIsometric } from "./profile";

/** Generic "find the element maximizing a numeric key". Null-valued elements are
 * ignored. Returns null if no element yields a finite value. First max wins on
 * ties (stable). This single primitive backs every "highest …" feature. */
export function maxBy<T>(items: readonly T[], selector: (item: T) => number | null): T | null {
  let best: T | null = null;
  let bestVal = -Infinity;
  for (const item of items) {
    const v = selector(item);
    if (v === null || !Number.isFinite(v)) continue;
    if (v > bestVal) {
      bestVal = v;
      best = item;
    }
  }
  return best;
}

export interface FilterCriteria {
  /** StrengthLevel usernames to include. Empty/undefined = all. */
  usernames?: string[];
  /** Exercise names to include. Empty/undefined = all. */
  exercises?: string[];
  /** Inclusive ISO date bounds "yyyy-MM-dd". String comparison is valid for this format. */
  dateFrom?: string;
  dateTo?: string;
  minReps?: number;
  maxReps?: number;
  /** Drop sets flagged as dropsets (they understate true working strength). */
  excludeDropsets?: boolean;
  /** Require a usable (weight, reps) pair. */
  requireWeightAndReps?: boolean;
}

export function filterRecords(records: readonly SetRecord[], c: FilterCriteria): SetRecord[] {
  const userSet = c.usernames?.length ? new Set(c.usernames) : null;
  const exSet = c.exercises?.length ? new Set(c.exercises) : null;

  return records.filter((r) => {
    if (userSet && !userSet.has(r.username)) return false;
    if (exSet && !exSet.has(r.exerciseName)) return false;
    if (c.dateFrom && r.date < c.dateFrom) return false;
    if (c.dateTo && r.date > c.dateTo) return false;
    if (c.excludeDropsets && r.dropset) return false;
    if (c.minReps !== undefined && (r.reps === null || r.reps < c.minReps)) return false;
    if (c.maxReps !== undefined && (r.reps === null || r.reps > c.maxReps)) return false;
    if (c.requireWeightAndReps && (r.weight === null || r.reps === null)) return false;
    return true;
  });
}

export type SortKey = "date" | "weight" | "reps" | "e1rm" | "percentile" | "exerciseName" | "user";
export type SortDir = "asc" | "desc";

/** Stable sort by a key. e1rm is derived. Nulls sort last regardless of dir. */
export function sortRecords(
  records: readonly SetRecord[],
  key: SortKey,
  dir: SortDir = "desc",
  formula: OneRepMaxFormula = "epley",
): SetRecord[] {
  const value = (r: SetRecord): number | string | null => {
    switch (key) {
      case "date":
        return r.date;
      case "exerciseName":
        return r.exerciseName;
      case "user":
        return r.user;
      case "weight":
        return r.weight;
      case "reps":
        return r.reps;
      case "percentile":
        return r.percentile;
      case "e1rm":
        return estimate1RM(r.weight, r.reps, formula);
    }
  };
  const sign = dir === "asc" ? 1 : -1;
  return records
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = value(a.r);
      const vb = value(b.r);
      const an = va === null || va === "";
      const bn = vb === null || vb === "";
      if (an && bn) return a.i - b.i;
      if (an) return 1; // nulls last
      if (bn) return -1;
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return a.i - b.i; // stable
    })
    .map((x) => x.r);
}

/**
 * Unique exercises ordered by how many sets each has — most popular first.
 * Ties break alphabetically so the order is deterministic.
 */
export function distinctExercises(records: readonly SetRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.exerciseName === "") continue;
    counts.set(r.exerciseName, (counts.get(r.exerciseName) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => {
    const byCount = counts.get(b)! - counts.get(a)!; // most instances first
    return byCount !== 0 ? byCount : a.localeCompare(b);
  });
}

/**
 * The exercise names a picker/selector should offer for a set of records.
 *
 * TASK 11 invariant — creating a dissolved / combined / comparison variant must
 * NEVER replace or hide an original. Every distinct logged exerciseName is
 * offered, alongside any variant or synthetic group name present in `records`;
 * relationship membership (parent/child, group inclusion) never subtracts a name.
 * So an original (e.g. "Pull Ups") and its variants ("Assisted Pull Up", "Gravity
 * Machine Pull Up") are always selectable together. Most-logged first.
 *
 * It delegates to distinctExercises: the guarantee is that nothing here filters by
 * identity/relationship. Pass logged records for originals+variants, or
 * computedRecords() to also include synthetic group names.
 */
export function selectableExercises(records: readonly SetRecord[]): string[] {
  return distinctExercises(records);
}
export interface FreqTier {
  tier: string;
  min: number;
}

/**
 * The set of exercise names that are "active" given a frequency-tier cutoff plus
 * manual include/exclude overrides — the engine behind the app-wide active-set
 * filter. An exercise is active when its total set count reaches the cutoff
 * tier's threshold (or there is no cutoff), then:
 *   - excludeOverrides force it OUT (even if it passed the tier), and
 *   - includeOverrides force it IN (even if it's below the tier).
 * Members of combinable/comparable groups are counted INDIVIDUALLY here (this
 * works on raw exercise names), so each member passes or fails on its own; a
 * synthetic derived lift ("SQ mix") has its own combined count and is judged on
 * that. `freqTiers` must be ordered hardest→easiest (highest min first).
 */
export function buildActiveExerciseSet(
  records: readonly SetRecord[],
  cutoffTier: string | null,
  includeOverrides: readonly string[],
  excludeOverrides: readonly string[],
  freqTiers: readonly FreqTier[],
): Set<string> {
  // Count sets per exercise (same rule as distinctExercises).
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.exerciseName === "") continue;
    counts.set(r.exerciseName, (counts.get(r.exerciseName) ?? 0) + 1);
  }
  // The minimum set count to be active. No cutoff (null / not found) → 0 (all in).
  const cutoff = cutoffTier ? freqTiers.find((t) => t.tier === cutoffTier)?.min ?? 0 : 0;
  const exclude = new Set(excludeOverrides);
  const active = new Set<string>();
  for (const [name, count] of counts) {
    if (exclude.has(name)) continue; // forced out wins over everything
    if (count >= cutoff) active.add(name); // passes the tier
  }
  for (const name of includeOverrides) if (!exclude.has(name)) active.add(name); // forced in
  return active;
}

export interface ExerciseCount {
  exerciseName: string;
  count: number;
}

/**
 * For a single athlete (matched by username), every exercise they've logged
 * with how many sets they did — most-performed first, ties alphabetical.
 */
export function exerciseCountsForUser(
  records: readonly SetRecord[],
  username: string,
): ExerciseCount[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.username !== username || r.exerciseName === "") continue;
    counts.set(r.exerciseName, (counts.get(r.exerciseName) ?? 0) + 1);
  }
  return [...counts]
    .map(([exerciseName, count]) => ({ exerciseName, count }))
    .sort((a, b) => (b.count - a.count) || a.exerciseName.localeCompare(b.exerciseName));
}

/**
 * Every set one athlete logged for one exercise, newest first (ties by set
 * number). The caller computes per-set values (1RM, volume) from metrics.ts.
 */
export function setsForUserExercise(
  records: readonly SetRecord[],
  username: string,
  exerciseName: string,
): SetRecord[] {
  return records
    .filter((r) => r.username === username && r.exerciseName === exerciseName)
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.setNumber - b.setNumber));
}

export interface WeekSets {
  weekStart: string; // ISO Monday
  sets: SetRecord[]; // that week's sets, newest date first
}

/** Group a list of sets into weeks (Monday start), newest week first. */
export function setsByWeek(sets: readonly SetRecord[]): WeekSets[] {
  const byWeek = new Map<string, SetRecord[]>();
  for (const s of sets) {
    const wk = mondayOf(s.date);
    const list = byWeek.get(wk);
    if (list) list.push(s);
    else byWeek.set(wk, [s]);
  }
  const out: WeekSets[] = [...byWeek].map(([weekStart, ws]) => ({
    weekStart,
    sets: [...ws].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.setNumber - b.setNumber)),
  }));
  return out.sort((a, b) => (a.weekStart > b.weekStart ? -1 : a.weekStart < b.weekStart ? 1 : 0));
}

export interface WeeklySetStats {
  peakPerWeek: number; // busiest single (Monday-start) week, ever
  thisWeek: number; // sets in the week that contains `todayIso`
  monthAvgPerWeek: number; // avg sets/week over the trailing 30 days
  threeMonthAvgPerWeek: number; // avg sets/week over the trailing 90 days
}

/**
 * Sets-per-week stats for one exercise's set log, measured against `todayIso`.
 * The trailing averages divide the sets falling inside the window by the number
 * of weeks the window spans (30 days ≈ 4.3 weeks, 90 ≈ 12.9), so they read as a
 * true per-week rate and are rounded to one decimal. An empty log is all zeros.
 */
export function weeklySetStats(sets: readonly SetRecord[], todayIso: string): WeeklySetStats {
  if (sets.length === 0)
    return { peakPerWeek: 0, thisWeek: 0, monthAvgPerWeek: 0, threeMonthAvgPerWeek: 0 };

  const perWeek = new Map<string, number>();
  for (const s of sets) {
    const wk = mondayOf(s.date);
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1);
  }
  const peakPerWeek = Math.max(...perWeek.values());
  const thisWeek = perWeek.get(mondayOf(todayIso)) ?? 0;

  const today = utcOf(todayIso);
  const windowAvg = (days: number): number => {
    const from = today - (days - 1) * MS_PER_DAY;
    let n = 0;
    for (const s of sets) {
      const t = utcOf(s.date);
      if (t >= from && t <= today) n++;
    }
    return Math.round((n / (days / 7)) * 10) / 10;
  };
  return { peakPerWeek, thisWeek, monthAvgPerWeek: windowAvg(30), threeMonthAvgPerWeek: windowAvg(90) };
}

export interface WorkoutDay {
  date: string;
  totalSets: number;
  exercises: ExerciseCount[]; // exercises trained that day, most sets first
  sets: SetRecord[]; // every set that day, grouped by exercise then set number
}

/**
 * One athlete's training grouped into workout days (a day = one workout),
 * newest first. Each day lists what they did and holds every set.
 */
export function workoutsForUser(records: readonly SetRecord[], username: string): WorkoutDay[] {
  const byDate = new Map<string, SetRecord[]>();
  for (const r of records) {
    if (r.username !== username) continue;
    const list = byDate.get(r.date);
    if (list) list.push(r);
    else byDate.set(r.date, [r]);
  }
  const days: WorkoutDay[] = [];
  for (const [date, sets] of byDate) {
    const counts = new Map<string, number>();
    for (const s of sets) {
      if (s.exerciseName === "") continue;
      counts.set(s.exerciseName, (counts.get(s.exerciseName) ?? 0) + 1);
    }
    const exercises = [...counts]
      .map(([exerciseName, count]) => ({ exerciseName, count }))
      .sort((a, b) => b.count - a.count || a.exerciseName.localeCompare(b.exerciseName));
    const ordered = [...sets].sort(
      (a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber,
    );
    days.push({ date, totalSets: sets.length, exercises, sets: ordered });
  }
  return days.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

/** Summarise a bag of sets into exercise counts (most first) + ordered sets. */
function summariseSets(sets: SetRecord[]): { exercises: ExerciseCount[]; sets: SetRecord[] } {
  const counts = new Map<string, number>();
  for (const s of sets) {
    if (s.exerciseName === "") continue;
    counts.set(s.exerciseName, (counts.get(s.exerciseName) ?? 0) + 1);
  }
  const exercises = [...counts]
    .map(([exerciseName, count]) => ({ exerciseName, count }))
    .sort((a, b) => b.count - a.count || a.exerciseName.localeCompare(b.exerciseName));
  const ordered = [...sets].sort(
    (a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber,
  );
  return { exercises, sets: ordered };
}

const MS_PER_DAY = 86_400_000;
const utcOf = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
const isoOf = (ms: number): string => {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
};
/** ISO date of the Monday that starts the week containing `iso`. */
const mondayOf = (iso: string): string => {
  const dt = new Date(utcOf(iso));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return isoOf(dt.getTime());
};

/**
 * The day list with the gaps filled in: every calendar date from the first to
 * the last workout, newest first. Days with no training come back as empty
 * WorkoutDays (0 sets, no exercises) so the UI can show rest days.
 */
export function workoutsWithRestDays(workouts: readonly WorkoutDay[]): WorkoutDay[] {
  if (workouts.length === 0) return [];
  let min = workouts[0]!.date;
  let max = workouts[0]!.date;
  const byDate = new Map<string, WorkoutDay>();
  for (const w of workouts) {
    byDate.set(w.date, w);
    if (w.date < min) min = w.date;
    if (w.date > max) max = w.date;
  }
  const out: WorkoutDay[] = [];
  for (let t = utcOf(max); t >= utcOf(min); t -= MS_PER_DAY) {
    const iso = isoOf(t);
    out.push(byDate.get(iso) ?? { date: iso, totalSets: 0, exercises: [], sets: [] });
  }
  return out;
}

export interface WeekGroup {
  weekStart: string; // ISO date of the Monday that starts the week
  totalSets: number;
  exercises: ExerciseCount[];
  sets: SetRecord[];
}

/** One athlete's training grouped by week (Monday start), newest first. */
export function weeksForUser(records: readonly SetRecord[], username: string): WeekGroup[] {
  const byWeek = new Map<string, SetRecord[]>();
  for (const r of records) {
    if (r.username !== username) continue;
    const wk = mondayOf(r.date);
    const list = byWeek.get(wk);
    if (list) list.push(r);
    else byWeek.set(wk, [r]);
  }
  const weeks: WeekGroup[] = [];
  for (const [weekStart, sets] of byWeek) {
    const summary = summariseSets(sets);
    weeks.push({ weekStart, totalSets: sets.length, exercises: summary.exercises, sets: summary.sets });
  }
  return weeks.sort((a, b) => (a.weekStart > b.weekStart ? -1 : a.weekStart < b.weekStart ? 1 : 0));
}

export interface ExerciseDayPoint {
  date: string;
  sets: number;
  bestE1rm: number | null; // best estimated 1RM achieved that day, null if none computable
}

/**
 * Time series for one athlete + exercise, oldest first: for each day they did
 * it, how many sets and the best estimated 1RM. Feeds the progress graph.
 */
export function exerciseProgressForUser(
  records: readonly SetRecord[],
  username: string,
  exerciseName: string,
  formula: OneRepMaxFormula = "epley",
): ExerciseDayPoint[] {
  const byDate = new Map<string, SetRecord[]>();
  for (const r of records) {
    if (r.username !== username || r.exerciseName !== exerciseName) continue;
    const list = byDate.get(r.date);
    if (list) list.push(r);
    else byDate.set(r.date, [r]);
  }
  return [...byDate]
    .map(([date, sets]) => {
      let best: number | null = null;
      for (const s of sets) {
        const e = addedWeight1RM(s, formula); // bodyweight share peeled off, like everywhere else
        if (e !== null && (best === null || e > best)) best = e;
      }
      return { date, sets: sets.length, bestE1rm: best };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Weekly roll-up of {@link exerciseProgressForUser}, oldest week first. Each
 * point is one Monday-start week: `date` is that Monday, `sets` is the week's
 * TOTAL sets (every day in the week summed), and `bestE1rm` is the best
 * estimated 1RM reached anywhere in the week. The progress graph plots these so
 * the bars read as sets/week rather than sets/day.
 */
export function exerciseProgressByWeek(
  records: readonly SetRecord[],
  username: string,
  exerciseName: string,
  formula: OneRepMaxFormula = "epley",
): ExerciseDayPoint[] {
  const daily = exerciseProgressForUser(records, username, exerciseName, formula);
  const byWeek = new Map<string, { sets: number; bestE1rm: number | null }>();
  for (const p of daily) {
    const wk = mondayOf(p.date);
    const cur = byWeek.get(wk);
    if (cur) {
      cur.sets += p.sets;
      if (p.bestE1rm !== null && (cur.bestE1rm === null || p.bestE1rm > cur.bestE1rm)) cur.bestE1rm = p.bestE1rm;
    } else {
      byWeek.set(wk, { sets: p.sets, bestE1rm: p.bestE1rm });
    }
  }
  return [...byWeek]
    .map(([date, v]) => ({ date, sets: v.sets, bestE1rm: v.bestE1rm }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface UserRef {
  user: string;
  username: string;
}

export function distinctUsers(records: readonly SetRecord[]): UserRef[] {
  const map = new Map<string, string>();
  for (const r of records) if (r.username && !map.has(r.username)) map.set(r.username, r.user);
  return [...map].map(([username, user]) => ({ username, user })).sort((a, b) => a.user.localeCompare(b.user));
}

/**
 * Estimated 1RM of a set as ADDED (bar) weight — the load you'd put on the bar
 * for a single, directly comparable to the weight you logged. We name each part
 * so there's no ambiguity about what the number means:
 *
 *   addedWeight    – what's on the bar (origWeight; the logged weight)
 *   bodyweightLoad – the body's share of the lift (coeff × bodyweight), already
 *                    folded into `weight` by computedRecords for squats, pull-ups…
 *   effectiveLoad  – addedWeight + bodyweightLoad  (= record.weight)
 *   effective1RM   – the formula's 1RM of the effectiveLoad
 *   addedWeight1RM – effective1RM − bodyweightLoad  ← what we report
 *
 * For bar-only lifts bodyweightLoad is 0, so this is just the plain 1RM. Because
 * a 1RM is never below the load lifted, addedWeight1RM is never below addedWeight.
 */
export function addedWeight1RM(record: SetRecord, formula: OneRepMaxFormula = "epley"): number | null {
  if (record.notComparable) return null; // owner-marked: reps/sets count, but no 1RM
  if (isIsometric(record.exerciseName)) return null; // holds log seconds, not reps → no 1RM
  // Above the cap, Epley/Brzycki are guesswork, so we report NO value (null)
  // rather than a clamped one. The Nuzzo curve is data-derived across the study's
  // full range (down to 15% of 1RM ≈ 127 reps), so it is EXEMPT from the cap.
  if (formula !== "nuzzo" && record.reps !== null && record.reps > MAX_1RM_REPS) return null;
  // Variation difficulty scales the EFFECTIVE load before the 1RM curve; a band
  // then SUBTRACTS a constant assistance in kg. ×1 / absent leaves it unchanged.
  // The result can be ≤ 0 — handled linearly so the 1RM stays continuous.
  const mult = record.difficultyMult ?? 1;
  const effectiveLoad = record.weight ?? 0;
  const scaledLoad = effectiveLoad * mult - (record.assistKg ?? 0);
  const effective1RM = scaledLoad > 0 ? estimate1RM(scaledLoad, record.reps, formula) : scaledLoad;
  if (effective1RM === null) return null;
  // origWeight is undefined only for bar-only lifts (no bodyweight folded in) → the
  // whole load is "added". When it's explicitly null, it was a bodyweight-only set
  // on a bodyweight lift, so the added weight is 0 and the body is the whole load.
  const addedWeight = record.origWeight === undefined ? effectiveLoad : (record.origWeight ?? 0);
  const bodyweightLoad = effectiveLoad - addedWeight;
  // Peel the ADJUSTED bodyweight (scaled by the same difficulty) — since the load
  // fed to the curve was scaled, the bodyweight reference must be scaled too, not
  // the full bodyweight. (mult = 1 → unchanged for ordinary lifts.)
  return effective1RM - bodyweightLoad * mult;
}

/**
 * The bodyweight-INCLUSIVE estimated 1RM (the rep-curve result on the effective,
 * difficulty-scaled, band-assisted load) — i.e. addedWeight1RM BEFORE the
 * bodyweight share is peeled off. Always reflects the whole load moved, so it
 * stays ≥ 0 for anyone who can do the movement at all (used for "% of world
 * record", where a negative added-weight 1RM would wrongly read below 0).
 */
export function effectiveE1RM(record: SetRecord, formula: OneRepMaxFormula = "epley"): number | null {
  if (record.notComparable) return null;
  if (isIsometric(record.exerciseName)) return null;
  if (formula !== "nuzzo" && record.reps !== null && record.reps > MAX_1RM_REPS) return null;
  const mult = record.difficultyMult ?? 1;
  const scaledLoad = (record.weight ?? 0) * mult - (record.assistKg ?? 0);
  return scaledLoad > 0 ? estimate1RM(scaledLoad, record.reps, formula) : scaledLoad;
}

/**
 * Collapse a group's member sets into one comparable exercise: keep only sets whose
 * exercise is a group member, relabel them to `groupName`, and divide their load by
 * the member's scaling quotient so everyone is compared on the reference lift (an
 * RDL at quotient 0.7 becomes a ~1.43× deadlift-equivalent). Both the calc load and
 * the displayed (added) weight scale together, so the 1RM scales cleanly too.
 */
export function scaleToGroup(
  records: readonly SetRecord[],
  groupName: string,
  members: Record<string, number>,
): SetRecord[] {
  const out: SetRecord[] = [];
  for (const r of records) {
    const scale = members[r.exerciseName];
    if (scale === undefined || scale <= 0) continue;
    const sc = (w: number | null) => (w === null ? null : w / scale);
    out.push({
      ...r,
      exerciseName: groupName,
      // Remember the source lift unless it was already tracked by canonicalisation.
      originalExerciseName: r.originalExerciseName ?? r.exerciseName,
      weight: sc(r.weight),
      origWeight: sc(r.origWeight ?? r.weight),
    });
  }
  return out;
}

/** A combinable/comparable group as the synthetic generator needs it. */
export interface SyntheticGroupDef {
  /** Registry tag id, stamped onto each synthetic record (e.g. "compare.dl-pattern"). */
  id: string;
  /** The exercise name the synthetic records are emitted under (e.g. "DL pattern"). */
  derivedName: string;
  /** Member exercise name → scaling quotient toward the reference (1 = combinable). */
  members: Record<string, number>;
}

/**
 * Build the SYNTHETIC records for combinable/comparable groups, returning ONLY
 * the new records (not the originals). For each group, every member set is
 * relabeled to the group's derivedName and its load scaled by 1/quotient so the
 * members sit on one curve (combinable groups use quotient 1, i.e. no scaling).
 *
 * IMPORTANT: pass records whose `weight` is already the bodyweight-INCLUSIVE
 * effective load (i.e. post-computeRecord). The owner's rule is that the ratio
 * scales the TOTAL (bodyweight part + added), so we scale the effective load
 * here and tag each output `syntheticGroupId`; downstream computeRecord must skip
 * these (they're already computed) to avoid folding bodyweight in twice. The pure
 * source lifts are never touched — synthetics are additional records.
 *
 * `originalExerciseName` is preserved so a synthetic still remembers it came from
 * e.g. "Romanian Deadlift".
 */
export function withSyntheticGroups(
  computedRecords: readonly SetRecord[],
  groups: readonly SyntheticGroupDef[],
): SetRecord[] {
  const out: SetRecord[] = [];
  for (const g of groups) {
    // scaleToGroup relabels to derivedName, scales the load, and preserves the
    // source lift in originalExerciseName. We only add the syntheticGroupId tag.
    // Tag the identity + relationship from the group id (combine.* vs compare.*)
    // so views can branch on it without re-parsing the id. The member lift names
    // are recorded as includedExerciseIds. Pure source lifts stay "original".
    const isCompare = g.id.startsWith("compare.");
    const identity: ExerciseIdentity = isCompare ? "comparison_group" : "combined";
    const relationshipType: ExerciseRelationship = isCompare ? "comparison_of" : "combined_from";
    const includedExerciseIds = Object.keys(g.members);
    for (const r of scaleToGroup(computedRecords, g.derivedName, g.members))
      out.push({ ...r, syntheticGroupId: g.id, identity, relationshipType, includedExerciseIds });
  }
  return out;
}

export interface BestSet {
  record: SetRecord;
  e1rm: number; // added-weight 1RM (bodyweight share peeled back off)
}

/**
 * Build the "current strength" line for a chart, as a forward simulation of the
 * spaced-repetition detraining model. Strength is carried as a `level`, and the
 * lift's durability as a `stability` that grows with every session:
 *   • the clock restarts on EVERY set (even a lighter one) — you're still
 *     training the lift, so a gap counts from your last set, not your peak;
 *   • through a gap the level fades on exp(−(t−grace)/stability);
 *   • each new training day grows `stability` (grownStability), so the more you
 *     train a lift the FLATTER its future decay — frequent training can never
 *     make it drop faster; and
 *   • a set can only lift the level (max with its own e1rm), never lower it.
 * Extended to `todayMs` so the present-day fade shows even when the last set is old.
 *
 * `points` are {x: ms-timestamp, y: e1rm} in any order; within each gap it's
 * sampled every `stepDays` for a smooth sag. Pure so it can be unit-tested.
 */
export function decayedStrengthSeries(
  points: readonly { x: number; y: number }[],
  todayMs: number,
  stepDays = 4,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const step = stepDays * MS_PER_DAY;
  const dayOf = (x: number) => Math.round(x / MS_PER_DAY); // group same-day sets into one session
  const out: { x: number; y: number }[] = [];
  const push = (x: number, y: number) => out.push({ x, y: Math.round(y * 10) / 10 });

  let anchorX = sorted[0]!.x; // the last training day — where the decay clock restarts
  let level = sorted[0]!.y; // strength carried from that day
  let stability: number = STRENGTH_DECAY.baseStability; // durability; grows with each session
  let prevDay = dayOf(anchorX);
  // Strength at time x given the current anchor + stability (grace from the anchor).
  const decayedAt = (x: number) => level * strengthRetention((x - anchorX) / MS_PER_DAY, stability);
  push(anchorX, level);

  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]!;
    for (let u = anchorX + step; u < s.x; u += step) push(u, decayedAt(u)); // smooth sag in the gap
    level = Math.max(decayedAt(s.x), s.y); // decay over the gap, then the set re-proves strength
    anchorX = s.x; // training resets the grace clock
    const day = dayOf(s.x);
    if (day !== prevDay) {
      stability = grownStability(stability); // a new session makes future decay weaker
      prevDay = day;
    }
    push(anchorX, level);
  }
  // Tail: sag from the last training day to today.
  for (let u = anchorX + step; u < todayMs; u += step) push(u, decayedAt(u));
  if (todayMs > anchorX) push(todayMs, decayedAt(todayMs));
  return out;
}

/**
 * The set giving the highest current strength among `records`.
 *
 * Normally that's just the highest estimated 1RM. When `asOf` (today, ISO) is
 * given, the detraining model is applied: each set's 1RM is faded by how long
 * ago it was performed, so a monster lift from a year ago can be overtaken by a
 * solid recent one — the winning `e1rm` is the *decayed* (current) value. This
 * is what powers the "current strength" mode of the settings toggle.
 */
export function bestSet(
  records: readonly SetRecord[],
  formula: OneRepMaxFormula = "epley",
  asOf?: string,
): BestSet | null {
  const value = (r: SetRecord): number | null => {
    const base = addedWeight1RM(r, formula);
    if (base === null) return null;
    return asOf ? base * strengthRetention(daysBetweenIso(r.date, asOf)) : base;
  };
  const record = maxBy(records, value);
  if (record === null) return null;
  const e1rm = value(record);
  return e1rm === null ? null : { record, e1rm };
}

export interface LeaderboardEntry {
  user: string;
  username: string;
  e1rm: number;
  weight: number | null; // the originally-logged weight (display), not the calc load
  reps: number;
  date: string;
}

/**
 * For one exercise: each user's best set (by estimated 1RM), ranked high→low.
 * This is the headline "who is strongest at X" view.
 */
export function leaderboard(
  records: readonly SetRecord[],
  exerciseName: string,
  formula: OneRepMaxFormula = "epley",
  asOf?: string,
): LeaderboardEntry[] {
  const forExercise = records.filter((r) => r.exerciseName === exerciseName);
  const byUser = new Map<string, SetRecord[]>();
  for (const r of forExercise) {
    const arr = byUser.get(r.username);
    if (arr) arr.push(r);
    else byUser.set(r.username, [r]);
  }

  const entries: LeaderboardEntry[] = [];
  for (const sets of byUser.values()) {
    const best = bestSet(sets, formula, asOf);
    if (!best || best.record.weight === null || best.record.reps === null) continue;
    entries.push({
      user: best.record.user,
      username: best.record.username,
      e1rm: best.e1rm,
      // Display the originally-logged weight (added load), not the calc load.
      weight: best.record.origWeight !== undefined ? best.record.origWeight : best.record.weight,
      reps: best.record.reps,
      date: best.record.date,
    });
  }
  return entries.sort((a, b) => b.e1rm - a.e1rm);
}

export interface PersonalRecord {
  user: string;
  username: string;
  exerciseName: string;
  /** Heaviest single set regardless of reps. */
  topWeight: { weight: number | null; reps: number; date: string };
  /** Best estimated 1RM. */
  bestE1rm: { e1rm: number; weight: number | null; reps: number; date: string };
}

/**
 * Exercise names that probably refer to the same lift (typos / casing / plurals /
 * trailing numbers), grouped so the owner can spot data to merge. Normalisation:
 * lowercase, drop everything but letters, strip trailing plural s. "Stairs",
 * "Stairss" and "Stairs 4" collapse to one cluster; "L-SIT", "L Sit", "L sit" too.
 * Only clusters with more than one distinct raw spelling are returned.
 */
export function nearDuplicateExercises(records: readonly SetRecord[]): { names: string[]; sets: number }[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/s+$/, "");
  const clusters = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (!r.exerciseName) continue;
    const k = norm(r.exerciseName);
    if (!k) continue;
    let byName = clusters.get(k);
    if (!byName) clusters.set(k, (byName = new Map()));
    byName.set(r.exerciseName, (byName.get(r.exerciseName) ?? 0) + 1);
  }
  const out: { names: string[]; sets: number }[] = [];
  for (const byName of clusters.values()) {
    if (byName.size < 2) continue;
    const names = [...byName.keys()].sort((a, b) => (byName.get(b) ?? 0) - (byName.get(a) ?? 0));
    out.push({ names, sets: [...byName.values()].reduce((a, b) => a + b, 0) });
  }
  return out.sort((a, b) => b.names.length - a.names.length || b.sets - a.sets);
}

/**
 * OWNER-CONFIRMED exact-name aliases: each entry folds one logged exercise into
 * another because the owner has explicitly said they are the same lift. This is
 * the ONLY place where genuinely different logged names (not mere typos) may be
 * combined — it is deliberately NOT the scaling-group mechanism, which fabricates
 * cross-exercise comparisons and is kept out of the leaderboard by default.
 *
 * Rules for adding here (see the "exercise merging rules" guidance):
 *   • Only near-identical lifts, and only after the owner confirms each one.
 *   • Every alias is surfaced in the Exercises tab so the merge is visible.
 *   • Left = raw logged name (exact, after trim), right = the name to fold into.
 *
 * Numbered/variant names NOT listed here (e.g. "Smith Machine Bulgarian Split
 * Squat", "One Arm Pull Ups", "Leg 130/140/155") stay distinct on purpose.
 *
 * AI-NOTE: do not add merges here without explicit owner sign-off — silent
 * exercise merges inflate/confuse the leaderboards. Confirmed so far:
 *   - Stairs 4 → Stairs (source app renames on settings change)
 *   - Chin Ups → Pull Ups (owner-confirmed same lift; 2026-06-01)
 * NOTE: Smith Machine Squat is intentionally NOT aliased to Squat — the owner
 * wants them kept separate; they're combined only in the "Squat pattern"
 * scaling group (see EXERCISE_GROUPS), not folded at the data level.
 */
const EXERCISE_NAME_ALIASES: Record<string, string> = {
  "Stairs 4": "Stairs",
  "Chin Ups": "Pull Ups",
  "Chin up": "Pull Ups",
  "Chin ups": "Pull Ups",
};

/**
 * Conservative "same exercise, just spelled differently" key. Folds together
 * casing, surrounding/duplicate whitespace, punctuation, a leading enumerator
 * ("1 TRX…"), and trailing plural/typo s — but keeps interior digits
 * significant, so "Leg 130" and "Leg 140" stay apart. Applied after the alias
 * table above.
 */
export function sameExerciseKey(name: string): string {
  const aliased = EXERCISE_NAME_ALIASES[name.trim()] ?? name;
  return aliased
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ") // punctuation/dashes → space
    .trim()
    .replace(/^\d+\s+/, "") // drop a leading "1 " style enumerator
    .replace(/\s+/g, " ")
    .replace(/s+$/, ""); // strip trailing plural / doubled-s typo
}

export interface ExerciseMerge {
  /** The spelling kept as the display name (the most-logged one). */
  canonical: string;
  /** Other raw spellings folded into the canonical name. */
  variants: string[];
  /** Total sets across all spellings in the cluster. */
  sets: number;
}

/**
 * Fold variant spellings of the same exercise into one canonical display name
 * (the most-frequently-logged spelling) so leaderboards, PRs and counts don't
 * split one lift across several near-identical names. Records keep their raw
 * name in `originalExerciseName`, so nothing about the source data is lost.
 * Returns the rewritten records plus a report of which spellings were merged
 * (clusters with more than one spelling), for the Data Health view.
 */
export function canonicalizeExerciseNames(records: readonly SetRecord[]): {
  records: SetRecord[];
  merges: ExerciseMerge[];
} {
  const clusters = new Map<string, Map<string, number>>(); // key → rawName → set count
  for (const r of records) {
    if (!r.exerciseName) continue;
    const k = sameExerciseKey(r.exerciseName);
    if (!k) continue;
    let byName = clusters.get(k);
    if (!byName) clusters.set(k, (byName = new Map()));
    byName.set(r.exerciseName, (byName.get(r.exerciseName) ?? 0) + 1);
  }
  const canonical = new Map<string, string>(); // rawName → display name
  const merges: ExerciseMerge[] = [];
  for (const byName of clusters.values()) {
    // Most-logged spelling wins; ties broken alphabetically for determinism.
    const sorted = [...byName.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const display = sorted[0]![0];
    for (const [name] of sorted) canonical.set(name, display);
    if (sorted.length > 1)
      merges.push({
        canonical: display,
        variants: sorted.map(([n]) => n).filter((n) => n !== display),
        sets: sorted.reduce((sum, [, c]) => sum + c, 0),
      });
  }
  const out = records.map((r) => {
    const display = canonical.get(r.exerciseName);
    return display && display !== r.exerciseName
      ? { ...r, exerciseName: display, originalExerciseName: r.exerciseName }
      : r;
  });
  merges.sort((a, b) => b.variants.length - a.variants.length || b.sets - a.sets);
  return { records: out, merges };
}

export interface AthleteSummary {
  sessions: number; // distinct training days
  sets: number; // total sets logged
  totalVolume: number; // Σ weight × reps (kg·reps), where both are present
  firstDate: string | null;
  lastDate: string | null;
  weeks: number; // span in weeks (≥ 1)
  sessionsPerWeek: number;
  bodyweightFirst: number | null;
  bodyweightLast: number | null;
}

/** A compact "what this athlete has been doing" rollup over their whole log. */
export function athleteSummary(records: readonly SetRecord[], username: string): AthleteSummary {
  const days = new Set<string>();
  let sets = 0;
  let totalVolume = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  let bwFirst: { date: string; bw: number } | null = null;
  let bwLast: { date: string; bw: number } | null = null;
  for (const r of records) {
    if (r.username !== username || r.exerciseName === "") continue;
    sets++;
    if (r.date) {
      days.add(r.date);
      if (firstDate === null || r.date < firstDate) firstDate = r.date;
      if (lastDate === null || r.date > lastDate) lastDate = r.date;
      if (r.bodyweight !== null) {
        if (!bwFirst || r.date < bwFirst.date) bwFirst = { date: r.date, bw: r.bodyweight };
        if (!bwLast || r.date > bwLast.date) bwLast = { date: r.date, bw: r.bodyweight };
      }
    }
    if (r.weight !== null && r.reps !== null) totalVolume += r.weight * r.reps;
  }
  const spanDays = firstDate && lastDate ? (Date.parse(lastDate) - Date.parse(firstDate)) / 86_400_000 : 0;
  const weeks = Math.max(1, spanDays / 7);
  return {
    sessions: days.size,
    sets,
    totalVolume,
    firstDate,
    lastDate,
    weeks,
    sessionsPerWeek: days.size / weeks,
    bodyweightFirst: bwFirst?.bw ?? null,
    bodyweightLast: bwLast?.bw ?? null,
  };
}

/** Best lift per (user, exercise): both heaviest weight and best estimated 1RM. */
export function personalRecords(
  records: readonly SetRecord[],
  formula: OneRepMaxFormula = "epley",
  asOf?: string,
): PersonalRecord[] {
  const groups = new Map<string, SetRecord[]>();
  for (const r of records) {
    if (r.weight === null || r.reps === null || r.exerciseName === "" || r.username === "") continue;
    const key = `${r.username} ${r.exerciseName}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const disp = (r: SetRecord): number | null => (r.origWeight !== undefined ? r.origWeight : r.weight);
  const out: PersonalRecord[] = [];
  for (const sets of groups.values()) {
    // Heaviest is by the originally-logged (added) weight, not the calc load.
    const heaviest = maxBy(sets, disp);
    const best = bestSet(sets, formula, asOf);
    if (!heaviest || !best || heaviest.reps === null) continue;
    if (best.record.weight === null || best.record.reps === null) continue;
    out.push({
      user: heaviest.user,
      username: heaviest.username,
      exerciseName: heaviest.exerciseName,
      topWeight: { weight: disp(heaviest), reps: heaviest.reps, date: heaviest.date },
      bestE1rm: {
        e1rm: best.e1rm,
        weight: disp(best.record),
        reps: best.record.reps,
        date: best.record.date,
      },
    });
  }
  return out.sort(
    (a, b) => a.user.localeCompare(b.user) || a.exerciseName.localeCompare(b.exerciseName),
  );
}
