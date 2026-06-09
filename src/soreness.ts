/**
 * Soreness model — COMPUTED ("no-user": no subjective input yet).
 *
 * The signal is OVERREACH: doing more volume than your body is recently accustomed
 * to is what induces DOMS. So for each exercise on a given day we compare its volume
 * to your RECENT records — the best single DAY in the last ~30 days, and the best
 * 7-day and 14-day windows in the last ~90 days. Beating one means a soreness "dose"
 * proportional to how far past the record you went, scaled by the lift's intrinsic
 * SUSCEPTIBILITY (eccentric / stretch-loaded lifts damage more), then spread to the
 * muscles it trains (involvement-weighted).
 *
 * Repeated-bout effect falls out for free: if you keep training at a high volume your
 * RECENT record rises, so the same session stops exceeding it → no more soreness. You
 * only get sore when you do MORE than you've lately adapted to. (All-time records —
 * how a long-ago bout speeds re-adaptation — are a later refinement.)
 *
 * Each dose then fades on a fast rise-then-fall DOMS curve (peaks ~1 day, mostly gone
 * in a few), with bigger muscles (legs/back) given a longer decay than small ones
 * (arms/calves). Current soreness per muscle = the sum of every recent dose, decayed.
 *
 * Pure + tested; no DOM, no storage. main.ts reads these to flag the history, paint
 * the Live page and plot the soreness graph.
 */
import type { SetRecord } from "./domain";
import { autoMuscleGroups, type MuscleGroup } from "./profile";
import { daysBetweenIso, setVolume } from "./metrics";

// ---- 1. Per-exercise soreness susceptibility -------------------------------

/** Average lift = 1. Eccentric / stretch-loaded / long-length work tears more
 * (≈1.5); short-ROM / machine / isometric / concentric isolation tears less (≈0.7).
 * Keyword heuristic — rules are tried in order, first match wins, so a specific
 * high rule ("leg curl") beats a generic low one ("curl"). Tunable later. */
export const SUSCEPTIBILITY_DEFAULT = 1;
const SUSCEPTIBILITY_RULES: { keywords: string[]; factor: number }[] = [
  // High: loaded deep / at long muscle length, eccentric emphasis.
  { keywords: ["romanian", "rdl", "stiff leg", "stiff-leg", "sldl", "good morning", "nordic", "leg curl", "glute ham", "ghr", "sissy", "deficit", "split squat", "bulgarian", "lunge", "cossack", "pistol", "fly", "flye", "pec deck", "pullover"], factor: 1.5 },
  // Moderately high: deep-ROM compounds.
  { keywords: ["squat", "deadlift", "dip", "pull up", "pullup", "pull-up", "chin", "row", "bench", "overhead press", "push up", "pushup", "push-up"], factor: 1.15 },
  // Low: short-ROM / machine / isometric / concentric isolation.
  { keywords: ["machine", "cable", "pushdown", "pressdown", "lateral raise", "front raise", "rear delt", "curl", "tricep", "extension", "calf", "plank", "hold", "carry", "shrug", "face pull", "crunch", "leg press"], factor: 0.7 },
];
export function sorenessSusceptibility(exerciseName: string): number {
  const n = exerciseName.toLowerCase();
  for (const r of SUSCEPTIBILITY_RULES) if (r.keywords.some((k) => n.includes(k))) return r.factor;
  return SUSCEPTIBILITY_DEFAULT;
}

// ---- 2. Volume per exercise per day ----------------------------------------

export interface DayVolume { date: string; volume: number; }

/** Per-exercise daily training volume (Σ weight×reps) for one athlete, each
 * exercise's days oldest→newest. Sets missing weight or reps are skipped. */
export function exerciseDailyVolumes(records: readonly SetRecord[], username: string): Map<string, DayVolume[]> {
  const byEx = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (r.username !== username || !r.date || r.exerciseName === "") continue;
    const v = setVolume(r.weight, r.reps);
    if (v === null) continue;
    let days = byEx.get(r.exerciseName);
    if (!days) byEx.set(r.exerciseName, (days = new Map()));
    days.set(r.date, (days.get(r.date) ?? 0) + v);
  }
  const out = new Map<string, DayVolume[]>();
  for (const [ex, days] of byEx)
    out.set(ex, [...days.entries()].map(([date, volume]) => ({ date, volume })).sort((a, b) => a.date.localeCompare(b.date)));
  return out;
}

