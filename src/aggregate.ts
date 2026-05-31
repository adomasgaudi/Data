/**
 * Filter / sort / compute over the set log. This is the "find the highest value
 * among certain exercises" core. Everything here is a pure function of its
 * inputs so it can be exhaustively unit- and property-tested; the 10K-row scale
 * is trivial for plain JS, so the only thing that matters is correctness.
 */
import type { SetRecord } from "./domain";
import { estimate1RM, type OneRepMaxFormula } from "./metrics";

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
  const effective1RM = estimate1RM(record.weight, record.reps, formula);
  if (effective1RM === null) return null;
  const effectiveLoad = record.weight ?? 0;
  const addedWeight = record.origWeight ?? effectiveLoad;
  const bodyweightLoad = effectiveLoad - addedWeight;
  return effective1RM - bodyweightLoad;
}

export interface BestSet {
  record: SetRecord;
  e1rm: number; // added-weight 1RM (bodyweight share peeled back off)
}

/** The single set with the highest added-weight 1RM among `records`. */
export function bestSet(records: readonly SetRecord[], formula: OneRepMaxFormula = "epley"): BestSet | null {
  const record = maxBy(records, (r) => addedWeight1RM(r, formula));
  if (record === null) return null;
  const e1rm = addedWeight1RM(record, formula);
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
    const best = bestSet(sets, formula);
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

/** Best lift per (user, exercise): both heaviest weight and best estimated 1RM. */
export function personalRecords(
  records: readonly SetRecord[],
  formula: OneRepMaxFormula = "epley",
): PersonalRecord[] {
  const groups = new Map<string, SetRecord[]>();
  for (const r of records) {
    if (r.weight === null || r.reps === null || r.exerciseName === "" || r.username === "") continue;
    const key = `${r.username} ${r.exerciseName}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const disp = (r: SetRecord): number | null => (r.origWeight !== undefined ? r.origWeight : r.weight);
  const out: PersonalRecord[] = [];
  for (const sets of groups.values()) {
    // Heaviest is by the originally-logged (added) weight, not the calc load.
    const heaviest = maxBy(sets, disp);
    const best = bestSet(sets, formula);
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