/** Σ volume over the `span`-day window ENDING on `endIso` (inclusive). span 1 = that day. */
function windowSum(days: readonly DayVolume[], endIso: string, span: number): number {
  let s = 0;
  for (const d of days) {
    const back = daysBetweenIso(d.date, endIso);
    if (back >= 0 && back < span) s += d.volume;
  }
  return s;
}

/** Best single-day volume in the `lookback` days BEFORE `endIso` (excludes endIso). */
function maxDailyRecord(days: readonly DayVolume[], endIso: string, lookback: number): number {
  let m = 0;
  for (const d of days) {
    const back = daysBetweenIso(d.date, endIso);
    if (back > 0 && back <= lookback) m = Math.max(m, d.volume);
  }
  return m;
}

/** Best `span`-day rolling-window volume among PRIOR (non-overlapping) windows that
 * end within `lookback` days before `endIso` — i.e. your record week / 2-weeks. */
function maxWindowRecord(days: readonly DayVolume[], endIso: string, span: number, lookback: number): number {
  let m = 0;
  for (const d of days) {
    const back = daysBetweenIso(d.date, endIso);
    if (back >= span && back <= lookback) m = Math.max(m, windowSum(days, d.date, span));
  }
  return m;
}

// ---- 3. Overreach (the history signal) -------------------------------------

/** How many days back each record window looks. */
export const SORENESS_WINDOWS = { dailyLookback: 30, periodLookback: 90 } as const;
/** Cap on a single session's overreach magnitude (200% over record) so a novel lift
 * or a freak spike can't dominate. */
export const OVERREACH_CAP = 2;

export interface Overreach {
  exercise: string;
  date: string;
  dayVolume: number;
  dayRecord: number;       // best single day, last 30d
  weekVolume: number;
  weekRecord: number;      // best prior 7-day window, last 90d
  twoWeekVolume: number;
  twoWeekRecord: number;   // best prior 14-day window, last 90d
  exceededDay: boolean;
  exceededWeek: boolean;
  exceededTwoWeek: boolean;
  /** Excess past the most-beaten record (0 = no overreach, 1 = double, capped). */
  overreach: number;
}

/** Overreach for ONE exercise on ONE day, given that exercise's full day-volume
 * series. A window with no prior record (record 0) counts as novel → treated as a
 * full overreach for that window. */
export function exerciseOverreach(days: readonly DayVolume[], exercise: string, dateIso: string): Overreach {
  const dayVolume = windowSum(days, dateIso, 1);
  const weekVolume = windowSum(days, dateIso, 7);
  const twoWeekVolume = windowSum(days, dateIso, 14);
  const dayRecord = maxDailyRecord(days, dateIso, SORENESS_WINDOWS.dailyLookback);
  const weekRecord = maxWindowRecord(days, dateIso, 7, SORENESS_WINDOWS.periodLookback);
  const twoWeekRecord = maxWindowRecord(days, dateIso, 14, SORENESS_WINDOWS.periodLookback);
  const exceededDay = dayVolume > dayRecord && dayVolume > 0;
  const exceededWeek = weekVolume > weekRecord && weekVolume > 0;
  const exceededTwoWeek = twoWeekVolume > twoWeekRecord && twoWeekVolume > 0;
  const excess = (vol: number, rec: number) => (rec > 0 ? vol / rec - 1 : 1);
  let overreach = 0;
  if (exceededDay) overreach = Math.max(overreach, excess(dayVolume, dayRecord));
  if (exceededWeek) overreach = Math.max(overreach, excess(weekVolume, weekRecord));
  if (exceededTwoWeek) overreach = Math.max(overreach, excess(twoWeekVolume, twoWeekRecord));
  return { exercise, date: dateIso, dayVolume, dayRecord, weekVolume, weekRecord, twoWeekVolume, twoWeekRecord, exceededDay, exceededWeek, exceededTwoWeek, overreach: Math.min(OVERREACH_CAP, overreach) };
}

/** Overreach for every exercise this athlete trained on `dateIso` (the history-row
 * engine). Only exercises with a logged set that day are returned. */
export function overreachForDay(records: readonly SetRecord[], username: string, dateIso: string): Overreach[] {
  const byEx = exerciseDailyVolumes(records, username);
  const out: Overreach[] = [];
  for (const [ex, days] of byEx)
    if (days.some((d) => d.date === dateIso)) out.push(exerciseOverreach(days, ex, dateIso));
  return out;
}

// ---- 4. DOMS kernel + per-muscle recovery ----------------------------------

/** Rise of the DOMS curve (days). Small → soreness appears fast. */
export const SORENESS_TAU_RISE = 0.6;
/** Decay of the DOMS curve per muscle (days): bigger muscles stay sore longer. */
const MUSCLE_TAU: Record<MuscleGroup, number> = {
  Quads: 3, Hamstrings: 3.5, Glutes: 3, Adductors: 3, Abductors: 2.5, Calves: 3,
  "Lower back": 3, "Upper back": 2.5, Lats: 2.5, Chest: 3,
  Shoulders: 2, Biceps: 2, Triceps: 2, Forearms: 1.8, Core: 2, Other: 2.5,
};
export function muscleRecoveryTau(m: MuscleGroup): number { return MUSCLE_TAU[m] ?? 2.5; }

/** DOMS response `daysSince` a stimulus, normalized so its own peak = 1: ~0 right
 * after, rises to a peak under a day, then decays with `tauDecay`. */
export function sorenessKernel(daysSince: number, tauDecay: number, tauRise = SORENESS_TAU_RISE): number {
  if (daysSince < 0 || tauDecay <= tauRise) return 0;
  const raw = Math.exp(-daysSince / tauDecay) - Math.exp(-daysSince / tauRise);
  const tPeak = ((tauRise * tauDecay) / (tauDecay - tauRise)) * Math.log(tauDecay / tauRise);
  const peak = Math.exp(-tPeak / tauDecay) - Math.exp(-tPeak / tauRise);
  return peak > 0 ? Math.max(0, raw / peak) : 0;
}

/** Scales the summed dose into a ~0–100 soreness reading (relative, not absolute —
 * there's no subjective calibration yet). */
export const SORENESS_SCALE = 60;
const INVOLVE_PRIMARY = 1;
const INVOLVE_SECONDARY = 0.6;

export interface SorenessOpts {
  /** Days back to gather doses (kernel is ~0 beyond this). Default 21. */
  doseLookbackDays?: number;
  /** Per-(exercise,muscle) involvement 0–1, overriding the primary/secondary
   * default — lets main.ts feed the owner's edited 0–4 muscle levels. */
  involvement?: (exercise: string, muscle: MuscleGroup) => number;
  /** Dose→0-100 scale (default {@link SORENESS_SCALE}). */
  scale?: number;
}

/** Estimated soreness per muscle group AS OF `asOfIso` (0–100). Sums every recent
 * overreach dose, spread to the lift's muscles and decayed by the DOMS kernel. */
export function muscleSorenessAsOf(
  records: readonly SetRecord[],
  username: string,
  asOfIso: string,
  opts: SorenessOpts = {},
): Map<MuscleGroup, number> {
  const lookback = opts.doseLookbackDays ?? 21;
  const scale = opts.scale ?? SORENESS_SCALE;
  const byEx = exerciseDailyVolumes(records, username);
  const acc = new Map<MuscleGroup, number>();
  for (const [ex, days] of byEx) {
    const susc = sorenessSusceptibility(ex);
    const muscles = autoMuscleGroups(ex);
    for (const dv of days) {
      const daysSince = daysBetweenIso(dv.date, asOfIso);
      if (daysSince < 0 || daysSince > lookback) continue;
      const ov = exerciseOverreach(days, ex, dv.date);
      if (ov.overreach <= 0) continue;
      for (let i = 0; i < muscles.length; i++) {
        const m = muscles[i];
        if (!m) continue;
        const inv = opts.involvement ? opts.involvement(ex, m) : i === 0 ? INVOLVE_PRIMARY : INVOLVE_SECONDARY;
        if (inv <= 0) continue;
        const k = sorenessKernel(daysSince, muscleRecoveryTau(m));
        if (k <= 0) continue;
        acc.set(m, (acc.get(m) ?? 0) + ov.overreach * susc * inv * k);
      }
    }
  }
  for (const [m, v] of acc) acc.set(m, Math.min(100, v * scale));
  return acc;
}

/** Soreness per muscle right now (today). */
export function muscleSorenessNow(
  records: readonly SetRecord[],
  username: string,
  todayIso: string,
  opts?: SorenessOpts,
): Map<MuscleGroup, number> {
  return muscleSorenessAsOf(records, username, todayIso, opts);
}
