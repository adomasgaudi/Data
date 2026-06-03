/**
 * App entry point. Thin glue only: load + validate data, read control state,
 * call the pure compute functions, and paint the DOM. No business logic lives
 * here — it's all in metrics.ts / aggregate.ts where it is tested.
 */
import { niceTicks, MS_DAY } from "./chartAxis";
import { mountSvgChart, type SvgChart, type SvgSeries, type SvgChartConfig, type SvgPoint } from "./svgChart";
import { loadData, type LoadedData } from "./dataSource";
import { parseCsvRows } from "./csv";
import {
  distinctExercises,
  distinctUsers,
  exerciseCountsForUser,
  setsForUserExercise,
  setsByWeek,
  weeklySetStats,
  workoutsForUser,
  workoutsWithRestDays,
  weeksForUser,
  exerciseProgressByWeek,
  addedWeight1RM,
  filterRecords,
  leaderboard,
  personalRecords,
  athleteSummary,
  withSyntheticGroups,
  buildActiveExerciseSet,
  type SyntheticGroupDef,
  type PersonalRecord,
  type WorkoutDay,
  type ExerciseCount,
} from "./aggregate";
import {
  epley1RM,
  brzycki1RM,
  nuzzo1RM,
  benchPctForReps,
  benchRepsAtPct,
  BENCH_REPS_STUDY,
  estimate1RM,
  weightForReps,
  repsForWeight,
  setVolume,
  effectiveLoad,
  linearFit,
  MAX_1RM_REPS,
  type OneRepMaxFormula,
} from "./metrics";
import type { SetRecord } from "./domain";
import {
  ATHLETES,
  EXERCISE_BW_COEFF,
  bodyComposition,
  defaultBwCoeff,
  realPullupWeight,
  exerciseCategory,
  exerciseCategories,
  muscleGroup,
  COMBINABLE_GROUPS,
  COMPARABLE_GROUPS,
  type RegistryTag,
  LIST_CATEGORIES,
  exerciseCode,
  exerciseCodesFor,
  exerciseTier,
  TRAINING_CATEGORIES,
  type TrainingCategory,
} from "./profile";
import { DEFAULT_FORMULA } from "./config";
import { CHANGELOG, CURRENT_VERSION, WEBSITE_SP, WEBSITE_EXACT_SP, COMPONENTS, fibSp } from "./changelog";
import { SP_HISTORY } from "./spHistory";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const els = {
  status: $("status"),
  settingsBtn: $<HTMLButtonElement>("settingsBtn"),
  themeBtn: $<HTMLButtonElement>("themeBtn"),
  showLegsAll: $<HTMLInputElement>("showLegsAll"),
  settingsPanel: $("settingsPanel"),
  bwSource: $<HTMLSelectElement>("bwSource"),
  exercise: $<HTMLSelectElement>("exercise"),
  rank: $<HTMLSelectElement>("rank"),
  sexFilter: $<HTMLSelectElement>("sexFilter"),
  bwMin: $<HTMLInputElement>("bwMin"),
  bwMax: $<HTMLInputElement>("bwMax"),
  axisMin: $<HTMLInputElement>("axisMin"),
  axisMax: $<HTMLInputElement>("axisMax"),
  axisReset: $<HTMLButtonElement>("axisReset"),
  formula: $<HTMLSelectElement>("formula"),
  excludeDropsets: $<HTMLInputElement>("excludeDropsets"),
  lbTitle: $("lbTitle"),
  lbTable: $<HTMLTableElement>("lbTable"),
  prTable: $<HTMLTableElement>("prTable"),
  prCount: $("prCount"),
  health: $("health"),
  healthBtn: $<HTMLButtonElement>("healthBtn"),
  healthBadge: $("healthBadge"),
  healthPage: $("healthPage"),
  healthClose: $<HTMLButtonElement>("healthClose"),
  changelogBtn: $<HTMLButtonElement>("changelogBtn"),
  changelogVer: $("changelogVer"),
  changelogPage: $("changelogPage"),
  changelogClose: $<HTMLButtonElement>("changelogClose"),
  changelog: $("changelog"),
  athlete: $<HTMLSelectElement>("athlete"),
  athleteChips: $("athleteChips"),
  athleteProfile: $("athleteProfile"),
  athleteStats: $("athleteStats"),
  momentum: $("momentum"),
  trainBreakdown: $("trainBreakdown"),
  muscleMapBody: $("muscleMapBody"),
  athleteTitle: $("athleteTitle"),
  athleteTable: $<HTMLTableElement>("athleteTable"),
  exerciseRecord: $("exerciseRecord"),
  exerciseTopSets: $("exerciseTopSets"),
  exerciseWeekly: $("exerciseWeekly"),
  exerciseTargets: $("exerciseTargets"),
  exerciseStats: $<HTMLDetailsElement>("exerciseStats"),
  exerciseCalc: $<HTMLDetailsElement>("exerciseCalc"),
  ecalcBasis: $("ecalcBasis"),
  ecalcRows: $<HTMLTableSectionElement>("ecalcRows"),
  ecalcAddRow: $<HTMLButtonElement>("ecalcAddRow"),
  ecalcNote: $("ecalcNote"),
  exerciseProgress: $("exerciseProgress"),
  exerciseProgressNote: $("exerciseProgressNote"),
  exerciseProgressCenter: $<HTMLButtonElement>("exerciseProgressCenter"),
  exPersetBest: $<HTMLButtonElement>("exPersetBest"),
  exCombineBar: $("exCombineBar"),
  exerciseFilter: $("exerciseFilter"),
  exercisesTabs: $("exercisesTabs"),
  exFiltersBtn: $<HTMLButtonElement>("exFiltersBtn"),
  exCatBar: $("exCatBar"),
  exSearchBar: $("exSearchBar"),
  exerciseCompare: $("exerciseCompare"),
  compareChips: $("compareChips"),
  compareSearch: $<HTMLInputElement>("compareSearch"),
  compareSelCount: $("compareSelCount"),
  compareCats: $("compareCats"),
  compareTiers: $("compareTiers"),
  compareClear: $<HTMLButtonElement>("compareClear"),
  compareNote: $("compareNote"),
  compareSets: $("compareSets"),
  exerciseSearch: $<HTMLInputElement>("exerciseSearch"),
  exerciseNotTrained: $<HTMLInputElement>("exerciseNotTrained"),
  exerciseShowThird: $<HTMLInputElement>("exerciseShowThird"),
  exerciseRange: $<HTMLDetailsElement>("exerciseRange"),
  exPeriodBar: $("exPeriodBar"),
  exerciseSort: $("exerciseSort"),
  exercisesPager: $("exercisesPager"),
  workoutsTitle: $("workoutsTitle"),
  workoutCalendar: $("workoutCalendar"),
  workoutSetsNote: $("workoutSetsNote"),
  workoutsTable: $<HTMLTableElement>("workoutsTable"),
  workoutsPager: $("workoutsPager"),
  workoutView: $<HTMLSelectElement>("workoutView"),
  workoutGrouping: $<HTMLSelectElement>("workoutGrouping"),
  workoutsPageSize: $<HTMLSelectElement>("workoutsPageSize"),
  restToggle: $<HTMLInputElement>("restToggle"),
  restToggleLabel: $("restToggleLabel"),
  aloneFilter: $<HTMLButtonElement>("aloneFilter"),
  addAthlete: $<HTMLSelectElement>("addAthlete"),
  addExercise: $<HTMLInputElement>("addExercise"),
  addExerciseList: $("addExerciseList"),
  addWeight: $<HTMLInputElement>("addWeight"),
  addReps: $<HTMLInputElement>("addReps"),
  addDate: $<HTMLInputElement>("addDate"),
  addSubmit: $<HTMLButtonElement>("addSubmit"),
  addHint: $("addHint"),
  addCount: $("addCount"),
  addTable: $<HTMLTableElement>("addTable"),
  addExport: $<HTMLButtonElement>("addExport"),
  addImport: $<HTMLButtonElement>("addImport"),
  addImportFile: $<HTMLInputElement>("addImportFile"),
  summariseBtn: $<HTMLButtonElement>("summariseBtn"),
  summaryOut: $("summaryOut"),
  bwTitle: $("bwTitle"),
  activeSetBar: $("activeSetBar"),
  bwGroups: $("bwGroups"),
  mergeList: $("mergeList"),
  calcWeight: $<HTMLInputElement>("calcWeight"),
  calcReps: $<HTMLInputElement>("calcReps"),
  calcBw: $<HTMLInputElement>("calcBw"),
  calcCoeff: $<HTMLInputElement>("calcCoeff"),
  calcOut: $("calcOut"),
  calcCurveNote: $("calcCurveNote"),
  testAthlete: $<HTMLSelectElement>("testAthlete"),
  testExercise: $<HTMLSelectElement>("testExercise"),
  testPickHint: $("testPickHint"),
  calcTabs: $("calcTabs"),
  dataTableWrap: $("dataTableWrap"),
  dataPager: $("dataPager"),
  refreshStatus: $("refreshStatus"),
  refreshStatusBtn: $<HTMLButtonElement>("refreshStatusBtn"),
  dataSearch: $<HTMLInputElement>("dataSearch"),
  dataExercise: $<HTMLSelectElement>("dataExercise"),
  dataUser: $<HTMLSelectElement>("dataUser"),
  otherSheet: $("otherSheet"),
  groupsAthlete: $<HTMLSelectElement>("groupsAthlete"),
  groupsBody: $("groupsBody"),
  teamChips: $("teamChips"),
  teamBody: $("teamBody"),
};

let data: LoadedData;
let exerciseSvg: SvgChart | null = null; // per-exercise drill-in progress graph (SVG engine)
let calcCurveSvg: SvgChart | null = null; // Test-tab weight-vs-reps diagram (SVG engine)
let compareSvg: SvgChart | null = null; // Exercises list multi-exercise overlay (SVG engine)
let workoutSetsSvg: SvgChart | null = null; // Workouts view: all sets over time (SVG engine)
const compareSelected = new Set<string>(); // exercises ticked for the overlay graph
let compareChipQuery = ""; // search box text filtering the compare chips
let compareView: "trend" | "perset" = "trend"; // 1RM-trend lines vs per-set weight→1RM bars
let exPersetBestOnly = false; // per-set range: show only each day's best set (top estimated 1RM)

const PAGE_SIZE = 50; // List & stats page size

/** Flip the light/dark theme and remember it. The charts re-theme automatically
 * (their structural colours are CSS-variable-backed classes), so no re-render. */
function setTheme(dark: boolean) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  try { localStorage.setItem("colosseum.theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  els.themeBtn.textContent = dark ? "☀ Light mode" : "🌙 Dark mode";
  els.themeBtn.setAttribute("aria-pressed", String(dark));
}

// Display a number at no more than 3 significant figures: 2 by default, but 3
// when the leading digit is 1–3 (those read wrong with only 2). Used everywhere
// a kg / volume / 1RM number is shown.
const fmt = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const lead = Math.floor(abs / 10 ** Math.floor(Math.log10(abs))); // first significant digit, 1–9
  const sf = lead <= 3 ? 3 : 2;
  return Number(n.toPrecision(sf)).toLocaleString();
};

/** A 0..1 fraction as a whole-number percent, e.g. 0.6 → "60%". One place so
 * every percentage (coefficients, percentile, body fat, training mix) reads the
 * same way across the app. */
const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/** A bodyweight-multiple, always 2 dp, e.g. "1.25 BW". Single source so the
 * leaderboard, per-athlete detail and Test tab agree. */
const bwMult = (ratio: number): string => `${ratio.toFixed(2)} BW`;

/** Weight with reps as a superscript, e.g. 100⁵. Unit (kg) lives in the header. */
const wr = (weight: number | null, reps: number | null): string =>
  weight === null ? "—" : `${fmt(weight)}${reps === null ? "" : `<sup>${reps}</sup>`}`;

/** "2026-05-02" -> "May 2" (abbreviated month + day without leading zero). */
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const shortDate = (iso: string): string => {
  const [, m, d] = iso.split("-");
  const mon = MONTH_ABBR[Number(m) - 1];
  return mon && d ? `${mon} ${Number(d)}` : iso;
};

/** One/two-letter weekday for an ISO day: M T W Th F Sa Su (UTC, to match keys). */
const DOW_ABBR = ["Su", "M", "T", "W", "Th", "F", "Sa"]; // index = getUTCDay()
const dowLetter = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : (DOW_ABBR[new Date(t).getUTCDay()] ?? "");
};

/**
 * ISO-8601 week number (1–53) for a "YYYY-MM-DD" date: weeks start Monday and
 * week 1 is the one containing the year's first Thursday. Matches the app's
 * Monday-start weeks, so an exercise's weekly rows can be labelled "Week 15"
 * instead of a date. Returns 0 only on an unparseable input.
 */
const isoWeekNumber = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  // Shift to the Thursday of this week, then count weeks from Jan 1.
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - day + 3); // move to Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
};

/** Today as an ISO YYYY-MM-DD string — the reference point for "this week" and
 * the trailing-window sets-per-week averages. */
const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Elapsed training time from first to last logged date, in the unit that reads
 * cleanest at that scale: days under 2 weeks, weeks under ~2 months, months
 * under 2 years, otherwise years. */
const trainingDuration = (firstIso: string, lastIso: string): string => {
  const days = Math.max(0, Math.round((Date.parse(lastIso) - Date.parse(firstIso)) / 86_400_000));
  const unit = (n: number, u: string) => `${n} ${u}${n === 1 ? "" : "s"}`;
  if (days < 14) return unit(days, "day");
  if (days < 60) return unit(Math.round(days / 7), "week");
  if (days < 730) return unit(Math.round(days / 30.44), "month");
  return `${(days / 365.25).toFixed(1)} years`;
};

function currentFormula(): OneRepMaxFormula {
  const v = els.formula.value;
  return v === "brzycki" || v === "nuzzo" ? v : "epley";
}

/** Read a number input, returning null when empty or unparseable (negatives kept). */
function numInput(el: HTMLInputElement): number | null {
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * Coliseum athlete filter: keep an athlete only if they match the chosen sex
 * (Everyone / Men / Women) and fall inside the bodyweight range, when set. An
 * athlete with no profile is dropped as soon as any of these filters is active,
 * since we can't confirm they match.
 */
function athletePassesColiseum(username: string): boolean {
  const sex = els.sexFilter.value; // "all" | "m" | "f"
  const bwMin = numInput(els.bwMin);
  const bwMax = numInput(els.bwMax);
  if (sex === "all" && bwMin === null && bwMax === null) return true;
  const p = ATHLETES[username];
  if (!p) return false; // a filter is active but we have nothing to match on
  if (sex !== "all" && p.sex !== sex) return false;
  if (bwMin !== null && p.weight < bwMin) return false;
  if (bwMax !== null && p.weight > bwMax) return false;
  return true;
}

/** Short human label for the active Coliseum filters, for the subtitle (or ""). */
function coliseumFilterNote(): string {
  const parts: string[] = [];
  if (els.sexFilter.value === "m") parts.push("men only");
  else if (els.sexFilter.value === "f") parts.push("women only");
  const bwMin = numInput(els.bwMin);
  const bwMax = numInput(els.bwMax);
  if (bwMin !== null || bwMax !== null) {
    parts.push(`${bwMin ?? "…"}–${bwMax ?? "…"} kg`);
  }
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

// ---- Bodyweight coefficients: the single source of truth, editable + saved ----
// Starts from the profile.ts defaults; user edits are layered on top and stored
// in the browser so they survive reloads. coeffFor() is read everywhere.
const COEFF_STORE_KEY = "colosseum.bwCoeffs.v1";
const coeffOverrides: Record<string, number> = loadCoeffOverrides();

function loadCoeffOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COEFF_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function coeffFor(exerciseName: string): number {
  if (Object.prototype.hasOwnProperty.call(coeffOverrides, exerciseName)) return coeffOverrides[exerciseName]!;
  // Pinned value first, otherwise the leverage-aware heuristic (front lever ≈ 0.1…).
  return EXERCISE_BW_COEFF[exerciseName] ?? defaultBwCoeff(exerciseName);
}

function setCoeff(exerciseName: string, value: number) {
  coeffOverrides[exerciseName] = value;
  try {
    localStorage.setItem(COEFF_STORE_KEY, JSON.stringify(coeffOverrides));
  } catch {
    /* storage may be unavailable (e.g. private mode) — edits still apply this session */
  }
}

// ---- Last picked athlete: remembered across reloads ----
const ATHLETE_STORE_KEY = "colosseum.lastAthlete.v1";

function loadLastAthlete(): string | null {
  try {
    return localStorage.getItem(ATHLETE_STORE_KEY);
  } catch {
    return null;
  }
}

function saveLastAthlete(username: string) {
  try {
    localStorage.setItem(ATHLETE_STORE_KEY, username);
  } catch {
    /* storage may be unavailable — selection still applies this session */
  }
}

// ---- Group view: which people were picked, remembered across reloads ----
const TEAM_STORE_KEY = "colosseum.teamPicks.v1";

function loadTeamPicks(): string[] {
  try {
    const raw = localStorage.getItem(TEAM_STORE_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveTeamPicks(usernames: string[]) {
  try {
    localStorage.setItem(TEAM_STORE_KEY, JSON.stringify(usernames));
  } catch {
    /* storage may be unavailable — selection still applies this session */
  }
}

// ---- "Done alone" workout tags: per (athlete, day), remembered across reloads.
const ALONE_STORE_KEY = "colosseum.aloneTags.v1";
let aloneTags = new Set<string>();

/** Stable tag key for a workout: the athlete + the session's ISO day. */
const aloneKey = (date: string): string => `${els.athlete.value}|${date}`;

function loadAlone() {
  try {
    const raw = localStorage.getItem(ALONE_STORE_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    aloneTags = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    aloneTags = new Set();
  }
}

function saveAlone() {
  try {
    localStorage.setItem(ALONE_STORE_KEY, JSON.stringify([...aloneTags]));
  } catch {
    /* storage may be unavailable — tags still apply this session */
  }
}

// ---- Per-set difficulty grade (RIR — Reps In Reserve), saved on this device.
// The source CSV has no difficulty column, so the owner can grade how many reps
// were left in the tank on each set and it persists across reloads, keyed by
// athlete|exercise|date|setNumber. Grades are stored as a band id (a range
// string like "0.5-1.3"), not a single number, because the owner grades how it
// FELT and that maps to a band, not an exact rep count.
//
// RIR ladder — the single source of truth. `id` is the stored value and also
// the range shown in the cell; `word` is a one-word feel for the closed picker
// button; `desc` is the full plain-language feel shown in the open list. Bands
// run hardest (almost no reps left) → easiest (many reps in reserve).
// Contiguous, non-overlapping.
const RIR_BANDS: ReadonlyArray<{ id: string; word: string; desc: string }> = [
  { id: "0.1–0.3", word: "max", desc: "almost impossible — elite powerlifter grinding ~10s" },
  { id: "0.3–0.5", word: "brutal", desc: "extremely difficult — trained person, 2–4s grind" },
  { id: "0.5–1.3", word: "difficult", desc: "difficult — 1–2s grind, a 2nd rep seems improbable" },
  { id: "1.3–1.5", word: "very hard", desc: "maybe one more rep, but very hard" },
  { id: "1.5–1.8", word: "hard", desc: "could do another rep, but hard" },
  { id: "1.8–2.5", word: "1–2 left", desc: "1 RIR for sure, maybe 2" },
  { id: "2.5–4", word: "2–3 left", desc: "2–3 reps in reserve" },
  { id: "4–8", word: "easy", desc: "4–8 reps in reserve" },
  { id: "8–15", word: "very easy", desc: "8–15 reps in reserve" },
  { id: "15–30", word: "light", desc: "15–30 reps in reserve" },
  { id: "30–100", word: "warm-up", desc: "30–100 reps in reserve (warm-up light)" },
];
/** Look up a band by its stored id. */
const rirBand = (id: string | undefined) => RIR_BANDS.find((b) => b.id === id);
const RIR_IDS = new Set(RIR_BANDS.map((b) => b.id));
const RPE_STORE_KEY = "colosseum.rir.v1";
let rpeGrades: Record<string, string> = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(RPE_STORE_KEY) ?? "{}");
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
})();
/** Stable id for one set. */
const setId = (r: SetRecord): string => `${r.username}|${r.exerciseName}|${r.date}|${r.setNumber}`;
const rpeFor = (r: SetRecord): string | undefined => rpeGrades[setId(r)];
function setRpe(id: string, v: string | null) {
  if (v === null || !RIR_IDS.has(v)) delete rpeGrades[id];
  else rpeGrades[id] = v;
  try { localStorage.setItem(RPE_STORE_KEY, JSON.stringify(rpeGrades)); } catch { /* ignore */ }
}

/**
 * Records with the bodyweight-lifted load baked into `weight`, so the existing
 * leaderboard / PR / progress maths produce bodyweight-aware estimated 1RMs.
 * The chosen bodyweight source (profile table vs the value logged per set) is a
 * Setting. Exercises with coefficient 0 are returned untouched.
 */
/**
 * Fold the bodyweight share into ONE record exactly as computedRecords does, so
 * any view can get the same bodyweight-aware numbers the leaderboard/PRs use.
 * `weight` becomes the effective (bw-inclusive) load; `origWeight` keeps the
 * logged bar weight for display. The single source of truth for this transform.
 */
function computeRecord(r: SetRecord): SetRecord {
  // Synthetic group records (SQ mix, DL pattern…) already carry the bodyweight-
  // inclusive, ratio-scaled load — re-folding bodyweight would double-count it.
  if (r.syntheticGroupId) return r;
  const fromTable = els.bwSource.value !== "perset";
  const coeff = coeffFor(r.exerciseName);
  // Assisted pull-ups: the logged weight is the machine dial value, which over-
  // reads ~2x. Use the halved real assistance for all strength maths, but keep
  // the logged value as origWeight so the displayed set still tells you what to
  // set on the machine.
  const realAdded = realPullupWeight(r.exerciseName, r.weight);
  if (coeff <= 0) {
    if (realAdded === r.weight) return r;
    return { ...r, weight: realAdded, origWeight: r.weight };
  }
  const bw = fromTable ? (ATHLETES[r.username]?.weight ?? null) : r.bodyweight;
  // weight = bodyweight-inclusive load (for the 1RM calc); origWeight = what to display.
  return { ...r, weight: effectiveLoad(realAdded, bw, coeff), origWeight: r.weight };
}

/** The combinable + comparable registry groups, in the shape withSyntheticGroups
 * wants (id, derivedName, member→quotient map). Combinable members use ratio 1. */
const SYNTHETIC_GROUP_DEFS: SyntheticGroupDef[] = [...COMBINABLE_GROUPS, ...COMPARABLE_GROUPS].map(
  (t: RegistryTag): SyntheticGroupDef => ({
    id: t.id,
    derivedName: t.derivedName ?? t.label,
    members: Object.fromEntries((t.members ?? []).map((m) => [m.exerciseName, m.ratio])),
  }),
);

/* ---- Global "active exercise set" filter (app-wide) ----------------------
 * Restrict the WHOLE app to a chosen subset of exercises: a frequency-tier
 * cutoff (S/A/B/C/D by instance count) plus manual include/exclude overrides,
 * all set in the Index page and saved on this device. `activeSet` is null when
 * the filter is OFF (the default — nothing hidden); otherwise it's the set of
 * allowed exercise names. activeRecords() is the single choke point every view
 * reads through; the synthetic group lifts are filtered too (each pure member is
 * judged on its own count, see buildActiveExerciseSet). */
const ACTIVE_CUTOFF_KEY = "colosseum.activeSet.cutoff.v1";
const ACTIVE_INCLUDE_KEY = "colosseum.activeSet.include.v1";
const ACTIVE_EXCLUDE_KEY = "colosseum.activeSet.exclude.v1";
const loadJsonArray = (key: string): string[] => {
  try { const a = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
};
let activeCutoff: string | null = (() => { try { const v = localStorage.getItem(ACTIVE_CUTOFF_KEY); return v && v !== "none" ? v : null; } catch { return null; } })();
let activeInclude = new Set<string>(loadJsonArray(ACTIVE_INCLUDE_KEY));
let activeExclude = new Set<string>(loadJsonArray(ACTIVE_EXCLUDE_KEY));
/** The allowed-exercise set, or null when the filter is off. Rebuilt by refreshActiveSet(). */
let activeSet: Set<string> | null = null;

/** Recompute activeSet from the cutoff + overrides against the current data. Call
 * after data loads or any active-set control changes, then re-render. */
function refreshActiveSet(): void {
  if (!activeCutoff && activeInclude.size === 0 && activeExclude.size === 0) {
    activeSet = null; // filter fully off → no filtering at all
    return;
  }
  activeSet = buildActiveExerciseSet(data.records, activeCutoff, [...activeInclude], [...activeExclude], FREQ_TIERS);
}

/** Persist the active-set controls to localStorage. */
function saveActiveSet(): void {
  try {
    localStorage.setItem(ACTIVE_CUTOFF_KEY, activeCutoff ?? "none");
    localStorage.setItem(ACTIVE_INCLUDE_KEY, JSON.stringify([...activeInclude]));
    localStorage.setItem(ACTIVE_EXCLUDE_KEY, JSON.stringify([...activeExclude]));
  } catch { /* storage may be unavailable */ }
}

/** Raw logged records, filtered to the active exercise set (or all, if off). The
 * single choke point every view/graph/list reads instead of data.records. */
function activeRecords(): SetRecord[] {
  if (!activeSet) return data.records;
  const allow = activeSet;
  return data.records.filter((r) => allow.has(r.exerciseName));
}

function computedRecords(): SetRecord[] {
  // Active-filtered logged records with bodyweight folded in, PLUS the synthetic
  // combinable/comparable group records derived from those computed loads (so the
  // ratio scales the total bw-inclusive load). Pure lifts are never mutated.
  const pure = activeRecords().map(computeRecord);
  return [...pure, ...withSyntheticGroups(pure, SYNTHETIC_GROUP_DEFS)];
}

/**
 * Fill the Colosseum exercise picker with every distinct logged lift, each on its
 * own (no scaling, no groups). Re-runnable: keeps the current selection if it
 * still exists, else picks the first option.
 */
function populateExercisePicker(): void {
  const prev = els.exercise.value;
  const exercises = distinctExercises(activeRecords()); // pure lifts, most-logged first (active set)
  els.exercise.innerHTML = exercises
    .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
    .join("");
  els.exercise.value = exercises.includes(prev) ? prev : (exercises[0] ?? "");
}

// Groups/scaling were removed — every exercise is its own lift. These helpers
// stay as thin pass-throughs so their many call sites don't need touching.
function selectionRecords(records: SetRecord[], _selection: string): SetRecord[] {
  return records;
}

// ---- "Where this name came from" indicator, shared by every view -------------
// Only one kind of combine carries an origin note now: merged spellings — e.g.
// "Pull Ups" was also logged as "Chin Ups". exerciseOrigin() returns those source
// spellings so the "(also: …)" badge can be shown wherever the name appears.
let mergeVariantsCache: Map<string, string[]> | null = null;

/** canonical display name → the other raw spellings folded into it (from merges). */
function mergeVariantsFor(name: string): string[] {
  if (!mergeVariantsCache) {
    mergeVariantsCache = new Map();
    for (const m of data.merges) mergeVariantsCache.set(m.canonical, m.variants);
  }
  return mergeVariantsCache.get(name) ?? [];
}

/** The other spellings folded into a merged name, or [] for a plain lift. */
function exerciseOrigin(name: string): string[] {
  return mergeVariantsFor(name);
}

/** Inline "(also: A, B)" badge for a name, or "" when there's nothing to note.
 * `plain` returns un-escaped text (for chart labels / titles); default is HTML. */
function originBadge(name: string, plain = false): string {
  const origin = exerciseOrigin(name).filter((n) => n !== name);
  if (origin.length === 0) return "";
  const list = origin.join(", ");
  if (plain) return ` (also: ${list})`;
  return ` <span class="origin-note" title="Combined from: ${escapeHtml(list)}">(also: ${escapeHtml(list)})</span>`;
}

function renderStatus() {
  const users = distinctUsers(data.records).length;
  let latest: string | null = null;
  for (const r of data.records) if (r.date && (latest === null || r.date > latest)) latest = r.date;

  let html = `${data.records.length.toLocaleString()} sets · ${users} athletes`;
  if (latest) html += ` · latest ${latest}`;
  // The badges open the Data-health page (which lists each issue/warning).
  if (data.issues.length)
    html += ` <button type="button" class="badge warn badge-link">${data.issues.length} parse issues</button>`;
  if (data.warnings.length)
    html += ` <button type="button" class="badge warn badge-link">${data.warnings.length} sanity warnings</button>`;
  els.status.innerHTML = html;
}

/** Open the data-health overlay (from Settings or the status-bar badges). */
function openHealth() {
  setSettingsOpen(false);
  els.healthPage.hidden = false;
}

/** Open the version-history overlay from Settings. */
function openChangelog() {
  setSettingsOpen(false);
  els.changelogPage.hidden = false;
}

/** Render the version-history list (newest first) into the overlay. Each release
 * is an expandable row: version + SP + one-line note collapsed; bullet details
 * when opened. */
function renderChangelog() {
  // Count actual released versions (a grouped minor counts its sub-versions;
  // planned "soon" entries aren't shipped yet, so they don't count).
  const releaseCount = CHANGELOG.reduce((n, r) => n + (r.soon ? 0 : (r.children?.length ?? 1)), 0);
  const header =
    `<p class="cl-summary muted">${releaseCount} releases · whole site <strong>${WEBSITE_EXACT_SP} SP</strong> (≈ ${WEBSITE_SP} on the Fibonacci scale)</p>` +
    `<div class="cl-spchart-wrap"><div class="cl-sections-lbl muted">Story points over time (cumulative, by commit date)</div>` +
    `<div id="spHistoryChart"></div></div>`;
  // Effort per part — exact SP and the Fibonacci grade it snaps to.
  const sections =
    `<div class="cl-sections"><div class="cl-sections-lbl muted">Effort per part — exact SP (≈ Fibonacci)</div>` +
    `<div class="cl-sections-row">` +
    COMPONENTS.map(
      (c) => `<span class="cv-chip"><span class="cv-name">${escapeHtml(c.name)}</span>` +
        `<span class="cv-ver">${c.sp}<span class="cv-fib">≈${fibSp(c.sp)}</span></span></span>`,
    ).join("") +
    `</div></div>`;
  const rows = CHANGELOG.map((r) => {
    // Grouped minor: list each folded patch under the bullets.
    const children = r.children?.length
      ? `<div class="cl-children">` +
        r.children
          .map(
            (c) =>
              `<div class="cl-child"><span class="cl-cver">${escapeHtml(c.version)}</span>` +
              `<span class="cl-cnote">${escapeHtml(c.note)}</span>` +
              `<span class="cl-csp">SP ${c.sp}</span></div>`,
          )
          .join("") +
        `</div>`
      : "";
    // Planned entries show a "soon" tag instead of an SP chip.
    const spOrTag = r.soon
      ? `<span class="cl-soon">soon</span>`
      : `<span class="cl-sp" title="${r.sp} story points">SP ${r.sp}</span>`;
    return (
      `<details class="cl-row${r.soon ? " is-soon" : ""}">` +
      `<summary class="cl-sum">` +
      `<span class="cl-ver">${escapeHtml(r.version)}</span>` +
      `<span class="cl-mid"><span class="cl-title">${escapeHtml(r.title)}</span>` +
      `<span class="cl-note">${escapeHtml(r.note)}</span></span>` +
      spOrTag +
      `<span class="cl-caret">▾</span>` +
      `</summary>` +
      `<ul class="cl-details">${r.details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>` +
      children +
      `</details>`
    );
  }).join("");
  els.changelog.innerHTML = header + sections + rows;

  // SP-over-time line: cumulative story points across every release commit,
  // plotted on a real time axis. The container is recreated on each render, so
  // mount a fresh chart each time.
  const spBox = document.getElementById("spHistoryChart");
  if (spBox && SP_HISTORY.length) {
    let total = 0;
    const points = SP_HISTORY.map((p) => {
      total += p.sp;
      return { x: Date.parse(p.date), y: total, meta: `${p.version} · +${p.sp} → ${total} SP` };
    });
    mountSvgChart(spBox, {
      series: [{ name: "Cumulative SP", color: "#284e86", type: "line", points }],
      xKind: "time", yBeginAtZero: true, yUnit: "SP", insideLabels: true, height: 220,
    });
  }
}

// ---- Site map (mind map of the whole app) ----------------------------------
interface MapNode { label: string; children?: MapNode[]; }

const SITE_MAP: MapNode = {
  label: "Colosseum",
  children: [
    { label: "Colosseum / Leaderboards", children: [
      { label: "Exercise picker" },
      { label: "Best per rep band" },
      { label: "Rank: total / ×bodyweight" },
      { label: "Filters: sex · bodyweight" },
    ] },
    { label: "Athlete", children: [
      { label: "Profile & training stats" },
      { label: "Training mix" },
      { label: "Momentum (weekly trend)" },
      { label: "Body composition (FFMI)" },
    ] },
    { label: "Exercises", children: [
      { label: "List: by category / tier" },
      { label: "Search · category show/hide" },
      { label: "Drill-in: records · best sets" },
      { label: "Weekly · targets" },
      { label: "1RM trend chart" },
      { label: "Per-set range (time axis, dashed reps)" },
      { label: "Reps↔weight calculator" },
      { label: "Compare graph + sets behind it" },
    ] },
    { label: "Workouts", children: [
      { label: "By day / by week" },
      { label: "Muscle-group view" },
      { label: "Rest days · trained-alone tag" },
      { label: "Calendar + sets chart" },
    ] },
    { label: "Stats / Group", children: [
      { label: "Per-category leaderboards" },
      { label: "Group view (compare people)" },
    ] },
    { label: "Data", children: [
      { label: "Refresh from StrengthLevel (+ status)" },
      { label: "Original CSV vs Processed table" },
    ] },
    { label: "Add", children: [
      { label: "Hand-log a set" },
      { label: "Export / import" },
    ] },
    { label: "Test", children: [
      { label: "Weight↔reps curve" },
    ] },
    { label: "Settings", children: [
      { label: "1RM formula · bodyweight source" },
      { label: "Dark mode" },
      { label: "Data health" },
      { label: "Version history + SP-over-time" },
    ] },
  ],
};

const SITE_MAP_COLORS = ["#284e86", "#2e7d52", "#b8902f", "#6c4ab0", "#1f6f8b", "#c0563b", "#3a4a86", "#7a8b2e", "#a8447a"];

/** Draw the site map as a tidy horizontal mind-map tree (root → tabs → features),
 * laying leaves on their own rows and centring each parent on its children. */
function renderSiteMap() {
  const box = document.getElementById("siteMapBox");
  if (!box) return;
  const NODE_W = 210, NODE_H = 26, ROW_H = 34, GAP_X = 56, PAD = 14;
  type Placed = { label: string; x: number; y: number; color: string };
  const placed: Placed[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  let row = 0;
  let maxDepth = 0;

  const layout = (node: MapNode, depth: number, color: string): number => {
    maxDepth = Math.max(maxDepth, depth);
    const x = PAD + depth * (NODE_W + GAP_X);
    let cy: number;
    if (node.children?.length) {
      const centers = node.children.map((c, i) =>
        layout(c, depth + 1, depth === 0 ? SITE_MAP_COLORS[i % SITE_MAP_COLORS.length]! : color),
      );
      cy = (centers[0]! + centers[centers.length - 1]!) / 2;
      const childX = PAD + (depth + 1) * (NODE_W + GAP_X);
      node.children.forEach((_, i) =>
        edges.push({ x1: x + NODE_W, y1: cy, x2: childX, y2: centers[i]!, color: depth === 0 ? SITE_MAP_COLORS[i % SITE_MAP_COLORS.length]! : color }),
      );
    } else {
      cy = PAD + row * ROW_H + NODE_H / 2;
      row++;
    }
    placed.push({ label: node.label, x, y: cy - NODE_H / 2, color });
    return cy;
  };
  layout(SITE_MAP, 0, "#888");

  const totalW = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * GAP_X;
  const totalH = PAD * 2 + row * ROW_H;
  const edgesSvg = edges
    .map((e) => {
      const mx = (e.x1 + e.x2) / 2;
      return `<path d="M${e.x1} ${e.y1} C${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}" fill="none" stroke="${e.color}" stroke-width="1.5" opacity="0.55"/>`;
    })
    .join("");
  const nodesSvg = placed
    .map(
      (p) =>
        `<g transform="translate(${p.x},${p.y})">` +
        `<rect width="${NODE_W}" height="${NODE_H}" rx="6" fill="var(--card)" stroke="${p.color}" stroke-width="1.5"/>` +
        `<text x="9" y="${NODE_H / 2 + 4}" font-size="11.5" fill="var(--text)">${escapeHtml(p.label)}</text>` +
        `</g>`,
    )
    .join("");
  box.innerHTML =
    `<svg class="sitemap-svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="Site structure mind map">` +
    edgesSvg + nodesSvg +
    `</svg>`;
}

function renderHealth() {
  const merges = data.merges;
  const total = data.issues.length + data.warnings.length;
  els.healthBadge.textContent = total === 0 ? "✓ clear" : `⚠ ${total}`;

  const lines: string[] = [];
  for (const issue of data.issues.slice(0, 50))
    lines.push(`<div class="health-item warn">Row ${issue.index}: ${escapeHtml(issue.message)}</div>`);
  for (const w of data.warnings.slice(0, 50))
    lines.push(
      `<div class="health-item warn">${escapeHtml(w.record.user)} — ${escapeHtml(w.record.exerciseName)}: ${w.field} = ${w.value} (out of plausible range)</div>`,
    );

  // Exercise names auto-merged in the app (variant spellings of one lift). The
  // original names are kept on the data; this just shows what was folded.
  if (merges.length) {
    lines.push(`<h3 class="health-section">Exercise names auto-merged (${merges.length})</h3>`);
    lines.push(
      `<p class="muted" style="margin:0 0 0.5rem;font-size:0.8rem">Variant spellings of the same lift are combined automatically for cleaner stats, so re-imports stay tidy without editing the source. Original names are preserved.</p>`,
    );
    for (const m of merges.slice(0, 40))
      lines.push(
        `<div class="health-item dup"><strong>${escapeHtml(m.canonical)}</strong> <span class="muted">←</span> ${m.variants
          .map((n) => escapeHtml(n))
          .join(", ")} <span class="muted">(${m.sets} sets)</span></div>`,
      );
  }

  if (lines.length === 0) {
    els.health.innerHTML = `<p class="muted">No issues — every row validated cleanly and no duplicate exercise names.</p>`;
    return;
  }
  els.health.innerHTML = lines.join("");
}

interface LbRow {
  user: string;
  username: string;
  value: number; // the ranked number (kg, or BW)
  valueText: string; // formatted for the table
  best: string; // "weight×reps"
  date: string;
  e1rm: number; // added-weight estimated 1RM (kg)
  ratio: number | null; // est 1RM ÷ bodyweight, null if no bodyweight on file
}
let lbRows: LbRow[] = []; // current leaderboard order, for the expandable detail rows

function renderLeaderboard() {
  const exercise = els.exercise.value;
  const formula = currentFormula();
  const rel = els.rank.value === "rel";
  const comp = selectionRecords(computedRecords(), exercise);
  const filtered = filterRecords(comp, {
    excludeDropsets: els.excludeDropsets.checked,
    requireWeightAndReps: true,
  });
  const entries = leaderboard(filtered, exercise, formula);
  const perBw = (username: string, e1rm: number): number | null => {
    const bw = ATHLETES[username]?.weight;
    return bw ? e1rm / bw : null;
  };

  let rows: LbRow[];
  if (rel) {
    // Bodyweight-lifted ranking: estimated 1RM divided by the athlete's bodyweight.
    rows = entries
      .map((e): LbRow | null => {
        const ratio = perBw(e.username, e.e1rm);
        if (ratio === null) return null; // can't rank without a bodyweight on file
        return { user: e.user, username: e.username, value: ratio, valueText: bwMult(ratio), best: wr(e.weight, e.reps), date: e.date, e1rm: e.e1rm, ratio };
      })
      .filter((r): r is LbRow => r !== null)
      .sort((a, b) => b.value - a.value);
  } else {
    rows = entries.map((e) => ({
      user: e.user,
      username: e.username,
      value: e.e1rm,
      valueText: fmt(e.e1rm),
      best: wr(e.weight, e.reps),
      date: e.date,
      e1rm: e.e1rm,
      ratio: perBw(e.username, e.e1rm),
    }));
  }

  // Sex / bodyweight filter: keep only the athletes being compared. The chart
  // and table both iterate `rows`, so trimming here is all that's needed.
  rows = rows.filter((r) => athletePassesColiseum(r.username));

  lbRows = rows;
  // Per rep-band best 1RM for each athlete (grouped bars, NOT summed): each band's
  // value is the theoretical 1RM from sets whose reps fall only in that band.
  const bandData = REP_BANDS.map((band) => {
    const f = filterRecords(comp, {
      excludeDropsets: els.excludeDropsets.checked,
      requireWeightAndReps: true,
      minReps: band.min,
      ...(band.max !== undefined ? { maxReps: band.max } : {}),
    });
    const byUser = new Map<string, number>();
    for (const e of leaderboard(f, exercise, formula)) {
      const v = rel ? perBw(e.username, e.e1rm) : e.e1rm;
      if (v !== null) byUser.set(e.username, v);
    }
    return { label: band.label, byUser };
  });

  const metricNote = rel ? "per bodyweight" : `est. 1RM, ${formula}`;
  // Groups are scaled cross-exercise estimates — label them clearly so a grouped
  // number is never mistaken for a real single-exercise lift.
  els.lbTitle.textContent = `${exercise}${originBadge(exercise, true)} · ${metricNote} · best per rep band${coliseumFilterNote()}`;
  renderLeaderboardTable(rows, rel);
  renderLeaderboardChart(rows, bandData, rel);
}

function renderLeaderboardTable(rows: LbRow[], rel: boolean) {
  const valueHead = rel ? "Per BW" : "Est. 1RM (kg)";
  const head = `<thead><tr><th>Athlete</th><th class="num">${valueHead}</th><th class="num">Best set (kg)</th></tr></thead>`;
  const body = rows
    .map(
      (r, i) =>
        `<tr class="lb-row" data-index="${i}"><td class="${i === 0 ? "rank-1" : ""}">` +
        `<span class="caret">▸</span>${escapeHtml(r.user)}</td>` +
        `<td class="num">${r.valueText}</td><td class="num">${r.best}</td></tr>`,
    )
    .join("");
  els.lbTable.innerHTML =
    head + `<tbody>${body || `<tr><td colspan="3" class="muted">No data for this exercise.</td></tr>`}</tbody>`;
}

/** Expand a leaderboard row to show the date and the other metric. */
function onLeaderboardRowClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest("tr.lb-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const r = lbRows[Number(row.dataset.index)];
  if (!r) return;
  const item = (label: string, val: string) =>
    `<div class="lb-detail-item"><span class="muted">${label}</span><strong>${val}</strong></div>`;
  const detail =
    `<div class="lb-detail">` +
    item("Best set", r.best) +
    item("Est. 1RM", `${fmt(r.e1rm)} kg`) +
    item("Per bodyweight", r.ratio === null ? "—" : bwMult(r.ratio)) +
    item("Achieved", shortDate(r.date)) +
    `</div>`;
  insertDetail(row, 3, detail);
}

// Blue-and-gold band scale, ordered low reps → high reps: the 1–3 band is
// gold (the heaviest, headline lifts), the 4–6 band is a blue/gold blend, and
// the higher-rep bands run blue fading toward grey. Legible on white.
const BAND_COLORS = ["#b8902f", "#7d7a52", "#284e86", "#5a7299", "#8b97a8", "#aab0b8"];

/** Leaderboard dot-plot, drawn as a themed SVG (no Chart.js): each athlete is a
 * horizontal track, with one coloured dot per rep band at that band's est 1RM. */
function renderLeaderboardChart(
  rows: LbRow[],
  bandData: { label: string; byUser: Map<string, number> }[],
  rel: boolean,
) {
  const box = document.getElementById("lbChart");
  if (!box) return;
  if (rows.length === 0) { box.innerHTML = `<p class="muted">No data for this exercise.</p>`; return; }
  const round = (n: number) => Math.round(n * 100) / 100;
  const clip = (s: string) => (s.length > 15 ? s.slice(0, 14) + "…" : s);

  // X (weight) range: From/To inputs override; else span the data (from 0).
  let dataMin = Infinity, dataMax = -Infinity;
  for (const band of bandData) for (const v of band.byUser.values()) { if (v < dataMin) dataMin = v; if (v > dataMax) dataMax = v; }
  if (!Number.isFinite(dataMin)) { dataMin = 0; dataMax = 1; }
  const xMinIn = numInput(els.axisMin);
  const xMaxIn = numInput(els.axisMax);
  const xMin = xMinIn !== null ? xMinIn : Math.min(0, dataMin);
  const xMax = xMaxIn !== null ? xMaxIn : (dataMax * 1.04 || 1);

  const W = Math.max(280, Math.round(box.clientWidth || 320));
  const rowH = 24;
  const M = { l: 96, r: 14, t: 8, b: 26 };
  const plotW = W - M.l - M.r;
  const plotH = rows.length * rowH;
  const H = M.t + plotH + M.b;
  const xPix = (v: number) => M.l + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const rowY = (i: number) => M.t + i * rowH + rowH / 2;

  let grid = "";
  let xLabels = "";
  for (const t of niceTicks(xMin, xMax, 6)) {
    const px = xPix(t);
    if (px < M.l - 0.5 || px > W - M.r + 0.5) continue;
    grid += `<line class="svgc-grid" x1="${px.toFixed(1)}" y1="${M.t}" x2="${px.toFixed(1)}" y2="${M.t + plotH}" stroke-width="1"/>`;
    xLabels += `<text class="svgc-axislabel" x="${px.toFixed(1)}" y="${H - M.b + 16}" text-anchor="middle" font-size="11">${fmt(t)}</text>`;
  }

  let body = "";
  let names = "";
  rows.forEach((r, i) => {
    const y = rowY(i);
    body += `<line class="svgc-grid" x1="${M.l}" y1="${y.toFixed(1)}" x2="${W - M.r}" y2="${y.toFixed(1)}" stroke-width="1" opacity="0.45"/>`;
    names += `<text class="svgc-axislabel${i === 0 ? " lb-rank1" : ""}" x="${M.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11">${escapeHtml(clip(r.user))}</text>`;
    bandData.forEach((band, bi) => {
      const v = band.byUser.get(r.username);
      if (v === undefined) return;
      const color = BAND_COLORS[bi % BAND_COLORS.length];
      body += `<circle cx="${xPix(v).toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" stroke="var(--panel)" stroke-width="1">` +
        `<title>${escapeHtml(r.user)} · ${escapeHtml(band.label)} reps: ${round(v)} ${rel ? "BW" : "kg"}</title></circle>`;
    });
  });

  const legend = bandData
    .map((band, bi) => `<span class="svgc-key"><span class="svgc-dot" style="background:${BAND_COLORS[bi % BAND_COLORS.length]}"></span>${escapeHtml(band.label)} reps</span>`)
    .join("");

  box.innerHTML =
    `<div class="svgc-legend">${legend}</div>` +
    `<svg class="svgc-svg lb-svg" width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Leaderboard">` +
    grid + body + names + xLabels +
    `</svg>`;
}

function renderPersonalRecords() {
  const formula = currentFormula();
  const exercise = els.exercise.value;
  const base = selectionRecords(computedRecords(), exercise);
  const filtered = filterRecords(base, { excludeDropsets: els.excludeDropsets.checked });
  // Personal records for the currently selected exercise/group only (one row per
  // athlete), honouring the same sex/bodyweight comparison filter as the chart.
  const prs = personalRecords(filtered, formula)
    .filter((p) => p.exerciseName === exercise)
    .filter((p) => athletePassesColiseum(p.username));
  prs.sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm);

  els.prCount.textContent = `— ${exercise} (${prs.length})`;
  const head = `<thead><tr><th>Athlete</th><th class="num">Top weight (kg)</th><th class="num">Best 1RM (kg)</th><th class="num">Date</th></tr></thead>`;
  const rows = prs
    .map(
      (p: PersonalRecord) =>
        `<tr><td>${escapeHtml(p.user)}</td>` +
        `<td class="num">${wr(p.topWeight.weight, p.topWeight.reps)}</td>` +
        `<td class="num">${fmt(p.bestE1rm.e1rm)}</td><td class="num">${p.bestE1rm.date}</td></tr>`,
    )
    .join("");
  els.prTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="4" class="muted">No records for this exercise.</td></tr>`}</tbody>`;
}

// State for the currently shown athlete. The displayed-order arrays let the
// (delegated) click handlers map a clicked row back to its data.
// Exercises shown in the (date-filtered) list, in display order — what the
// exercises row click handler maps an index back to.
let exercisesView: string[] = [];
let selectedExercise: string | null = null; // null = exercise list; set = drill-in detail
// Extra exercises folded into the current drill-in so several lifts (e.g. Squat
// + Smith Machine Squat) are viewed together as one. Reset on each new drill-in.
let combinedWith: string[] = [];
/** Relabel the combined exercises to the primary so all the existing per-exercise
 * drill-in logic treats them as one lift. A no-op when nothing is combined. */
function remapCombined(recs: SetRecord[]): SetRecord[] {
  if (combinedWith.length === 0 || selectedExercise === null) return recs;
  const extra = new Set(combinedWith);
  const primary = selectedExercise;
  return recs.map((r) => (extra.has(r.exerciseName) ? { ...r, exerciseName: primary } : r));
}
let athleteWorkouts: WorkoutDay[] = [];

// A row in the Workouts list: a day or a week (or an empty rest day).
interface WorkoutGroup {
  label: string;
  date: string; // ISO day (day view) or week-start (week view) — lets the calendar jump here
  totalSets: number;
  exercises: ExerciseCount[];
  sets: SetRecord[];
  rest: boolean;
}
let workoutGroups: WorkoutGroup[] = [];
let workoutsPage = 0;
let workoutsPageSize = 50; // entries per page in the Workouts list (20 or 50)
// How the Exercises list is ordered: "sets" = flat, most-trained first;
// "category" = grouped by muscle/movement category (categories ordered by total
// sets), and within each category still by sets.
let exerciseSort: "sets" | "category" | "tier" = "category";
// "Legs (all)" is a broad umbrella that overlaps the narrower leg splits, so it's
// hidden from the By-category list by default; a Settings toggle brings it back.
let showLegsAll = (() => { try { return localStorage.getItem("colosseum.legsAll") === "1"; } catch { return false; } })();
// Which Exercises in-page tab is showing: the records-style list, or the compare graph.
let exercisesTab: "list" | "compare" = "list";
// Editable rep-max columns for the List & stats tab (the working weight for N reps
// off the best 1RM in the selected period). The owner can change the rep counts.
let repMaxCols: number[] = [1];
// Live search filter for the exercises list (substring on the exercise name).
let exerciseSearch = "";
// When true, append exercises this athlete has never logged (greyed) so gaps
// in their training are visible instead of being an empty search result.
let exerciseShowNotTrained = false;
// When false (default), 3rd-tier exercises (cardio / mobility / warm-ups — not
// really strength) are folded out of the list; the toggle reveals them.
let exerciseShowThird = false;
// In category mode, which category headers are EXPANDED (tapped open). Empty by
// default, so every category starts collapsed — the list opens as a tidy set of
// category headers you tap to open.
const expandedExCats = new Set<string>();
// Same idea for the By-tier sort: which frequency tiers (S/A/B/C/D) are expanded.
const expandedExTiers = new Set<string>();
// Categories the owner has chosen to HIDE from the By-category list (picker chips).
const hiddenExCats = new Set<string>((() => {
  try { return JSON.parse(localStorage.getItem("colosseum.hiddenCats") ?? "[]") as string[]; } catch { return []; }
})());
// Which exercise categories are expanded in the Exercises tab. null = first paint
// (open them all); a Set afterwards = the user's remembered open/closed choices.
let bwOpenCats: Set<string> | null = null;

/** Build the custom athlete chip row from the (hidden) select's options. */
function buildAthleteChips() {
  els.athleteChips.innerHTML = [...els.athlete.options]
    .map(
      (o) =>
        `<button type="button" class="athlete-chip" role="radio" data-username="${escapeHtml(o.value)}">${escapeHtml(o.text)}</button>`,
    )
    .join("");
  syncAthleteChips();
}

/** Mark the chip matching the selected athlete active (chips mirror the select). */
function syncAthleteChips() {
  const active = els.athlete.value;
  for (const btn of els.athleteChips.querySelectorAll<HTMLButtonElement>(".athlete-chip")) {
    const on = btn.dataset.username === active;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
    // Bring the selected chip into view in the horizontally-scrolling row so it's
    // visible in the sticky bar even if it was scrolled off to the side.
    if (on) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

/** Re-render every athlete sub-page for the selected athlete (resets paging). */
function renderAthlete() {
  saveLastAthlete(els.athlete.value); // remember across reloads
  syncAthleteChips();
  workoutsPage = 0;
  selectedExercise = null;
  athleteWorkouts = workoutsForUser(activeRecords(), els.athlete.value);
  els.summaryOut.textContent = ""; // clear last athlete's AI summary
  initHeatYear();
  renderAthleteProfile();
  renderAthleteStats();
  renderMomentum();
  renderTrainBreakdown();
  renderMuscleMap();
  renderExercisesPage();
  renderWorkoutCalendar();
  renderWorkoutSetsChart();
  renderWorkoutsPage();
}

// ---- Athlete Records sub-page: this athlete's PRs across all exercises ----
/** Profile line for the selected athlete: a lead nFFMI badge (computed from
 * weight / height / body fat) followed by the raw specs it's built from. */
function renderAthleteProfile() {
  const p = ATHLETES[els.athlete.value];
  if (!p) {
    els.athleteProfile.textContent = "No profile on file";
    return;
  }
  const specs = [`${p.weight} kg`, `${p.height} cm`, `${pct(p.bodyFat)} body fat`];
  if (p.age != null) specs.push(`age ${p.age}`);
  const specLine = `<span class="profile-specs">${specs.join("  ·  ")}</span>`;

  const comp = bodyComposition(p);
  if (!comp) {
    els.athleteProfile.innerHTML = specLine;
    return;
  }
  // nFFMI = lean-mass index normalised to 1.8 m. Lead with it; show the lean
  // mass it implies in the tooltip so the number is traceable to the specs.
  const badge =
    `<span class="nffmi-badge" title="Normalised fat-free mass index — lean mass ` +
    `${comp.leanMass.toFixed(1)} kg ÷ height², scaled to 1.8 m. ~22 trained, ~25 natural ceiling.">` +
    `<span class="nffmi-val">${comp.nffmi.toFixed(1)}</span>` +
    `<span class="nffmi-lbl">nFFMI</span></span>`;
  els.athleteProfile.innerHTML = badge + specLine;
}

// Category palette for the training breakdown (warm-to-cool, distinct hues).
const CATEGORY_COLORS: Record<TrainingCategory, string> = {
  Legs: "#284e86",
  Chest: "#2f7d6b",
  Back: "#3b66a6",
  Shoulders: "#b8902f",
  Arms: "#9c5bb8",
  Core: "#c0603a",
  Skill: "#5b8c3a",
  Mobility: "#7fa1d4",
  Cardio: "#6b7280",
  Other: "#cbd5e1",
};

/** Colour for a LIST_CATEGORIES bucket (the new multi-category set used by the
 * By-category list, Group view and compare picks). Muscle groups reuse
 * CATEGORY_COLORS; the pattern/leg-split buckets get their own shades. */
const LIST_CATEGORY_COLORS: Record<string, string> = {
  "Squat pattern": "#1f6f8b",
  "Deadlift pattern": "#3a4a86",
  "Deadlift accessory": "#7a6cae",
  "Legs (all)": "#284e86",
  "Legs (quads/glutes/hams)": "#2f6fb0",
};
const listCatColor = (c: string): string =>
  LIST_CATEGORY_COLORS[c] ?? CATEGORY_COLORS[c as TrainingCategory] ?? CATEGORY_COLORS.Other;

/** Compact "what they've been doing" stat chips for the selected athlete. */
function renderAthleteStats() {
  const s = athleteSummary(activeRecords(), els.athlete.value);
  if (s.sets === 0) {
    els.athleteStats.innerHTML = "";
    return;
  }
  const chip = (label: string, value: string) =>
    `<span class="stat-chip"><span class="stat-val">${value}</span><span class="stat-lbl">${label}</span></span>`;
  const chips = [
    chip("training", s.firstDate && s.lastDate ? trainingDuration(s.firstDate, s.lastDate) : "—"),
    chip("per week", s.sessionsPerWeek.toFixed(1)),
  ];
  els.athleteStats.innerHTML = chips.join("");
}

/**
 * Momentum row: for the athlete's most-trained lifts, a chip showing whether the
 * estimated 1RM is trending up or down (kg/week from a least-squares fit over the
 * weekly 1RM history). An at-a-glance "what's moving" read, built from the same
 * tested linearFit + exerciseProgressByWeek the progress chart uses. Only lifts
 * with enough history (≥3 data weeks) get a chip, so a slope isn't read off noise.
 */
function renderMomentum() {
  const username = els.athlete.value;
  const formula = currentFormula();
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  // Consider the athlete's most-trained exercises, then keep those with a trend.
  const top = exerciseCountsForUser(activeRecords(), username).slice(0, 12);
  const chips: { name: string; perWeek: number }[] = [];
  for (const c of top) {
    const pts = exerciseProgressByWeek(recs, username, c.exerciseName, formula).filter((p) => p.bestE1rm !== null);
    if (pts.length < 3) continue; // need a few weeks before a slope means anything
    const t0 = Date.parse(pts[0]!.date);
    const fit = linearFit(pts.map((p) => ({ x: (Date.parse(p.date) - t0) / 86_400_000, y: p.bestE1rm! })));
    if (!fit) continue;
    chips.push({ name: c.exerciseName, perWeek: fit.slope * 7 });
  }
  if (chips.length === 0) {
    els.momentum.innerHTML = "";
    return;
  }
  // Most movement first (by absolute rate); show the top 6 so the row stays tidy.
  chips.sort((a, b) => Math.abs(b.perWeek) - Math.abs(a.perWeek));
  const body = chips
    .slice(0, 6)
    .map((m) => {
      const up = m.perWeek > 0.05;
      const down = m.perWeek < -0.05;
      const cls = up ? "mo-up" : down ? "mo-down" : "mo-flat";
      const arrow = up ? "▲" : down ? "▼" : "▪";
      const rate = `${m.perWeek >= 0 ? "+" : ""}${m.perWeek.toFixed(1)}`;
      return (
        `<span class="mo-chip ${cls}" title="${escapeHtml(m.name)}: ${rate} kg/week estimated-1RM trend">` +
        `<span class="mo-arrow">${arrow}</span> ${escapeHtml(m.name)} ` +
        `<span class="mo-rate">${rate} kg/wk</span></span>`
      );
    })
    .join("");
  els.momentum.innerHTML = `<div class="mo-lead muted">Momentum <span class="mo-sub">(est. 1RM trend)</span></div><div class="mo-chips">${body}</div>`;
}

/** "What they train": a proportional bar of sets per muscle/movement category. */
function renderTrainBreakdown() {
  const counts = exerciseCountsForUser(activeRecords(), els.athlete.value);
  const byCat = new Map<TrainingCategory, number>();
  let total = 0;
  for (const c of counts) {
    const cat = exerciseCategory(c.exerciseName);
    byCat.set(cat, (byCat.get(cat) ?? 0) + c.count);
    total += c.count;
  }
  if (total === 0) {
    els.trainBreakdown.innerHTML = "";
    return;
  }
  const cats = TRAINING_CATEGORIES.filter((c) => byCat.get(c));
  const pct = (c: TrainingCategory) => (byCat.get(c)! / total) * 100;
  // Labels live on the bar itself (no separate legend). Only segments wide
  // enough to fit text are labelled; the rest still show their share on hover.
  const bar = cats
    .map((c) => {
      const p = pct(c);
      const label = p >= 11 ? `${c} ${p.toFixed(0)}%` : p >= 6 ? `${p.toFixed(0)}%` : "";
      return (
        `<span class="tb-seg" style="flex:${p.toFixed(2)};background:${CATEGORY_COLORS[c]}" ` +
        `title="${c}: ${byCat.get(c)} sets (${p.toFixed(0)}%)">` +
        `${label ? `<span class="tb-seg-lbl">${escapeHtml(label)}</span>` : ""}</span>`
      );
    })
    .join("");
  els.trainBreakdown.innerHTML =
    `<div class="tb-title muted">What ${escapeHtml(athleteLabel())} trains <span class="tb-sub">(${total.toLocaleString()} sets)</span></div>` +
    `<div class="tb-bar">${bar}</div>`;
}

/**
 * Front/back muscle map: simplified body silhouettes whose regions are shaded by
 * how STRONG the athlete is in the matching category — their best StrengthLevel
 * strength percentile (0..100, vs the population) among that category's lifts.
 * So a darker muscle means "stronger here", not "trained more". Untrained or
 * unscored regions show light grey. Hover a region for the percentile.
 */
function renderMuscleMap() {
  // Best strength percentile per category for this athlete (percentile is 0..1
  // in the data; ×100 for display). Falls back to grey where there's no score.
  const username = els.athlete.value;
  const byCat = new Map<TrainingCategory, number>();
  for (const r of activeRecords()) {
    if (r.username !== username || r.percentile === null) continue;
    const cat = exerciseCategory(r.exerciseName);
    const cur = byCat.get(cat);
    if (cur === undefined || r.percentile > cur) byCat.set(cat, r.percentile);
  }
  if (byCat.size === 0) {
    els.muscleMapBody.innerHTML = `<p class="muted">No strength scores yet for this athlete.</p>`;
    return;
  }
  // Opacity scales with the strength percentile itself (0..1 → 0.15..1), so the
  // shade reads as an absolute strength level, comparable across muscles.
  const fillFor = (cat: TrainingCategory): string => {
    const pct = byCat.get(cat);
    if (pct === undefined) return `fill:#e7e6e1`; // no strength score → light grey
    const op = 0.15 + 0.85 * Math.max(0, Math.min(1, pct));
    return `fill:${CATEGORY_COLORS[cat]};fill-opacity:${op.toFixed(2)}`;
  };
  const title = (label: string, cat: TrainingCategory): string => {
    const pct = byCat.get(cat);
    return pct === undefined ? `${label}: no strength score` : `${label}: ${Math.round(pct * 100)}th percentile strength`;
  };
  // A region = one or more SVG shapes sharing a category's fill + tooltip.
  const reg = (cat: TrainingCategory, label: string, shapes: string) =>
    `<g style="${fillFor(cat)}"><title>${escapeHtml(title(label, cat))}</title>${shapes}</g>`;

  // --- FRONT view (chest, abs, biceps, quads, front delts) ---
  const front =
    `<svg viewBox="0 0 120 220" class="body-svg" role="img" aria-label="Front muscle map">` +
    // head + neck (neutral)
    `<g fill="#d9d7d0"><circle cx="60" cy="18" r="11"/><rect x="54" y="28" width="12" height="8"/></g>` +
    reg("Shoulders", "Shoulders", `<circle cx="38" cy="44" r="9"/><circle cx="82" cy="44" r="9"/>`) +
    reg("Chest", "Chest", `<path d="M44 38 H76 Q80 54 60 58 Q40 54 44 38 Z"/>`) +
    reg("Arms", "Arms (biceps)", `<rect x="26" y="48" width="9" height="30" rx="4"/><rect x="85" y="48" width="9" height="30" rx="4"/>`) +
    reg("Core", "Core (abs)", `<rect x="48" y="60" width="24" height="34" rx="4"/>`) +
    reg("Legs", "Legs (quads)", `<rect x="46" y="98" width="12" height="54" rx="5"/><rect x="62" y="98" width="12" height="54" rx="5"/>`) +
    `<g fill="#d9d7d0"><rect x="47" y="154" width="10" height="40" rx="4"/><rect x="63" y="154" width="10" height="40" rx="4"/></g>` +
    `</svg>`;

  // --- BACK view (upper back/lats, rear delts, triceps, glutes, hamstrings) ---
  const back =
    `<svg viewBox="0 0 120 220" class="body-svg" role="img" aria-label="Back muscle map">` +
    `<g fill="#d9d7d0"><circle cx="60" cy="18" r="11"/><rect x="54" y="28" width="12" height="8"/></g>` +
    reg("Shoulders", "Rear shoulders", `<circle cx="38" cy="44" r="9"/><circle cx="82" cy="44" r="9"/>`) +
    reg("Back", "Back (lats/traps)", `<path d="M44 38 H76 L74 74 Q60 82 46 74 Z"/>`) +
    reg("Arms", "Arms (triceps)", `<rect x="26" y="48" width="9" height="30" rx="4"/><rect x="85" y="48" width="9" height="30" rx="4"/>`) +
    reg("Legs", "Glutes", `<path d="M47 92 Q60 86 73 92 Q74 104 60 104 Q46 104 47 92 Z"/>`) +
    reg("Legs", "Legs (hamstrings)", `<rect x="46" y="106" width="12" height="48" rx="5"/><rect x="62" y="106" width="12" height="48" rx="5"/>`) +
    `<g fill="#d9d7d0"><rect x="47" y="156" width="10" height="38" rx="4"/><rect x="63" y="156" width="10" height="38" rx="4"/></g>` +
    `</svg>`;

  // Legend: the mapped categories, strongest first, with their percentile.
  const mapped: TrainingCategory[] = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];
  const legend = mapped
    .filter((c) => byCat.get(c) !== undefined)
    .sort((a, b) => (byCat.get(b) ?? 0) - (byCat.get(a) ?? 0))
    .map(
      (c) =>
        `<span class="mm-leg"><span class="mm-swatch" style="background:${CATEGORY_COLORS[c]}"></span>` +
        `${c} <span class="muted">${pct(byCat.get(c) ?? 0)}</span></span>`,
    )
    .join("");

  els.muscleMapBody.innerHTML =
    `<div class="mm-views"><figure><figcaption class="muted">Front</figcaption>${front}</figure>` +
    `<figure><figcaption class="muted">Back</figcaption>${back}</figure></div>` +
    `<div class="mm-legend">${legend}</div>` +
    `<p class="muted mm-note">Shaded by strength — best StrengthLevel percentile per muscle group (darker = stronger). Hover a region for its score.</p>`;
}

/** Compact, data-only block about the selected athlete for the AI to summarise. */
function athleteContext(): string {
  const username = els.athlete.value;
  const p = ATHLETES[username];
  const counts = exerciseCountsForUser(activeRecords(), username);
  const workouts = workoutsForUser(activeRecords(), username);
  const totalSets = counts.reduce((s, c) => s + c.count, 0);
  const prs = personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: true }),
    currentFormula(),
  );
  const topLifts = [...prs].sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm).slice(0, 8);

  return [
    `Athlete: ${athleteLabel()}`,
    p
      ? `Body: ${p.weight} kg, ${p.height} cm, ${pct(p.bodyFat)} body fat${p.age != null ? `, age ${p.age}` : ""}`
      : "Body: not on file",
    `Training: ${workouts.length} sessions, ${totalSets} sets, latest ${workouts[0]?.date ?? "n/a"}`,
    `Most-trained: ${counts.slice(0, 6).map((c) => `${c.exerciseName} (${c.count} sets)`).join(", ") || "none"}`,
    `Top bodyweight-adjusted est. 1RMs (${currentFormula()}): ` +
      (topLifts.map((l) => `${l.exerciseName} ${Math.round(l.bestE1rm.e1rm)} kg`).join(", ") || "none"),
  ].join("\n");
}

/** Ask the serverless function (Gemini) for a short summary of this athlete. */
async function runSummary() {
  if (location.protocol === "file:") {
    els.summaryOut.textContent =
      "AI summary works on the published website, not the local file. Open the deployed link.";
    return;
  }
  els.summariseBtn.disabled = true;
  els.summaryOut.textContent = "Thinking…";
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: athleteContext() }),
    });
    const payload = (await res.json()) as { summary?: string; error?: string };
    els.summaryOut.textContent = res.ok ? (payload.summary ?? "No summary.") : (payload.error ?? "Failed.");
  } catch {
    els.summaryOut.textContent = "Couldn't reach the AI service.";
  } finally {
    els.summariseBtn.disabled = false;
  }
}

function athleteLabel(): string {
  return els.athlete.options[els.athlete.selectedIndex]?.text ?? els.athlete.value;
}

/** Prev / range / Next controls for a paginated list. `size` defaults to the
 * app-wide PAGE_SIZE but callers (e.g. the workouts list) can pass their own. */
function pagerHtml(page: number, total: number, size: number = PAGE_SIZE): string {
  if (total <= size) return "";
  const pages = Math.ceil(total / size);
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    `<button class="page-btn" data-page="${page - 1}" ${page <= 0 ? "disabled" : ""}>‹ Prev</button>` +
    `<span class="muted">${from}–${to} of ${total}</span>` +
    `<button class="page-btn" data-page="${page + 1}" ${page >= pages - 1 ? "disabled" : ""}>Next ›</button>`
  );
}

/** Period options for the exercises list. `days` of 0 means "all time"; every
 * other entry is a rolling window counted back from today. Single source of
 * truth for both the dropdown menu and the cutoff/label helpers below. */
const EXERCISE_PERIODS: { days: number; label: string }[] = [
  { days: 0, label: "All time" },
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 2 weeks" },
  { days: 30, label: "Last month" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
  { days: 730, label: "Last 2 years" },
];

/** Currently-selected period, in days (0 = all time). Defaults to the last 3
 * months so the List & stats view opens on recent strength, not all-time. */
let exerciseRangeDays = 90;

/** Cutoff ISO date for the chosen period (e.g. last 90 days), or null for all
 * time. Anchored to today so "last month" means recent calendar time. */
function exerciseRangeCutoff(): string | null {
  if (exerciseRangeDays <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - exerciseRangeDays);
  return d.toISOString().slice(0, 10);
}

/** Human label for the active period, e.g. "Last 3 months". */
function exerciseRangeLabel(): string {
  return EXERCISE_PERIODS.find((p) => p.days === exerciseRangeDays)?.label ?? "All time";
}

/** Build the custom Period dropdown's options and wire selection. Picking an
 * option updates the value label, closes the menu, and re-renders the list. */
function setupExerciseRange(): void {
  const menu = els.exerciseRange.querySelector<HTMLElement>(".period-dd-menu")!;
  const valueEl = els.exerciseRange.querySelector<HTMLElement>(".period-dd-value")!;
  const paint = () => {
    valueEl.textContent = exerciseRangeLabel();
    for (const o of menu.querySelectorAll<HTMLElement>(".period-dd-opt"))
      o.classList.toggle("is-active", o.dataset.days === String(exerciseRangeDays));
  };
  menu.innerHTML = EXERCISE_PERIODS.map(
    (p) =>
      `<button type="button" class="period-dd-opt" role="option" data-days="${p.days}">` +
      `${escapeHtml(p.label)}</button>`,
  ).join("");
  paint();

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".period-dd-opt");
    if (!btn) return;
    exerciseRangeDays = Number(btn.dataset.days) || 0;
    els.exerciseRange.open = false; // close the dropdown after a pick
    paint();
    selectedExercise = null;
    renderExercisesPage();
  });

  // Close when clicking anywhere outside the dropdown (native <details> stays
  // open otherwise).
  document.addEventListener("click", (e) => {
    if (els.exerciseRange.open && !els.exerciseRange.contains(e.target as Node))
      els.exerciseRange.open = false;
  });
}

/** Wire the By-sets / By-category sort toggle for the exercises list. Picking a
 * mode updates {@link exerciseSort}, resets paging, and re-renders. */
function setupExerciseSort(): void {
  els.exerciseSort.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".ex-sort-btn");
    if (!btn) return;
    const d = btn.dataset.sort;
    const mode = d === "category" ? "category" : d === "tier" ? "tier" : "sets";
    if (mode === exerciseSort) return;
    exerciseSort = mode;
    for (const b of els.exerciseSort.querySelectorAll<HTMLElement>(".ex-sort-btn"))
      b.classList.toggle("is-active", b.dataset.sort === mode);
    selectedExercise = null;
    renderExercisesPage();
  });
}

/** Wire the exercises search box and the "Show not-trained" toggle. Both reset
 * paging and re-render the list. */
function setupExerciseSearch(): void {
  els.exerciseSearch.addEventListener("input", () => {
    exerciseSearch = els.exerciseSearch.value;
    selectedExercise = null;
    renderExercisesPage();
  });
  els.exerciseNotTrained.addEventListener("change", () => {
    exerciseShowNotTrained = els.exerciseNotTrained.checked;
    selectedExercise = null;
    renderExercisesPage();
  });
  els.exerciseShowThird.addEventListener("change", () => {
    exerciseShowThird = els.exerciseShowThird.checked;
    selectedExercise = null;
    renderExercisesPage();
  });
}

/**
 * Re-order an exercise-count list for the active {@link exerciseSort}. In
 * "sets" mode the input order (most-trained first) is kept as-is. In "category"
 * mode exercises are bucketed by {@link exerciseCategory}, the categories are
 * ordered by their combined set count (busiest category first), and within each
 * category the most-trained exercise stays on top. Input order is preserved
 * within buckets, so the per-category sort matches the incoming sets order.
 */
function orderedExerciseCounts<T extends ExerciseCount>(counts: T[]): (T & { _cat?: string })[] {
  if (exerciseSort === "tier") {
    // Tier mode is just most-trained-first; the tier headers are emitted during
    // render as the set count crosses each threshold.
    return [...counts].sort((a, b) => b.count - a.count);
  }
  if (exerciseSort !== "category") return counts;
  // Multi-membership: a lift is repeated once under EACH category it belongs to
  // (deadlift shows under Legs, Back and Core). Each copy carries `_cat` so the
  // render emits the right header and the click→exercise map still lines up.
  const buckets = new Map<string, (T & { _cat?: string })[]>();
  for (const c of counts)
    for (const cat of exerciseCategories(c.exerciseName)) {
      if (cat === "Legs (all)" && !showLegsAll) continue; // hidden unless toggled on in Settings
      if (hiddenExCats.has(cat)) continue; // hidden via the category picker
      (buckets.get(cat) ?? buckets.set(cat, []).get(cat)!).push({ ...c, _cat: cat });
    }
  // Busiest category first; within LIST_CATEGORIES order for ties.
  return [...buckets.entries()]
    .sort((a, b) =>
      sumCounts(b[1]) - sumCounts(a[1]) ||
      LIST_CATEGORIES.indexOf(a[0]) - LIST_CATEGORIES.indexOf(b[0]),
    )
    .flatMap(([, items]) => items);
}

/** Frequency tiers by how many times an exercise has been logged (set count),
 * like a tier list: S = a staple, down to D = barely touched. Thresholds are
 * set-count cutoffs; an untrained (count 0) exercise has no tier. */
const FREQ_TIERS: { tier: string; min: number; label: string }[] = [
  { tier: "S", min: 25, label: "S · staples (25+ sets)" },
  { tier: "A", min: 15, label: "A · regulars (15–24)" },
  { tier: "B", min: 8, label: "B · occasional (8–14)" },
  { tier: "C", min: 3, label: "C · rare (3–7)" },
  { tier: "D", min: 1, label: "D · tried once or twice (1–2)" },
];

function frequencyTier(count: number): { tier: string; label: string } | null {
  for (const t of FREQ_TIERS) if (count >= t.min) return { tier: t.tier, label: t.label };
  return null;
}

function sumCounts(items: readonly ExerciseCount[]): number {
  return items.reduce((s, c) => s + c.count, 0);
}

// Distinct colours for the overlay lines (cycled if more exercises are picked).
const COMPARE_COLORS = [
  "#284e86", "#b8902f", "#2e7d52", "#a23b3b", "#6c4ab0", "#1f8a99", "#c46a1f", "#8a8d2f",
];

/**
 * Exercises-list "compare on one graph" tool: quick-pick rows to add a whole
 * category or frequency-tier of exercises at once, individual chips to fine-tune,
 * and an overlaid estimated-1RM trend line per selected exercise. Defaults to the
 * athlete's top two exercises the first time.
 */
function renderCompareSection() {
  const username = els.athlete.value;
  const counts = exerciseCountsForUser(activeRecords(), username);
  const exercises = counts.map((c) => c.exerciseName);

  // Drop any previous picks that this athlete doesn't have; seed with top 2.
  for (const name of [...compareSelected]) if (!exercises.includes(name)) compareSelected.delete(name);
  if (compareSelected.size === 0) for (const name of exercises.slice(0, 2)) compareSelected.add(name);

  // Category quick-picks: the same multi-membership buckets as the By-category
  // list (Squat pattern, Legs (all), …), only those this athlete trains, busiest
  // first. A button toggles every exercise in that bucket at once.
  const catSets = new Map<string, number>();
  for (const c of counts)
    for (const cat of exerciseCategories(c.exerciseName))
      catSets.set(cat, (catSets.get(cat) ?? 0) + c.count);
  const cats = LIST_CATEGORIES.filter((c) => catSets.has(c)).sort((a, b) => (catSets.get(b) ?? 0) - (catSets.get(a) ?? 0));
  els.compareCats.innerHTML = cats
    .map((c) => {
      const members = exercises.filter((e) => exerciseCategories(e).includes(c));
      const on = members.length > 0 && members.every((e) => compareSelected.has(e));
      return `<button type="button" class="compare-group${on ? " is-active" : ""}" data-cat="${escapeHtml(c)}" ` +
        `style="--gc:${listCatColor(c)}">${escapeHtml(c)}</button>`;
    })
    .join("");

  // Tier quick-picks: S/A/B/C/D by how often each exercise is logged.
  els.compareTiers.innerHTML = FREQ_TIERS.map((t) => {
    const members = counts.filter((c) => (frequencyTier(c.count)?.tier ?? null) === t.tier).map((c) => c.exerciseName);
    if (members.length === 0) return "";
    const on = members.every((e) => compareSelected.has(e));
    return `<button type="button" class="compare-group tier-pick${on ? " is-active" : ""}" data-tier="${t.tier}" ` +
      `title="${escapeHtml(t.label)}"><span class="tier-badge tier-${t.tier}">${t.tier}</span> ${members.length}</button>`;
  }).join("");

  renderCompareChips();
  renderCompareChart();
}

/**
 * Compare-graph exercise picker. To avoid a wall of pills: by DEFAULT it shows
 * only the SELECTED lifts (tap to remove, colour-matched to the chart), and you
 * SEARCH to add more — typing lists matches as add chips. Bulk category/tier
 * quick-picks live in a collapsible below.
 */
function renderCompareChips() {
  const username = els.athlete.value;
  const exercises = exerciseCountsForUser(activeRecords(), username).map((c) => c.exerciseName);
  const q = compareChipQuery.trim().toLowerCase();
  // Colour per selected exercise, matching the chart's line/legend colours.
  const selOrder = exercises.filter((e) => compareSelected.has(e));
  const colorOf = (name: string) => COMPARE_COLORS[selOrder.indexOf(name) % COMPARE_COLORS.length] ?? "#6b7280";

  let html: string;
  if (q) {
    // Search mode: matches to add/remove (selected ones marked).
    const matches = exercises.filter((e) => e.toLowerCase().includes(q)).slice(0, 40);
    html = matches.length
      ? matches
          .map((name) => {
            const on = compareSelected.has(name);
            return `<button type="button" class="compare-chip${on ? " is-active" : ""}" data-ex="${escapeHtml(name)}">` +
              `${on ? "✓ " : "+ "}${escapeHtml(name)}</button>`;
          })
          .join("")
      : `<span class="compare-empty muted">No exercise matches “${escapeHtml(compareChipQuery.trim())}”.</span>`;
  } else {
    // Default: just the selected lifts as removable, colour-matched chips.
    html = selOrder.length
      ? selOrder
          .map(
            (name) =>
              `<button type="button" class="compare-chip is-chosen" data-ex="${escapeHtml(name)}" style="--cc:${colorOf(name)}">` +
              `<span class="cc-dot" style="background:${colorOf(name)}"></span>${escapeHtml(name)} <span class="cc-x">✕</span></button>`,
          )
          .join("")
      : `<span class="compare-empty muted">No lifts selected — search above to add, or use Quick add.</span>`;
  }
  els.compareChips.innerHTML = html;
  els.compareSelCount.textContent = `${compareSelected.size} selected`;
}

/** Toggle every exercise in a category in/out of the compare selection. If they're
 * all already in, remove them; otherwise add the missing ones. Re-renders chips. */
function compareToggleCategory(cat: string) {
  const username = els.athlete.value;
  const members = exerciseCountsForUser(activeRecords(), username)
    .map((c) => c.exerciseName)
    .filter((e) => exerciseCategories(e).includes(cat));
  const allOn = members.length > 0 && members.every((e) => compareSelected.has(e));
  for (const e of members) {
    if (allOn) compareSelected.delete(e);
    else compareSelected.add(e);
  }
  renderCompareSection();
}

/** Toggle every exercise in a frequency tier in/out of the compare selection. */
function compareToggleTier(tier: string) {
  const username = els.athlete.value;
  const members = exerciseCountsForUser(activeRecords(), username)
    .filter((c) => (frequencyTier(c.count)?.tier ?? null) === tier)
    .map((c) => c.exerciseName);
  const allOn = members.length > 0 && members.every((e) => compareSelected.has(e));
  for (const e of members) {
    if (allOn) compareSelected.delete(e);
    else compareSelected.add(e);
  }
  renderCompareSection();
}

/** Draw the overlay on the SVG engine: one estimated-1RM line per ticked exercise
 * (trend view), or one floating weight→1RM bar per set (per-set view). */
function renderCompareChart() {
  const box = document.getElementById("compareChart");
  if (!box) return;

  const username = els.athlete.value;
  const formula = currentFormula();
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  const picks = [...compareSelected];
  const ts = (d: string) => Date.parse(d);

  if (picks.length === 0) {
    els.compareNote.textContent = "Tick one or more exercises above to overlay them.";
    els.compareSets.innerHTML = "";
    if (compareSvg) compareSvg.update({ series: [] });
    return;
  }

  let series: SvgSeries[];
  if (compareView === "perset") {
    series = picks.map((name, i) => {
      const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
      const points = recs
        .filter((r) => r.username === username && r.exerciseName === name)
        .map((s) => {
          const e1rm = addedWeight1RM(s, formula);
          if (e1rm === null) return null;
          const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
          return { x: ts(s.date), lo: added, hi: e1rm, meta: `×${s.reps ?? 0}` };
        })
        .filter((p): p is { x: number; lo: number; hi: number; meta: string } => p !== null);
      return { name, color, type: "range" as const, points };
    });
    els.compareNote.textContent =
      `Every set's weight → its own estimated 1RM (${formula}), one bar per set. Drag to pan · wheel to zoom · tap a bar.`;
  } else {
    series = picks.map((name, i) => {
      const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
      const raw = exerciseProgressByWeek(recs, username, name, formula)
        .filter((p) => p.bestE1rm !== null)
        .map((p) => ({ x: ts(p.date), y: Math.round(p.bestE1rm! * 10) / 10 }));
      // Current strength = best est. 1RM so far, so the line never drops.
      return { name, color, type: "line" as const, points: runningMaxPoints(raw) };
    });
    els.compareNote.textContent = `Current strength — best estimated 1RM (${formula}) reached up to each date (never drops). Drag to pan · wheel to zoom · tap a point.`;
  }

  const config = { series, xKind: "time" as const, yBeginAtZero: true, yUnit: "kg", insideLabels: true, height: 320 };
  if (!compareSvg) compareSvg = mountSvgChart(box, config);
  else compareSvg.update(config);

  renderCompareSets(picks, username, recs, formula);
}

/** The list of actual sets the compare graph is built from, newest first, one
 * row per logged set with a colour dot matching its line on the chart. */
function renderCompareSets(picks: string[], username: string, recs: SetRecord[], formula: OneRepMaxFormula) {
  type Row = { date: string; name: string; color: string; added: number; reps: number; e1rm: number | null };
  const rows: Row[] = [];
  picks.forEach((name, i) => {
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
    for (const s of recs.filter((r) => r.username === username && r.exerciseName === name)) {
      const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
      rows.push({ date: s.date, name, color, added, reps: s.reps ?? 0, e1rm: addedWeight1RM(s, formula) });
    }
  });
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (rows.length === 0) {
    els.compareSets.innerHTML = `<div class="cmp-sets-lbl muted">No logged sets for the selected exercises.</div>`;
    return;
  }
  const head = `<thead><tr><th>Date</th><th>Exercise</th><th class="num">Set</th><th class="num">est 1RM</th></tr></thead>`;
  const body = rows
    .map(
      (r) =>
        `<tr><td class="muted">${shortDate(r.date)}</td>` +
        `<td><span class="cmp-setdot" style="background:${r.color}"></span>${escapeHtml(r.name)}</td>` +
        `<td class="num">${fmt(r.added)}×${r.reps}</td>` +
        `<td class="num">${r.e1rm === null ? "—" : fmt(r.e1rm)}</td></tr>`,
    )
    .join("");
  els.compareSets.innerHTML =
    `<div class="cmp-sets-lbl muted">The ${rows.length} sets behind the graph (newest first)</div>` +
    `<div class="cmp-sets-scroll"><table class="data-table">${head}<tbody>${body}</tbody></table></div>`;
}

// ---- Exercises page: a list that drills into one exercise (like a tab change) ----
function renderExercisesPage() {
  if (selectedExercise !== null) {
    // Drill-in: hide the list-view chrome (tabs, filters, search, compare).
    els.exercisesTabs.hidden = true;
    els.exFiltersBtn.hidden = true;
    els.exerciseFilter.hidden = true;
    els.exSearchBar.hidden = true;
    els.exerciseCompare.hidden = true;
    els.exCatBar.hidden = true;
    els.exPeriodBar.hidden = true;
    renderExerciseDetail(selectedExercise);
    return;
  }
  // List view: the two in-page tabs decide what shows.
  els.exercisesTabs.hidden = false;
  const onCompare = exercisesTab === "compare";
  els.exCombineBar.hidden = true; // drill-in only
  els.exFiltersBtn.hidden = onCompare; // filters/search only apply to the list
  els.exSearchBar.hidden = onCompare;
  // The period is always shown in the list view so it's never a hidden surprise.
  els.exPeriodBar.hidden = onCompare;
  // Category picker only in By-category list mode.
  els.exCatBar.hidden = onCompare || exerciseSort !== "category";
  els.exerciseFilter.hidden = true; // the kebab menu starts closed
  els.exerciseCompare.hidden = !onCompare;
  els.athleteTable.hidden = onCompare;
  els.exercisesPager.hidden = onCompare;
  els.exerciseStats.hidden = onCompare;
  els.exerciseCalc.hidden = true; // single-exercise calculator: drill-in only
  if (onCompare) {
    renderCompareSection();
    els.athleteTitle.innerHTML = "";
    return;
  }
  // Everything in the Stats block (record, best-sets, weekly, targets) and the
  // reps↔weight Calculator are about ONE exercise, so they only belong in a
  // drill-in — hide the whole lot on the multi-exercise list.
  els.exerciseStats.hidden = true;
  els.exerciseCalc.hidden = true;
  els.exerciseRecord.hidden = true;
  els.exerciseTopSets.hidden = true;
  els.exerciseWeekly.hidden = true;
  els.exerciseTargets.hidden = true;
  els.exerciseProgress.hidden = true; // per-exercise graph only in the drill-in (SVG engine stays mounted, just hidden)
  const cutoff = exerciseRangeCutoff();
  const base = activeRecords(); // honour the app-wide active exercise set
  const scoped = cutoff ? base.filter((r) => r.date && r.date >= cutoff) : base;
  const username = els.athlete.value;

  // The displayed list: the athlete's trained exercises, plus — when "Show
  // not-trained" is on — every other exercise in the whole dataset that this
  // athlete has never logged, marked so the gaps are obvious instead of being
  // an empty search result.
  type ExItem = ExerciseCount & { trained: boolean };
  let items: ExItem[] = exerciseCountsForUser(scoped, username).map((c) => ({ ...c, trained: true }));
  if (exerciseShowNotTrained) {
    const trainedEver = new Set(exerciseCountsForUser(base, username).map((c) => c.exerciseName));
    for (const name of distinctExercises(base))
      if (!trainedEver.has(name)) items.push({ exerciseName: name, count: 0, trained: false });
  }
  // Fold out 3rd-tier (cardio / mobility / warm-up) exercises unless the toggle
  // is on — they're not really strength, so they just clutter the list.
  if (!exerciseShowThird) items = items.filter((it) => exerciseTier(it.exerciseName) !== "third");
  // Search filter (case-insensitive substring on the exercise name).
  const q = exerciseSearch.trim().toLowerCase();
  if (q) items = items.filter((it) => it.exerciseName.toLowerCase().includes(q));

  // "sets" keeps the most-trained order; "category" clusters by category. Either
  // way not-trained items (count 0) sort to the bottom of their group.
  const ordered = orderedExerciseCounts(items);
  exercisesView = ordered.map((it) => it.exerciseName);

  // Category picker: chips for every category this athlete has, tap to show/hide.
  if (exerciseSort === "category") {
    const present = new Set<string>();
    for (const it of items)
      for (const cat of exerciseCategories(it.exerciseName)) {
        if (cat === "Legs (all)" && !showLegsAll) continue;
        present.add(cat);
      }
    const cats = LIST_CATEGORIES.filter((c) => present.has(c));
    els.exCatBar.innerHTML =
      `<span class="ex-cat-bar-lbl muted">Show:</span>` +
      cats
        .map((c) => `<button type="button" class="ex-cat-chip${hiddenExCats.has(c) ? " is-off" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join("");
  }

  // List view: no title. The athlete chips above already name the athlete.
  els.athleteTitle.innerHTML = "";

  // Records-style rep-max columns: the working weight for each chosen rep count
  // off the exercise's best 1RM in the SELECTED PERIOD (so "Last 3 months" shows
  // recent strength). Rep counts are editable (repMaxCols).
  const formula = currentFormula();
  const prBasis = cutoff ? computedRecords().filter((r) => r.date && r.date >= cutoff) : computedRecords();
  const prByEx = new Map<string, PersonalRecord>();
  for (const p of personalRecords(
    filterRecords(prBasis, { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    formula,
  ))
    prByEx.set(p.exerciseName, p);
  const rm = (oneRm: number, reps: number): string => {
    const w = reps === 1 ? oneRm : weightForReps(oneRm, reps, formula);
    return w === null ? "—" : fmt(w);
  };
  // 3-letter codes (unique across this athlete's whole list) keep rows from
  // wrapping; the full name sits on a muted, ellipsised subline.
  const codes = exerciseCodesFor(ordered.map((it) => it.exerciseName));
  const nCols = repMaxCols.length;
  const rmCells = (name: string): string => {
    const oneRm = prByEx.get(name)?.bestE1rm.e1rm;
    return repMaxCols
      .map((reps) => `<td class="num">${oneRm === undefined ? "—" : rm(oneRm, reps)}</td>`)
      .join("");
  };
  // The actual best set behind that 1RM (real weight×reps), over the same period
  // — so the list shows genuine lifts next to the computed rep-max.
  const bestSetCell = (name: string): string => {
    const pr = prByEx.get(name);
    return `<td class="num ex-bestset">${pr ? wr(pr.bestE1rm.weight, pr.bestE1rm.reps) : "—"}</td>`;
  };
  const exCell = (name: string): string =>
    `<span class="ex-code">${escapeHtml(codes.get(name) ?? exerciseCode(name))}</span>` +
    `<span class="ex-name-sub muted">${escapeHtml(name)}${originBadge(name)}</span>`;

  const head =
    `<thead><tr><th>Exercise</th>` +
    // The rep-max column header is editable: type the rep count right in the head.
    repMaxCols
      .map((n) => `<th class="num rm-col-head"><input class="rm-col-input" type="number" min="1" max="30" step="1" value="${n}" inputmode="numeric" aria-label="Rep-max reps" />RM</th>`)
      .join("") +
    `<th class="num">Best set</th>` +
    `</tr></thead>`;
  const colspan = nCols + 2;
  // No pagination: the whole (date-scoped) list renders in one scroll. The Period
  // filter is what keeps it short — there's no page boundary to track.
  const start = 0;
  const prevItem = start > 0 ? ordered[start - 1] : undefined;
  let prevCat = exerciseSort === "category" && prevItem ? (prevItem._cat ?? null) : null;
  // Tier mode: track the previous row's tier so a header is emitted when it
  // changes (and not dropped at a page boundary).
  let prevTier =
    exerciseSort === "tier" && prevItem ? (frequencyTier(prevItem.count)?.tier ?? null) : null;
  const emptyCells = repMaxCols.map(() => `<td class="num">—</td>`).join("") + `<td class="num">—</td>`;
  const rowHtml = (it: ExItem, abs: number, rankCls: string) => {
    // Not-trained rows are greyed, non-clickable (no `ex-row` class / data-index).
    if (!it.trained)
      return (
        `<tr class="ex-missing-row"><td class="ex-name-cell">${exCell(it.exerciseName)}` +
        `<div class="ex-wk">not trained</div></td>${emptyCells}</tr>`
      );
    return (
      `<tr class="ex-row" data-index="${abs}"><td class="ex-name-cell ${rankCls}">` +
      `${exCell(it.exerciseName)} <span class="go-chevron">›</span></td>${rmCells(it.exerciseName)}${bestSetCell(it.exerciseName)}</tr>`
    );
  };
  const rows = ordered
    .map((it, i) => {
      const abs = start + i;
      if (exerciseSort === "tier") {
        // Emit a collapsible tier banner when the tier changes; tiers start
        // collapsed (expandedExTiers empty), so the list opens as tidy banners.
        const ft = frequencyTier(it.count);
        const tier = ft?.tier ?? null;
        let header = "";
        if (tier !== prevTier) {
          const collapsed = tier !== null && !expandedExTiers.has(tier);
          header = ft
            ? `<tr class="ex-tier-row${collapsed ? " is-collapsed" : ""}" data-tier="${ft.tier}"><td colspan="${colspan}"><span class="caret">▸</span> <span class="tier-badge tier-${ft.tier}">${ft.tier}</span> ${escapeHtml(ft.label)}</td></tr>`
            : "";
          prevTier = tier;
        }
        const tierHidden = tier !== null && !expandedExTiers.has(tier);
        return header + (tierHidden ? "" : rowHtml(it, abs, ""));
      }
      if (exerciseSort !== "category") return rowHtml(it, abs, abs === 0 && it.trained ? "rank-1" : "");
      // Category mode: emit a collapsible sub-header when the category changes;
      // a row under a collapsed category is skipped (its abs is unchanged, so the
      // click→exercise mapping still lines up when reopened). `_cat` is the bucket
      // this copy was placed in (a lift can appear under several categories).
      const cat = it._cat ?? exerciseCategory(it.exerciseName);
      let header = "";
      if (cat !== prevCat) {
        const collapsed = !expandedExCats.has(cat);
        header =
          `<tr class="ex-cat-row${collapsed ? " is-collapsed" : ""}" data-cat="${escapeHtml(cat)}">` +
          `<td colspan="${colspan}"><span class="caret">▸</span>${escapeHtml(cat)}</td></tr>`;
        prevCat = cat;
      }
      return header + (expandedExCats.has(cat) ? rowHtml(it, abs, "") : "");
    })
    .join("");
  const emptyMsg = q
    ? `No exercises match “${escapeHtml(exerciseSearch.trim())}”.`
    : "No exercises trained in this period.";
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="${colspan}" class="muted">${emptyMsg}</td></tr>`}</tbody>`;
  els.exercisesPager.innerHTML = ""; // no pagination — the Period filter scopes the list
}

/** Drill-in view for one exercise: a back link + its sets grouped by week. */
function renderExerciseDetail(exName: string) {
  // Bodyweight part = how much of the athlete's bodyweight this lift loads
  // (the coefficient). Shown at the very top so it's clear before any numbers.
  const coeff = coeffFor(exName);
  const bwPart =
    coeff > 0
      ? `<span class="ex-bwpart">Bodyweight part: ${pct(coeff)}</span>`
      : `<span class="ex-bwpart ex-bwpart--none">No bodyweight part (added weight only)</span>`;
  els.athleteTitle.innerHTML =
    `<button type="button" class="back-btn">‹ Exercises</button> ${escapeHtml(exName)}${originBadge(exName)} ${bwPart}` +
    ` <button type="button" class="ex-info-btn" data-exinfo="${escapeHtml(exName)}" title="See this exercise's merges & data (all athletes)">ℹ Exercise info</button>`;
  els.exercisesPager.innerHTML = "";
  const username = els.athlete.value;
  const pr = personalRecords(
    filterRecords(remapCombined(computedRecords()), { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    currentFormula(),
  ).find((p) => p.exerciseName === exName);
  renderCombineBar(exName, username);
  // Stats start collapsed on every drill-in (the <details> persists across
  // exercises, so reset it). renderExerciseWeekly always fills the chips, so the
  // dropdown always has content to show.
  els.exerciseStats.open = false;
  renderExerciseRecord(pr);
  renderExerciseTopSets(exName);
  renderExerciseWeekly(exName);
  renderExerciseTargets(pr);
  renderExerciseCalc(pr);
  renderExerciseProgressChart(exName);
  const weeks = setsByWeek(setsForUserExercise(remapCombined(data.records), username, exName));
  const head = `<thead><tr><th>Week</th><th class="num">Sets</th></tr></thead>`;
  // Label each row by its ISO week-of-year number (e.g. "w15"), with the start
  // date kept as a muted hint so the number can still be placed in time.
  const rows = weeks
    .map(
      (w) =>
        `<tr class="wk-row" data-wk="${w.weekStart}">` +
        `<td><span class="caret">▸</span>w${isoWeekNumber(w.weekStart)} ` +
        `<span class="muted wk-date-hint">${shortDate(w.weekStart)}</span></td>` +
        `<td class="num">${w.sets.length}</td></tr>`,
    )
    .join("");
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="2" class="muted">No sets.</td></tr>`}</tbody>`;

  // Expand the first (most recent) week by default, so the newest sets show
  // without a tap. Same mechanism a manual click on the week row uses.
  const firstWeek = weeks[0];
  const firstRow = els.athleteTable.querySelector<HTMLTableRowElement>("tr.wk-row");
  if (firstWeek && firstRow) insertDetail(firstRow, 2, setsByDateTableHtml(firstWeek.sets));
}

/** Drill-in "combine with" bar: chips for the exercises folded in (removable) +
 * a picker to add another of this athlete's lifts, so e.g. Squat + Smith Machine
 * Squat are viewed as one. */
function renderCombineBar(exName: string, username: string) {
  const trained = exerciseCountsForUser(activeRecords(), username).map((c) => c.exerciseName);
  const addable = trained.filter((n) => n !== exName && !combinedWith.includes(n));
  const chips = combinedWith
    .map((n) => `<button type="button" class="ex-combine-chip" data-remove="${escapeHtml(n)}" title="Remove">${escapeHtml(n)} ✕</button>`)
    .join("");
  const select =
    `<select class="ex-combine-add" aria-label="Combine with another exercise">` +
    `<option value="">＋ combine with…</option>` +
    addable.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("") +
    `</select>`;
  els.exCombineBar.hidden = false;
  els.exCombineBar.innerHTML =
    `<span class="ex-combine-lbl muted">Viewing together:</span>` +
    `<span class="ex-combine-chip is-primary">${escapeHtml(exName)}</span>` +
    chips +
    select;
}

/** Sets-per-week chips for the drilled-in exercise: the busiest week ever, this
 * week so far, and the trailing 1-month / 3-month average sets per week. */
function renderExerciseWeekly(exName: string) {
  const stats = weeklySetStats(setsForUserExercise(remapCombined(data.records), els.athlete.value, exName), todayIso());
  const chip = (label: string, value: string) =>
    `<div class="wk-chip"><span class="wk-val">${value}</span><span class="wk-lbl">${label}</span></div>`;
  els.exerciseWeekly.hidden = false;
  els.exerciseWeekly.innerHTML =
    `<div class="wk-lead muted">Sets per week</div>` +
    `<div class="wk-chips">` +
    chip("peak", String(stats.peakPerWeek)) +
    chip("this week", String(stats.thisWeek)) +
    chip("1-mo avg", stats.monthAvgPerWeek.toFixed(1)) +
    chip("3-mo avg", stats.threeMonthAvgPerWeek.toFixed(1)) +
    `</div>`;
}

/** Top-record card shown above the weeks list when an exercise is drilled into. */
function renderExerciseRecord(pr: PersonalRecord | undefined) {
  if (!pr) {
    els.exerciseRecord.hidden = true;
    els.exerciseRecord.innerHTML = "";
    return;
  }
  els.exerciseRecord.hidden = false;
  els.exerciseRecord.innerHTML =
    `<div class="record-item"><span class="record-label">Best 1RM</span>` +
    `<span class="record-value">${fmt(pr.bestE1rm.e1rm)} kg</span>` +
    `<span class="record-meta">${wr(pr.bestE1rm.weight, pr.bestE1rm.reps)} · ${shortDate(pr.bestE1rm.date)}</span></div>` +
    `<div class="record-item"><span class="record-label">Top weight</span>` +
    `<span class="record-value">${wr(pr.topWeight.weight, pr.topWeight.reps)} kg</span>` +
    `<span class="record-meta">${shortDate(pr.topWeight.date)}</span></div>`;
}

/**
 * The actual 5 best sets (by estimated 1RM) from the last 3 calendar months —
 * the real weight×reps lifted, not a computed rep-max. Shown under the record
 * card in a drill-in so the owner sees genuine recent top sets at a glance.
 */
function renderExerciseTopSets(exName: string) {
  const formula = currentFormula();
  const username = els.athlete.value;
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  const cutoff = d.toISOString().slice(0, 10);
  const scored = remapCombined(computedRecords())
    .filter((r) => r.username === username && r.exerciseName === exName && r.date && r.date >= cutoff)
    .map((s) => ({ s, e1rm: addedWeight1RM(s, formula) }))
    .filter((x): x is { s: SetRecord; e1rm: number } => x.e1rm !== null)
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 5);
  if (scored.length === 0) {
    els.exerciseTopSets.hidden = true;
    els.exerciseTopSets.innerHTML = "";
    return;
  }
  els.exerciseTopSets.hidden = false;
  const rows = scored
    .map((x) => {
      const added = x.s.origWeight !== undefined ? x.s.origWeight : x.s.weight;
      return (
        `<tr><td>${wr(added, x.s.reps)}</td>` +
        `<td class="num">${fmt(x.e1rm)}</td>` +
        `<td class="num muted">${x.s.date ? shortDate(x.s.date) : "—"}</td></tr>`
      );
    })
    .join("");
  els.exerciseTopSets.innerHTML =
    `<div class="ts-lead muted">Best sets · last 3 months</div>` +
    `<table class="data-table ts-table"><thead><tr><th>Set</th><th class="num">est 1RM</th><th class="num">when</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
}

/** Reps for which we show a target working weight under the record card. */
const TARGET_REPS = [5, 10, 15] as const;

/**
 * Rep-max targets derived from the athlete's best estimated 1RM: the load they
 * should be able to lift for 5, 10 and 15 reps under the active formula. These
 * are added-weight (bar) numbers, matching how "Best 1RM" is shown above.
 */
function renderExerciseTargets(pr: PersonalRecord | undefined) {
  const oneRm = pr?.bestE1rm.e1rm ?? null;
  if (oneRm === null || oneRm <= 0) {
    els.exerciseTargets.hidden = true;
    els.exerciseTargets.innerHTML = "";
    return;
  }
  const formula = currentFormula();
  const chips = TARGET_REPS.map((reps) => {
    const w = weightForReps(oneRm, reps, formula);
    return (
      `<div class="target-chip"><span class="target-reps">${reps}RM</span>` +
      `<span class="target-weight">${w === null ? "—" : `${fmt(w)} kg`}</span></div>`
    );
  }).join("");
  els.exerciseTargets.hidden = false;
  els.exerciseTargets.innerHTML =
    `<div class="target-lead muted">Estimated working weights (×${TARGET_REPS.join(", ×")} reps)</div>` +
    `<div class="target-chips">${chips}</div>`;
}

// Anchor 1RM the drill-in calculator converts against (the athlete's best for
// the open exercise). null when the exercise has no usable record → calc hidden.
let ecalcOneRm: number | null = null;

// The calculator's editable rows. Each is an independent weight↔reps pair; the
// cell the user last edited drives the other. Seeded with a spread of reps so it
// opens as a useful table (1, 3, 5, 8, 10, 12 reps) rather than a single cell.
interface EcalcRow {
  weight: number | null;
  reps: number | null;
}
const ECALC_SEED_REPS = [1, 3, 5, 8, 10, 12] as const;
let ecalcRowsState: EcalcRow[] = [];

/**
 * Build the reps↔weight calculator table for the drilled-in exercise. The
 * athlete's best estimated 1RM is the anchor; each row converts in added-weight
 * space off the added 1RM — the SAME basis as the target chips — so the numbers
 * line up. Seeded with one row per ECALC_SEED_REPS so it's a table from the off.
 */
function renderExerciseCalc(pr: PersonalRecord | undefined) {
  ecalcOneRm = pr?.bestE1rm.e1rm ?? null;
  if (ecalcOneRm === null || ecalcOneRm <= 0) {
    els.exerciseCalc.hidden = true;
    return;
  }
  els.exerciseCalc.hidden = false;
  els.exerciseCalc.open = false; // collapsed by default on every drill-in
  els.ecalcBasis.textContent = ` · anchored on ${fmt(ecalcOneRm)} kg best 1RM`;
  const formula = currentFormula();
  // Seed each row from a rep count → its predicted weight off the 1RM.
  ecalcRowsState = ECALC_SEED_REPS.map((reps) => ({
    reps,
    weight: weightForReps(ecalcOneRm!, reps, formula),
  }));
  ecalcRenderRows();
  ecalcUpdateNote();
}

/** Round reps for display: whole numbers, never below 0, "" if not finite. */
function ecalcFmtReps(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return "";
  return String(Math.max(0, Math.round(r)));
}

/** Round a weight for display: 1 dp, "" if not finite. */
function ecalcFmtWeight(w: number | null): string {
  if (w === null || !Number.isFinite(w)) return "";
  return String(Math.round(w * 10) / 10);
}

/** Paint the current calculator rows into the table body. */
function ecalcRenderRows() {
  els.ecalcRows.innerHTML = ecalcRowsState
    .map(
      (row, i) =>
        `<tr class="ecalc-row" data-index="${i}">` +
        `<td><input type="number" class="ecalc-input ecalc-cell-weight" step="0.5" inputmode="decimal" ` +
        `value="${ecalcFmtWeight(row.weight)}" aria-label="Weight in kg" /></td>` +
        `<td><input type="number" class="ecalc-input ecalc-cell-reps" step="1" min="1" inputmode="numeric" ` +
        `value="${ecalcFmtReps(row.reps)}" aria-label="Reps" /></td>` +
        `<td class="num"><button type="button" class="ecalc-del" aria-label="Remove row" title="Remove row">×</button></td></tr>`,
    )
    .join("");
}

/** Refresh the explanatory note under the calculator table. */
function ecalcUpdateNote() {
  if (ecalcOneRm === null) return;
  els.ecalcNote.textContent =
    `Estimates use the ${currentFormula()} formula. Edit any cell: change a weight ` +
    `to get its reps, or reps to get the weight. Lighter weight → more reps.`;
}

/**
 * Recompute the partner cell in ONE row when the user edits a cell. `source` is
 * the cell just typed in, so we never overwrite what they're typing. Out-of-range
 * values are shown raw, not clamped — a weight above the 1RM yields ~0 reps.
 */
function onExerciseCalcInput(index: number, source: "weight" | "reps") {
  if (ecalcOneRm === null) return;
  const tr = els.ecalcRows.querySelector<HTMLTableRowElement>(`tr[data-index="${index}"]`);
  const row = ecalcRowsState[index];
  if (!tr || !row) return;
  const formula = currentFormula();
  const weightInput = tr.querySelector<HTMLInputElement>(".ecalc-cell-weight")!;
  const repsInput = tr.querySelector<HTMLInputElement>(".ecalc-cell-reps")!;

  if (source === "weight") {
    const w = parseFloat(weightInput.value);
    if (!Number.isFinite(w) || w <= 0) {
      row.weight = null;
      row.reps = null;
      repsInput.value = "";
      return;
    }
    row.weight = w;
    row.reps = repsForWeight(ecalcOneRm, w, formula);
    repsInput.value = ecalcFmtReps(row.reps);
  } else {
    const r = Math.round(parseFloat(repsInput.value));
    if (!Number.isFinite(r) || r < 1) {
      row.weight = null;
      row.reps = null;
      weightInput.value = "";
      return;
    }
    row.reps = r;
    row.weight = weightForReps(ecalcOneRm, r, formula); // reps===1 ⇒ the 1RM
    weightInput.value = ecalcFmtWeight(row.weight);
  }
}

/** Add a blank editable row to the calculator. */
function ecalcAddRow() {
  ecalcRowsState.push({ weight: null, reps: null });
  ecalcRenderRows();
  // Focus the new row's weight cell for immediate typing.
  const last = els.ecalcRows.querySelector<HTMLTableRowElement>("tr.ecalc-row:last-child");
  last?.querySelector<HTMLInputElement>(".ecalc-cell-weight")?.focus();
}

/** Remove a calculator row by index. */
function ecalcRemoveRow(index: number) {
  if (index < 0 || index >= ecalcRowsState.length) return;
  ecalcRowsState.splice(index, 1);
  ecalcRenderRows();
}

/** "Current strength" = the best estimated 1RM achieved UP TO each date, so the
 * line never drops: a weaker set just means an off day, not lost strength. Takes
 * x-sorted {x,y} points and returns the running maximum of y. */
function runningMaxPoints<T extends { x: number; y: number }>(points: T[]): T[] {
  let m = -Infinity;
  return points.map((p) => {
    m = Math.max(m, p.y);
    return { ...p, y: Math.round(m * 10) / 10 };
  });
}
const CURRENT_STRENGTH_COLOR = "#2e7d52";

/** Fit y = a + b·ln(day+1) (a logarithmic curve — diminishing returns) by least
 * squares on (ln(day+1), y). Returns null if it can't be fit. */
function logFit(pts: { x: number; y: number }[]): { a: number; b: number } | null {
  const f = linearFit(pts.map((p) => ({ x: Math.log(p.x + 1), y: p.y })));
  return f ? { a: f.intercept, b: f.slope } : null;
}

/** One combined per-exercise graph (drill-in). Every "view" is a series you can
 * switch on/off by tapping its legend key: Per-set range (each set's weight→1RM,
 * dashes = reps), Current strength (best 1RM so far — a connected line), Est.
 * 1RM/wk dots, Sets/week bars, and an optional logarithmic Trend. kg on the left
 * axis (so the bars and lines share one scale); weekly set-count on the right. */
function renderExerciseProgressChart(exName: string) {
  const box = document.getElementById("exerciseProgressChart");
  if (!box) return;
  // Same records the Records card/table use (honour "Exclude dropsets").
  const recs = filterRecords(remapCombined(computedRecords()), { excludeDropsets: els.excludeDropsets.checked });
  const formula = currentFormula();
  const username = els.athlete.value;
  const ts = (d: string) => Date.parse(d);
  const mount = (config: SvgChartConfig) => {
    if (!exerciseSvg) exerciseSvg = mountSvgChart(box, config);
    else exerciseSvg.update(config);
  };
  els.exPersetBest.hidden = false; // "Best set only" filters the per-set range view
  els.exPersetBest.classList.toggle("is-active", exPersetBestOnly);
  els.exPersetBest.setAttribute("aria-pressed", String(exPersetBestOnly));

  // ---- Per-set range: one weight→1RM bar per set on a real time axis; same-day
  // sets fan out within the day. Optionally only each day's best set. ----
  let sets = remapCombined(computedRecords())
    .filter((r) => r.username === username && r.exerciseName === exName && r.weight !== null)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.setNumber - b.setNumber));
  if (exPersetBestOnly) {
    const bestByDay = new Map<string, SetRecord>();
    const scoreOf = (r: SetRecord) =>
      addedWeight1RM(r, formula) ?? (r.origWeight !== undefined ? (r.origWeight ?? 0) : (r.weight ?? 0));
    for (const s of sets) {
      const cur = bestByDay.get(s.date);
      if (!cur || scoreOf(s) > scoreOf(cur)) bestByDay.set(s.date, s);
    }
    sets = [...bestByDay.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  const perDay = new Map<string, number>();
  for (const s of sets) perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
  const seenInDay = new Map<string, number>();
  const rangePoints: SvgPoint[] = [];
  const strengthRaw: { x: number; y: number }[] = [];
  for (const s of sets) {
    const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
    const e1rm = addedWeight1RM(s, formula);
    const reps = s.reps ?? 0;
    const base = Date.parse(s.date);
    const total = perDay.get(s.date) ?? 1;
    const idx = seenInDay.get(s.date) ?? 0;
    seenInDay.set(s.date, idx + 1);
    const frac = total > 1 ? (idx / (total - 1) - 0.5) * 0.7 : 0;
    const x = base + frac * MS_DAY;
    rangePoints.push({
      x,
      lo: added,
      hi: e1rm ?? added,
      dashes: reps,
      meta:
        (e1rm === null ? `${fmt(added)}×${reps} (no 1RM est.)` : `${fmt(added)}×${reps} → ${fmt(e1rm)} 1RM`) +
        ` · ${shortDate(s.date)}` +
        (rpeFor(s) ? ` · RIR ${rpeFor(s)}` : ""),
    });
    if (e1rm !== null) strengthRaw.push({ x, y: e1rm });
  }
  const strengthSorted = strengthRaw.slice().sort((a, b) => a.x - b.x);
  const strengthPts = runningMaxPoints(strengthSorted);
  // A dot for EVERY set's estimated 1RM (per the request), not a weekly summary.
  const e1rmPts = strengthSorted.map((p) => ({ x: p.x, y: Math.round(p.y * 10) / 10 }));

  // ---- Weekly set counts (the only thing still aggregated by week) ----
  const weekly = exerciseProgressByWeek(recs, username, exName, formula);
  const setsPts = weekly.map((p) => ({ x: ts(p.date), y: p.sets }));

  if (rangePoints.length === 0 && e1rmPts.length === 0) {
    els.exerciseProgress.hidden = true;
    els.exerciseProgressNote.textContent = "";
    return;
  }
  els.exerciseProgress.hidden = false;

  // ---- Logarithmic trend (diminishing returns) over every set's 1RM ----
  let trendPts: { x: number; y: number }[] = [];
  if (strengthSorted.length >= 3) {
    const t0 = strengthSorted[0]!.x;
    const lf = logFit(strengthSorted.map((p) => ({ x: (p.x - t0) / MS_DAY, y: p.y })));
    const lastDay = (strengthSorted[strengthSorted.length - 1]!.x - t0) / MS_DAY;
    if (lf && lastDay > 0) {
      const N = 32;
      for (let i = 0; i <= N; i++) {
        const dd = (lastDay * i) / N;
        trendPts.push({ x: t0 + dd * MS_DAY, y: Math.round((lf.a + lf.b * Math.log(dd + 1)) * 10) / 10 });
      }
    }
  }

  const series: SvgSeries[] = [
    // kg series share the LEFT axis so the dots, bars and strength line align.
    { name: "Est. 1RM (per set)", color: "#b8902f", type: "scatter", axis: "left", points: e1rmPts },
    { name: "Current strength", color: CURRENT_STRENGTH_COLOR, type: "line", axis: "left", points: strengthPts },
    { name: "Per-set range", color: "#284e86", type: "range", axis: "left", points: rangePoints, hidden: true },
    { name: "Sets/week", color: "#6c4ab0", type: "bars", axis: "right", points: setsPts, hidden: true, fillOpacity: 0.18 },
  ];
  if (trendPts.length)
    series.push({ name: "Trend (log)", color: "#c0603a", type: "line", axis: "left", points: trendPts, hidden: true });

  mount({
    series, xKind: "time", yBeginAtZero: true, rightBeginAtZero: true,
    rightHeadroom: 5, // sets/week axis is 5× tall (baseline still 0), so the bars stay low and clear of the 1RM data
    yUnit: "kg", rightUnit: "sets", insideLabels: true, height: 320,
  });
  els.exerciseProgressNote.textContent =
    "One graph — tap a label to show/hide each view: Est. 1RM (a dot for every set), Current strength (best 1RM so far), Per-set range (weight→1RM, dashes = reps), Sets/week and a logarithmic Trend." +
    (exPersetBestOnly ? " Per-set views show each day's best set only." : "");
}


/** Clicks within the Exercises panel: drill into an exercise, expand a week, or go back. */
function onExerciseRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".xdd-rpe") && onSetRpeClick(target)) return; // the RIR picker handles itself
  if (toggleE1rmFormula(target)) return; // a 1RM cell → show its formula
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level

  // Category mode: tapping a category header collapses/expands its exercises.
  const catRow = target.closest("tr.ex-cat-row") as HTMLTableRowElement | null;
  if (catRow) {
    const cat = catRow.dataset.cat ?? "";
    if (expandedExCats.has(cat)) expandedExCats.delete(cat);
    else expandedExCats.add(cat);
    renderExercisesPage();
    return;
  }

  // Tier mode: tapping a tier banner collapses/expands its exercises.
  const tierRow = target.closest("tr.ex-tier-row") as HTMLTableRowElement | null;
  if (tierRow) {
    const tier = tierRow.dataset.tier ?? "";
    if (expandedExTiers.has(tier)) expandedExTiers.delete(tier);
    else expandedExTiers.add(tier);
    renderExercisesPage();
    return;
  }

  // Inside the drill-in view: a week -> expand to that week's sets (by date).
  const wkRow = target.closest("tr.wk-row") as HTMLTableRowElement | null;
  if (wkRow) {
    if (toggleCollapse(wkRow)) return;
    if (selectedExercise === null) return;
    const week = setsByWeek(setsForUserExercise(data.records, els.athlete.value, selectedExercise)).find(
      (w) => w.weekStart === wkRow.dataset.wk,
    );
    if (!week) return;
    insertDetail(wkRow, 2, setsByDateTableHtml(week.sets));
    return;
  }

  // List view: tapping an exercise switches to its detail (no inline dropdown).
  const row = target.closest("tr.ex-row") as HTMLTableRowElement | null;
  if (!row) return;
  const exName = exercisesView[Number(row.dataset.index)];
  if (exName === undefined) return;
  selectedExercise = exName;
  combinedWith = []; // fresh drill-in: not combined with anything yet
  renderExercisesPage();
}

// ---- Workouts page (one row per day or week, 20/page, expandable) ----
// The "alone" filter cycles three ways: show every session, only the ones the
// user tagged trained-alone, or only the ones they didn't. Rest days carry no
// tag, so they're dropped by both the alone-only and not-alone filters.
type AloneFilter = "both" | "alone" | "notAlone";
const ALONE_FILTER_LABEL: Record<AloneFilter, string> = {
  both: "Alone: Both",
  alone: "Alone: Only alone",
  notAlone: "Alone: Not alone",
};
const ALONE_FILTER_NEXT: Record<AloneFilter, AloneFilter> = {
  both: "alone",
  alone: "notAlone",
  notAlone: "both",
};
let aloneFilter: AloneFilter = "both";

function buildWorkoutGroups(): WorkoutGroup[] {
  // Filter on the "alone" tag: both (no filter), only tagged, or only untagged.
  const keep = (g: WorkoutGroup): boolean => {
    if (aloneFilter === "both") return true;
    if (g.rest) return false; // rest days are never tagged either way
    const tagged = aloneTags.has(aloneKey(g.date));
    return aloneFilter === "alone" ? tagged : !tagged;
  };
  if (els.workoutView.value === "week") {
    return weeksForUser(activeRecords(), els.athlete.value)
      .map((w) => ({
        label: `Week of ${shortDate(w.weekStart)}`,
        date: w.weekStart,
        totalSets: w.totalSets,
        exercises: w.exercises,
        sets: w.sets,
        rest: false,
      }))
      .filter(keep);
  }
  const days = els.restToggle.checked ? workoutsWithRestDays(athleteWorkouts) : athleteWorkouts;
  return days
    .map((d) => ({
      label: `${dowLetter(d.date)} ${shortDate(d.date)}`,
      date: d.date,
      totalSets: d.totalSets,
      exercises: d.exercises,
      sets: d.sets,
      rest: d.totalSets === 0,
    }))
    .filter(keep);
}

// ---- Workouts overview: a per-year heatmap of training days ----
let heatYear = 2026; // the year shown in single-year mode (‹ › to change)
let heatScope: "single" | "all" = "single"; // one year (scroll/nav) vs every year
let heatFilter = "cat:Legs"; // "all" | "cat:<Category>" | "ex:<Exercise>" — defaults to Legs
// When armed, tapping heatmap days toggles the "trained alone" tag (paint mode)
// instead of jumping to that day — so you can tag many days quickly in one go.
let aloneTagMode = false;

/** Map of this athlete's training dates (ISO) → total sets that day (unfiltered).
 * Used for the list of years; colouring uses {@link filteredDayCounts}. */
function trainingDays(): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of athleteWorkouts) if (d.totalSets > 0) m.set(d.date, d.totalSets);
  return m;
}

/** Sets on a day that match the active {@link heatFilter} (all / one category /
 * one exercise). */
function dayMatchCount(d: WorkoutDay): number {
  if (heatFilter.startsWith("cat:")) {
    const cat = heatFilter.slice(4);
    return d.exercises.reduce((s, e) => (exerciseCategory(e.exerciseName) === cat ? s + e.count : s), 0);
  }
  if (heatFilter.startsWith("ex:")) {
    const ex = heatFilter.slice(3);
    return d.exercises.reduce((s, e) => (e.exerciseName === ex ? s + e.count : s), 0);
  }
  return d.totalSets;
}

/** Training dates → matching set count, honouring the heatmap filter. */
function filteredDayCounts(): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of athleteWorkouts) {
    const c = dayMatchCount(d);
    if (c > 0) m.set(d.date, c);
  }
  return m;
}

/** Open the heatmap on the athlete's most recent training year, with the filter
 * reset to Legs (the default view). A previous athlete's *exercise* filter won't
 * carry over; categories like Legs are common to everyone, so we land on it. */
function initHeatYear() {
  const latest = athleteWorkouts.find((d) => d.totalSets > 0)?.date ?? athleteWorkouts[0]?.date;
  const y = Number(latest?.slice(0, 4));
  if (Number.isFinite(y)) heatYear = y;
  heatFilter = "cat:Legs";
  aloneTagMode = false; // start each athlete in normal tap-to-jump mode
}

/** Intensity bucket for a day's set count: 0 rest, then 1+/2+/4+/6+/10+ sets
 * (light blue → dark blue → light gold → dark gold). */
function heatLevel(sets: number): number {
  if (sets <= 0) return 0;
  if (sets < 2) return 1; // 1 set — light blue
  if (sets < 4) return 2; // 2–3 — darker blue
  if (sets < 6) return 3; // 4–5 — dark blue
  if (sets < 10) return 4; // 6–9 — light gold
  return 5; // 10+ — dark gold
}

/** The years (descending) that have any training, for the ‹ › year nav. */
function dataYears(trained: Map<string, number>): number[] {
  const years = [...new Set([...trained.keys()].map((d) => Number(d.slice(0, 4))))].sort((a, b) => b - a);
  return years.length ? years : [heatYear];
}

/** One year drawn as a single continuous heatmap (weeks as columns, Mon→Sun
 * rows) — weeks are never broken mid-column — with month labels along the top
 * aligned to the week each month begins. `counts` is the filtered day→sets map. */
function yearGridHtml(year: number, counts: Map<string, number>): { html: string; days: number; totalSets: number } {
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const startDow = (new Date(year, 0, 1).getDay() + 6) % 7; // Mon-first offset of Jan 1
  const cells: string[] = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="hm-cell empty"></div>`);
  let days = 0;
  let totalSets = 0;
  for (let doy = 0; doy < daysInYear; doy++) {
    const d = new Date(year, 0, 1 + doy);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const sets = counts.get(iso) ?? 0;
    if (sets) {
      days++;
      totalSets += sets;
    }
    const isToday = iso === todayIso();
    // Days the athlete tagged "trained alone" get a red outline on the heatmap.
    const isAlone = sets > 0 && aloneTags.has(aloneKey(iso));
    // Tint alternating months so each month's squares read as a distinct band.
    const mOdd = d.getMonth() % 2 === 1 ? " hm-modd" : "";
    const title = `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${year}${isToday ? " (today)" : ""}${sets ? ` — ${sets} sets${isAlone ? " — trained alone" : ""} — tap to jump` : " — rest"}`;
    cells.push(
      `<div class="hm-cell lvl-${heatLevel(sets)}${isToday ? " is-today" : ""}${isAlone ? " hm-alone" : ""}${mOdd}"${sets ? ` data-date="${iso}"` : ""} title="${title}"><span class="hm-dom">${d.getDate()}</span></div>`,
    );
  }

  // Month labels: place each at the week-column where its 1st falls.
  const numWeeks = Math.ceil((startDow + daysInYear) / 7);
  const labels = Array.from({ length: 12 }, (_, m) => {
    const doyStart = Math.round((Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
    const col = Math.floor((startDow + doyStart) / 7) + 1; // 1-based grid column
    return `<span class="hm-mlabel" style="grid-column-start:${col}">${MONTH_ABBR[m]}</span>`;
  }).join("");

  const html =
    `<div class="hm-year"><div class="hm-cal">` +
    `<div class="hm-months" style="grid-template-columns:repeat(${numWeeks},var(--hm-col))">${labels}</div>` +
    `<div class="hm-grid">${cells.join("")}</div>` +
    `</div></div>`;
  return { html, days, totalSets };
}

/** Single-year / All-years toggle. */
function heatScopeToggle(): string {
  const btn = (s: "single" | "all", label: string) =>
    `<button type="button" class="cal-mode-btn${heatScope === s ? " is-active" : ""}" data-heat-scope="${s}">${label}</button>`;
  return `<div class="cal-mode">${btn("single", "Single year")}${btn("all", "All years")}</div>`;
}

/** Human label for the active heatmap filter value. */
function heatFilterLabel(): string {
  if (heatFilter.startsWith("cat:")) return heatFilter.slice(4);
  if (heatFilter.startsWith("ex:")) return heatFilter.slice(3);
  return "All exercises";
}

/** Filter as a custom dropdown (no native <select>): all exercises, one training
 * category, or one exercise. Lives inside the re-rendered calendar HTML, so it's
 * handled by delegation in the workoutCalendar click handler (data-heatval). */
function heatFilterSelect(): string {
  const exs = exerciseCountsForUser(activeRecords(), els.athlete.value); // most-trained first
  const cats = TRAINING_CATEGORIES.filter((c) => exs.some((e) => exerciseCategory(e.exerciseName) === c));
  const opt = (val: string, label: string) =>
    `<button type="button" class="xdd-opt${heatFilter === val ? " is-active" : ""}" data-heatval="${escapeHtml(val)}" role="option">${escapeHtml(label)}</button>`;
  const menu =
    opt("all", "All exercises") +
    (cats.length ? `<div class="xdd-group">Categories</div>${cats.map((c) => opt(`cat:${c}`, c)).join("")}` : "") +
    (exs.length
      ? `<div class="xdd-group">Exercises</div>${exs.map((e) => opt(`ex:${e.exerciseName}`, e.exerciseName)).join("")}`
      : "");
  return (
    `<div class="xdd xdd-heat">` +
    `<button type="button" class="xdd-btn">${escapeHtml(heatFilterLabel())}<span class="xdd-caret">▾</span></button>` +
    `<div class="xdd-menu" hidden role="listbox">${menu}</div>` +
    `</div>`
  );
}

/** Workouts overview: a GitHub-style heatmap. Single-year (‹ › to change) or all
 * years stacked; filterable to one category or exercise. Tap a day to jump. */
function renderWorkoutCalendar() {
  const years = dataYears(trainingDays()); // year list from ALL training (filter-independent)
  if (!years.includes(heatYear)) heatYear = years[0]!;
  const counts = filteredDayCounts(); // colouring honours the filter
  const tagBtn =
    `<button type="button" class="cal-tagmode${aloneTagMode ? " is-on" : ""}" data-tagmode="alone" ` +
    `title="${aloneTagMode ? "Done — stop tagging" : "Tag many days as trained-alone: tap this, then tap each day"}">` +
    `${aloneTagMode ? "Done tagging" : "Tag alone"}</button>`;
  const controls = `<div class="heat-controls">${heatScopeToggle()}${heatFilterSelect()}${tagBtn}</div>`;
  const tagHint = aloneTagMode
    ? `<div class="cal-taghint">Tap trained days to add/remove the red “alone” ring. Tap “Done tagging” when finished.</div>`
    : "";
  const legend =
    `<div class="hm-legend muted">Less <span class="hm-cell lvl-0"></span><span class="hm-cell lvl-1"></span>` +
    `<span class="hm-cell lvl-2"></span><span class="hm-cell lvl-3"></span><span class="hm-cell lvl-4"></span>` +
    `<span class="hm-cell lvl-5"></span> More</div>`;
  const count = (g: { days: number; totalSets: number }) =>
    `<span class="cal-count muted">${g.days} day${g.days === 1 ? "" : "s"} · ${g.totalSets.toLocaleString()} sets</span>`;

  if (heatScope === "all") {
    const blocks = years
      .map((y) => {
        const g = yearGridHtml(y, counts);
        return `<div class="hm-block"><div class="cal-head"><strong>${y}</strong>${count(g)}</div>${g.html}</div>`;
      })
      .join("");
    els.workoutCalendar.innerHTML = controls + tagHint + blocks + legend;
    els.workoutCalendar.classList.toggle("cal-tagging", aloneTagMode);
    return;
  }

  const g = yearGridHtml(heatYear, counts);
  const idx = years.indexOf(heatYear);
  const olderExists = idx < years.length - 1; // a smaller (older) year exists
  const newerExists = idx > 0; // a larger (newer) year exists
  els.workoutCalendar.innerHTML =
    controls +
    tagHint +
    `<div class="cal-head">` +
    `<button type="button" class="cal-nav" data-heat="prev" aria-label="Previous year"${olderExists ? "" : " disabled"}>‹</button>` +
    `<strong>${heatYear}</strong>` +
    `<button type="button" class="cal-nav" data-heat="next" aria-label="Next year"${newerExists ? "" : " disabled"}>›</button>` +
    count(g) +
    `</div>` +
    g.html +
    legend;
  els.workoutCalendar.classList.toggle("cal-tagging", aloneTagMode);
}

/** Step the heatmap to an adjacent year that has data (‹ older / › newer). */
function shiftHeatYear(delta: number) {
  const years = dataYears(trainingDays()); // descending
  const idx = years.indexOf(heatYear);
  const next = years[idx - delta]; // -1 = older (later in list), +1 = newer
  if (next !== undefined) {
    heatYear = next;
    renderWorkoutCalendar();
  }
}

/** Tapping a training day in the calendar: jump to that day in the list and open it. */
function jumpToWorkoutDate(iso: string) {
  if (els.workoutView.value !== "day") els.workoutView.value = "day"; // calendar is per-day
  const idx = buildWorkoutGroups().findIndex((g) => g.date === iso && !g.rest);
  if (idx < 0) return;
  workoutsPage = Math.floor(idx / workoutsPageSize);
  renderWorkoutsPage();
  const row = els.workoutsTable.querySelector<HTMLTableRowElement>(`tr.wo-row[data-index="${idx}"]`);
  const grp = workoutGroups[idx];
  if (!row || !grp) return;
  insertDetail(row, 2, workoutGroupHtml(grp)); // expand it like a tap would
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add("wo-flash");
  window.setTimeout(() => row.classList.remove("wo-flash"), 1600);
}

/**
 * Workouts view "Sets over time": every logged set across ALL the athlete's
 * exercises as a weight → own-1RM bar on the calendar time axis, coloured per
 * exercise. The athlete's top exercises get distinct colours; the long tail is
 * lumped into a grey "Other" so the legend stays readable. Same per-set range
 * idea as the compare graph, but mixing every exercise. Collapsed by default.
 */
function renderWorkoutSetsChart() {
  const box = document.getElementById("workoutSetsChart");
  if (!box) return;

  const username = els.athlete.value;
  const formula = currentFormula();
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked, requireWeightAndReps: true });
  const mine = recs.filter((r) => r.username === username);
  if (mine.length === 0) {
    els.workoutSetsNote.textContent = "No sets with a usable 1RM yet.";
    if (workoutSetsSvg) workoutSetsSvg.update({ series: [] });
    return;
  }

  // Colour the athlete's most-trained exercises; everything else is "Other".
  const ranked = exerciseCountsForUser(activeRecords(), username).map((c) => c.exerciseName);
  const named = new Map<string, string>();
  ranked.slice(0, COMPARE_COLORS.length - 1).forEach((name, i) => named.set(name, COMPARE_COLORS[i]!));
  const OTHER = "#9aa3b2";
  const ts = (d: string) => Date.parse(d);

  type Bar = { x: number; lo: number; hi: number; meta: string };
  const groups = new Map<string, { color: string; points: Bar[] }>();
  for (const s of mine) {
    const e1rm = addedWeight1RM(s, formula);
    if (e1rm === null) continue;
    const label = named.has(s.exerciseName) ? s.exerciseName : "Other";
    const color = named.get(s.exerciseName) ?? OTHER;
    const g = groups.get(label) ?? groups.set(label, { color, points: [] }).get(label)!;
    const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
    g.points.push({ x: ts(s.date), lo: added, hi: e1rm, meta: `${exerciseCode(s.exerciseName)} ×${s.reps ?? 0}` });
  }
  const order = [...ranked.filter((n) => groups.has(n)), ...(groups.has("Other") ? ["Other"] : [])];
  const series: SvgSeries[] = order.map((label) => ({ name: label, color: groups.get(label)!.color, type: "range", points: groups.get(label)!.points }));

  const config = { series, xKind: "time" as const, yBeginAtZero: true, yUnit: "kg", insideLabels: true, height: 300 };
  if (!workoutSetsSvg) workoutSetsSvg = mountSvgChart(box, config);
  else workoutSetsSvg.update(config);
  els.workoutSetsNote.textContent =
    `Every set's weight → its own estimated 1RM (${formula}), coloured per exercise. Drag to pan · wheel to zoom · tap a bar.`;
}

function renderWorkoutsPage() {
  workoutGroups = buildWorkoutGroups();
  const byWeek = els.workoutView.value === "week";
  els.restToggleLabel.hidden = byWeek; // rest days only make sense per day
  const active = byWeek ? workoutGroups.length : workoutGroups.filter((g) => !g.rest).length;
  els.workoutsTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — workouts ` +
    `<span class="muted">(${active} ${byWeek ? "weeks" : "sessions"} · tap to expand)</span>`;

  const head = `<thead><tr><th>${byWeek ? "Week" : "Session"}</th><th class="num">Sets</th></tr></thead>`;
  const start = workoutsPage * workoutsPageSize;
  const rows = workoutGroups
    .slice(start, start + workoutsPageSize)
    .map((g, i) => {
      if (g.rest) {
        // A rest day is just a thin sliver with a separating line — count the
        // lines between sessions to see how many days passed, no text needed.
        return `<tr class="rest-row" title="${escapeHtml(g.label)} — rest"><td colspan="2"></td></tr>`;
      }
      const abs = start + i;
      let did: string;
      if (els.workoutGrouping.value === "muscles") {
        // Sum each exercise's sets into its muscle group (Quads, Hams, …).
        const byMuscle = new Map<string, number>();
        for (const e of g.exercises) {
          const m = muscleGroup(e.exerciseName);
          byMuscle.set(m, (byMuscle.get(m) ?? 0) + e.count);
        }
        did = [...byMuscle.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([m, c]) => `${escapeHtml(m)} <span class="muted">— ${c} set${c === 1 ? "" : "s"}</span>`)
          .join("<br>");
      } else {
        did = g.exercises
          .map((e) => `${escapeHtml(e.exerciseName)} <span class="muted">${e.count}</span>`)
          .join("<br>");
      }
      const tagged = aloneTags.has(aloneKey(g.date));
      const tagBtn =
        `<button type="button" class="wo-alone${tagged ? " is-on" : ""}" data-alone="${escapeHtml(g.date)}" ` +
        `title="${tagged ? "Trained alone — tap to untag" : "Tag as trained alone"}">alone</button>`;
      return (
        `<tr class="wo-row" data-index="${abs}"><td>` +
        `<div class="wo-date"><span class="caret">▸</span>${g.label}${tagBtn}</div>` +
        `<div class="wo-did">${did}</div></td>` +
        `<td class="num">${g.totalSets}</td></tr>`
      );
    })
    .join("");
  els.workoutsTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="2" class="muted">No workouts for this athlete.</td></tr>`}</tbody>`;
  els.workoutsPager.innerHTML = pagerHtml(workoutsPage, workoutGroups.length, workoutsPageSize);
}

function onWorkoutRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".xdd-rpe") && onSetRpeClick(target)) return; // the RIR picker handles itself
  // "alone" tag toggle — tag/untag this session as trained alone, then re-render
  // (so the chip + any active "Only alone" filter update). Doesn't expand the row.
  const tagBtn = target.closest<HTMLButtonElement>(".wo-alone");
  if (tagBtn?.dataset.alone) {
    const key = aloneKey(tagBtn.dataset.alone);
    if (aloneTags.has(key)) aloneTags.delete(key);
    else aloneTags.add(key);
    saveAlone();
    renderWorkoutsPage();
    renderWorkoutCalendar(); // refresh the year map so the red "alone" ring updates live
    return;
  }
  if (toggleE1rmFormula(target)) return; // a 1RM cell → show its formula
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level

  // An exercise name in an expanded day -> jump to that exercise's drill-in on
  // the Exercises sub-tab (the SAME detail view the Exercises list opens, so
  // both routes land in one place).
  const exLink = target.closest(".wo-exlink") as HTMLElement | null;
  if (exLink) {
    const exName = exLink.dataset.exname;
    if (exName) {
      showSubtab("exercises");
      selectedExercise = exName;
      combinedWith = [];
      renderExercisesPage();
    }
    return;
  }

  // A day/week -> expand straight to every exercise with all its sets.
  const row = target.closest("tr.wo-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const grp = workoutGroups[Number(row.dataset.index)];
  if (!grp) return;
  insertDetail(row, 2, workoutGroupHtml(grp));
}

/** Inner table for one expanded day/week: every exercise as a sub-header row
 * followed immediately by all its sets (W / 1RM / Vol) — fully expanded, no
 * second tap needed. A set with a note still toggles its own note row. */
function workoutGroupHtml(group: WorkoutGroup): string {
  const formula = currentFormula();
  const body = group.exercises
    .map((e) => {
      const header =
        `<tr class="set-ex-row"><td colspan="4" class="wo-exname">` +
        `<span class="wo-exlink" data-exname="${escapeHtml(e.exerciseName)}">${escapeHtml(e.exerciseName)}</span>${originBadge(e.exerciseName)} <span class="muted">${e.count}</span></td></tr>`;
      const sets = group.sets
        .filter((s) => s.exerciseName === e.exerciseName)
        .map((s) => setRowsHtml(s, formula))
        .join("");
      return header + sets;
    })
    .join("");
  return `<table class="data-table detail-table">${SETS_HEAD}<tbody>${body}</tbody></table>`;
}

// ---- Shared expand/collapse helpers ----
/** If the row already has its detail open, remove it and return true. */
function toggleCollapse(row: HTMLTableRowElement): boolean {
  const next = row.nextElementSibling;
  if (next && next.classList.contains("detail-row")) {
    next.remove();
    row.classList.remove("open");
    return true;
  }
  return false;
}

function insertDetail(row: HTMLTableRowElement, colspan: number, innerHtml: string) {
  const detail = document.createElement("tr");
  detail.className = "detail-row";
  detail.innerHTML = `<td colspan="${colspan}">${innerHtml}</td>`;
  row.insertAdjacentElement("afterend", detail);
  row.classList.add("open");
}

// Compact header for the sets tables: weight / est. 1RM / volume, all in kg.
// AI-NOTE: setRowsHtml/SETS_HEAD are shared by BOTH the Workouts day→exercise
// sets table and the Exercises weekly drill-in. The compact W/1RM/Vol headers
// and the collapsible-note layout therefore apply to both views; change here
// and you change both. The note toggle is handled by toggleSetNote(), wired
// into onWorkoutRowClick and onExerciseRowClick.
const SETS_HEAD =
  `<thead><tr><th class="num">W</th><th class="num">1RM</th><th class="num">Vol</th><th class="num" title="Reps In Reserve — how many more reps you could have done (low = near failure)">RIR</th></tr></thead>`;

/** How many characters of a note to show inline before truncating with "…". */
const NOTE_PREVIEW_LEN = 8;

/**
 * Plain-text explanation of how a set's estimated 1RM was produced, with the
 * actual numbers plugged in. Takes a COMPUTED record (bodyweight already folded
 * into `weight`, logged bar weight in `origWeight`) so the reveal shows the full
 * chain — bodyweight share, effective load, the formula, then peeling the body
 * share back off — and always matches the bodyweight-aware number displayed.
 */
function oneRmFormulaText(c: SetRecord, formula: OneRepMaxFormula): string {
  const effLoad = c.weight; // bodyweight-inclusive load
  const r = c.reps;
  if (effLoad === null || r === null || effLoad <= 0 || r <= 0) return "Needs a weight and reps to estimate a 1RM.";
  const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
  // Bar weight vs the body's share folded in by computeRecord.
  const added = c.origWeight === undefined ? effLoad : (c.origWeight ?? 0);
  const bodyLoad = effLoad - added;
  const hasBody = bodyLoad > 0.01;
  // Above the cap there is no reliable 1RM — say so, show "—", don't estimate.
  if (r > MAX_1RM_REPS) {
    return (
      (hasBody ? `Effective load = bar ${f2(added)} + bodyweight share ${f2(bodyLoad)} = ${f2(effLoad)} kg. ` : "") +
      `${r} reps is above the ${MAX_1RM_REPS}-rep limit where a 1RM estimate is reliable, so no 1RM is shown (—).`
    );
  }
  const eff1rm = estimate1RM(effLoad, r, formula);
  const added1rm = addedWeight1RM(c, formula);
  const addedTxt = added1rm === null ? "—" : `${f2(added1rm)} kg`;

  const parts: string[] = [];
  if (hasBody) {
    parts.push(
      `Effective load = bar ${f2(added)} + bodyweight share ${f2(bodyLoad)} = ${f2(effLoad)} kg.`,
    );
  }
  if (r === 1) {
    parts.push(`${formula}: a single is the 1RM → ${f2(effLoad)} kg.`);
  } else if (formula === "brzycki") {
    parts.push(
      r >= 37
        ? "Brzycki is undefined at 37+ reps."
        : `Brzycki: load × 36 / (37 − reps) = ${f2(effLoad)} × 36 / (37 − ${r}) = ${eff1rm === null ? "—" : `${f2(eff1rm)} kg`}.`,
    );
  } else if (formula === "nuzzo") {
    const pct = benchPctForReps(r);
    parts.push(
      `Nuzzo bench curve: ${r} reps ≈ ${f2(pct)}% of 1RM, so load ÷ that % = ${f2(effLoad)} ÷ ${f2(pct)}% = ${eff1rm === null ? "—" : `${f2(eff1rm)} kg`}.`,
    );
  } else {
    parts.push(
      `Epley: load × (1 + reps/30) = ${f2(effLoad)} × (1 + ${r}/30) = ${eff1rm === null ? "—" : `${f2(eff1rm)} kg`}.`,
    );
  }
  if (hasBody && eff1rm !== null) {
    parts.push(`Peel the bodyweight share back off: ${f2(eff1rm)} − ${f2(bodyLoad)} = ${addedTxt} added-weight 1RM.`);
  }
  return parts.join(" ");
}

/**
 * One set as table rows: the W/1RM/Vol line. The 1RM cell is a button — tapping
 * it expands a sub-row showing the exact formula and numbers used. When the set
 * has a note (or is a dropset) a short truncated preview sits on the left of the
 * weight cell with a caret; tapping the row expands the full note. Both reveals
 * are independent sub-rows, so a set can show either or both.
 */
function setRowsHtml(s: SetRecord, formula: OneRepMaxFormula): string {
  // 1RM must be bodyweight-aware (same as the leaderboard/PRs): fold the body
  // share in, then report the added-weight 1RM. W and Vol stay in bar weight —
  // what was actually loaded. `s` is a raw record; compute it here so the
  // Workouts and Exercises sets tables match every other view.
  const computed = computeRecord(s);
  const e1rm = addedWeight1RM(computed, formula);
  const vol = setVolume(s.weight, s.reps);
  const note = [s.dropset ? "dropset" : "", s.notes].filter(Boolean).join(" · ");
  let preview = "";
  if (note) {
    const short = note.length > NOTE_PREVIEW_LEN ? `${note.slice(0, NOTE_PREVIEW_LEN)}…` : note;
    preview =
      `<button type="button" class="set-note" title="${escapeHtml(note)}">` +
      `${escapeHtml(short)}<span class="set-note-cue">›</span></button>`;
  }
  const e1rmCell =
    e1rm === null
      ? "—"
      : `<button type="button" class="e1rm-btn" title="Show the 1RM formula">${fmt(e1rm)}</button>`;
  const rpeCell = rpeDropdownHtml(setId(s), rpeFor(s));
  const main =
    `<tr${note ? ' class="set-row has-note"' : ""}>` +
    `<td class="num wcell">${preview}${wr(s.weight, s.reps)}</td>` +
    `<td class="num">${e1rmCell}</td>` +
    `<td class="num">${vol === null ? "—" : fmt(vol)}</td>` +
    `<td class="num rpe-cell">${rpeCell}</td></tr>`;
  const noteRow = note
    ? `<tr class="set-note-row" hidden><td colspan="4" class="muted">${escapeHtml(note)}</td></tr>`
    : "";
  const formulaRow =
    e1rm === null
      ? ""
      : `<tr class="e1rm-formula-row" hidden><td colspan="4" class="muted">${escapeHtml(oneRmFormulaText(computed, formula))}</td></tr>`;
  return main + noteRow + formulaRow;
}

/** The per-set RIR picker as a custom HTML/CSS dropdown (no native <select>, so it
 * looks the same on every device). Closed button shows "range word" (or "–" when
 * unset); the open menu lists every band with its full description, plus a Clear
 * row. Reuses the app's .xdd dropdown styling; matched to the cell width. Clicks
 * are handled by delegation in the sets-table handler (onSetRpeClick). */
function rpeDropdownHtml(sid: string, grade: string | undefined): string {
  const band = rirBand(grade);
  const label = band ? `${band.id} ${band.word}` : "–";
  const optHtml = (val: string, text: string, title: string, active: boolean) =>
    `<button type="button" class="xdd-opt set-rpe-opt${active ? " is-active" : ""}" data-rir="${escapeHtml(val)}" title="${escapeHtml(title)}" role="option">${escapeHtml(text)}</button>`;
  const menu =
    optHtml("", "– none", "Clear the grade", !band) +
    RIR_BANDS.map((b) => optHtml(b.id, `${b.id} — ${b.desc}`, b.desc, grade === b.id)).join("");
  return (
    `<div class="xdd xdd-rpe${band ? " is-set" : ""}" data-setid="${escapeHtml(sid)}">` +
    `<button type="button" class="xdd-btn set-rpe-btn" aria-label="Reps in reserve (RIR)">${escapeHtml(label)}<span class="xdd-caret">▾</span></button>` +
    `<div class="xdd-menu" hidden role="listbox">${menu}</div>` +
    `</div>`
  );
}

/** Click inside a set's RIR dropdown: toggle the menu open, or apply a picked
 * band (save it, re-render the cell, refresh the drill-in graph). Returns true if
 * it handled the click. Shared by both sets tables. */
function onSetRpeClick(target: HTMLElement): boolean {
  const dd = target.closest<HTMLElement>(".xdd-rpe");
  if (!dd?.dataset.setid) return false;
  const menu = dd.querySelector<HTMLElement>(".xdd-menu")!;
  // Tapping the closed button toggles this menu (and closes any other open one).
  if (target.closest(".set-rpe-btn")) {
    const opening = menu.hasAttribute("hidden");
    closeAllRpeMenus();
    menu.toggleAttribute("hidden", !opening);
    dd.classList.toggle("open", opening);
    return true;
  }
  // Tapping a band applies it.
  const opt = target.closest<HTMLElement>(".set-rpe-opt");
  if (opt?.dataset.rir !== undefined) {
    const v = opt.dataset.rir === "" ? null : opt.dataset.rir;
    setRpe(dd.dataset.setid, v);
    // Swap in a freshly-rendered dropdown so the button label + is-set update.
    dd.outerHTML = rpeDropdownHtml(dd.dataset.setid, v ?? undefined);
    // Refresh the drill-in graph so the new grade shows in the per-set tooltip.
    if (selectedExercise !== null) renderExerciseProgressChart(selectedExercise);
    return true;
  }
  return true; // a click inside the open menu (e.g. on a gap) — swallow it
}

/** Close every open RIR dropdown menu (used before opening one, and on outside click). */
function closeAllRpeMenus(): void {
  for (const dd of document.querySelectorAll<HTMLElement>(".xdd-rpe.open")) {
    dd.classList.remove("open");
    dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
  }
}

/** Click on a set row that has a note: expand/collapse the hidden note row that
 * follows it. Returns true if the click was on such a row (so the caller stops).
 * Shared by the Workouts and Exercises sets tables. */
function toggleSetNote(target: HTMLElement): boolean {
  const row = target.closest<HTMLElement>("tr.set-row.has-note");
  if (!row) return false;
  const noteRow = row.nextElementSibling;
  if (noteRow?.classList.contains("set-note-row")) {
    const hidden = noteRow.toggleAttribute("hidden");
    row.classList.toggle("is-open", !hidden);
  }
  return true;
}

/** Click on a 1RM cell button: expand/collapse the formula sub-row for that set.
 * The formula row follows the set row (after the optional note row), so scan
 * forward to it. Returns true if the click was on a 1RM button. Shared by the
 * Workouts and Exercises sets tables. */
function toggleE1rmFormula(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>(".e1rm-btn");
  if (!btn) return false;
  let sib = btn.closest("tr")?.nextElementSibling ?? null;
  while (sib && !sib.classList.contains("e1rm-formula-row")) {
    // Stop if we hit the next set's row rather than this set's formula row.
    if (sib.classList.contains("set-row") || sib.querySelector(".e1rm-btn")) break;
    sib = sib.nextElementSibling;
  }
  if (sib?.classList.contains("e1rm-formula-row")) {
    sib.toggleAttribute("hidden");
    btn.classList.toggle("is-open");
  }
  return true;
}

/**
 * Sets spanning several days (one week of one exercise), grouped by day. Each
 * day is a header row above that day's sets, so the date sits "up top" instead
 * of repeating in its own column — matching the Workouts view.
 */
function setsByDateTableHtml(sets: readonly SetRecord[]): string {
  const formula = currentFormula();
  const byDate = new Map<string, SetRecord[]>();
  for (const s of sets) {
    const g = byDate.get(s.date);
    if (g) g.push(s);
    else byDate.set(s.date, [s]);
  }
  const body = Array.from(byDate, ([date, daySets]) => {
    const header = `<tr class="set-date-row"><td colspan="4" class="wo-date">${shortDate(date)}</td></tr>`;
    return header + daySets.map((s) => setRowsHtml(s, formula)).join("");
  }).join("");
  return `<table class="data-table detail-table">${SETS_HEAD}<tbody>${body}</tbody></table>`;
}

/** Best / latest / trend summary line for an exercise's day-by-day 1RM series.
 * Shown under the per-exercise drill-in chart. */




// ---- Exercises tab: which spellings were merged into one lift ----
// Documents every combine (per the owner's rule that merges must be visible),
// newest list straight from the canonicaliser. Empty state when nothing merged.
function renderMergeList() {
  const merges = data.merges;
  if (!merges.length) {
    els.mergeList.innerHTML = `<p class="muted">No exercises needed combining — every lift is logged under one name.</p>`;
    return;
  }
  const head = `<thead><tr><th>Shown as</th><th>Combined from</th><th class="num">Sets</th></tr></thead>`;
  const body = merges
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.canonical)}</td>` +
        `<td>${m.variants.map((v) => escapeHtml(v)).join(", ")}</td>` +
        `<td class="num">${m.sets.toLocaleString()}</td></tr>`,
    )
    .join("");
  els.mergeList.innerHTML = `<table class="data-table">${head}<tbody>${body}</tbody></table>`;
}

/**
 * The app-wide active-set control on the Index page: a frequency-tier cutoff that
 * hides every lift below it everywhere in the app (default None = show all). The
 * per-exercise include/exclude overrides get inline toggles in a later slice; for
 * now the cutoff is the lever, and any manual overrides are summarised + clearable.
 */
function renderActiveSetBar(totalExercises: number): void {
  const active = activeSet ? activeSet.size : totalExercises;
  const opt = (val: string, label: string) =>
    `<option value="${val}"${(activeCutoff ?? "none") === val ? " selected" : ""}>${label}</option>`;
  const tierOpts = FREQ_TIERS.map((t) => opt(t.tier, t.label)).join("");
  const overrides = activeInclude.size + activeExclude.size;
  const status = activeSet
    ? `<span class="as-status is-on">Showing ${active} of ${totalExercises} exercises app-wide</span>`
    : `<span class="as-status muted">Showing all ${totalExercises} exercises (filter off)</span>`;
  const clear = overrides
    ? ` · <button type="button" class="as-clear" data-asclear="1">clear ${overrides} manual override${overrides === 1 ? "" : "s"}</button>`
    : "";
  els.activeSetBar.innerHTML =
    `<label class="as-label">Show app-wide ` +
    `<select id="activeCutoff" class="subtle-select">${opt("none", "All exercises")}${tierOpts}</select>` +
    `</label> ${status}${clear}` +
    `<p class="as-hint muted">Restrict the whole app (every list, graph, leaderboard) to your most-trained lifts. ` +
    `Pick a tier to hide rarer exercises; e.g. “S” keeps only the staples.</p>`;
}

/** Cutoff dropdown changed: save + re-render the whole app. */
function onActiveCutoffChange(value: string): void {
  activeCutoff = value === "none" ? null : value;
  saveActiveSet();
  renderAll();
}

/** Clear all manual include/exclude overrides (keeps the tier cutoff). */
function clearActiveOverrides(): void {
  activeInclude = new Set();
  activeExclude = new Set();
  saveActiveSet();
  renderAll();
}

// ---- BW parts tab: every exercise and its bodyweight coefficient ----
function renderBwParts() {
  renderMergeList();
  const counts = new Map<string, number>();
  for (const r of data.records) if (r.exerciseName) counts.set(r.exerciseName, (counts.get(r.exerciseName) ?? 0) + 1);

  const rows = [...counts.keys()]
    .map((name) => ({ name, coeff: coeffFor(name), count: counts.get(name)!, cat: exerciseCategory(name) }))
    // Most-trained first (by set count), then alphabetical - kept inside each category.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const withPart = rows.filter((r) => r.coeff > 0).length;
  els.bwTitle.innerHTML =
    `Exercises <span class="muted">(${rows.length} · ${withPart} with a bodyweight part · edit to update all stats)</span>`;
  renderActiveSetBar(rows.length);

  // Group the exercises by training category so similar lifts share a dropdown.
  const byCat = new Map<TrainingCategory, typeof rows>();
  for (const r of rows) {
    const list = byCat.get(r.cat) ?? [];
    list.push(r);
    byCat.set(r.cat, list);
  }

  // Remember which categories the user has opened, so editing/re-rendering keeps
  // them as they were. Categories start collapsed by default (empty set on first
  // paint); afterwards we read the live open/closed state back out of the DOM.
  if (bwOpenCats === null) bwOpenCats = new Set<string>();
  else {
    bwOpenCats = new Set<string>();
    for (const d of els.bwGroups.querySelectorAll<HTMLDetailsElement>("details.bw-cat"))
      if (d.open && d.dataset.cat) bwOpenCats.add(d.dataset.cat);
  }
  const open = (cat: string) => bwOpenCats!.has(cat);

  const head = `<thead><tr><th>Exercise</th><th class="num">BW part</th><th class="num">Sets</th></tr></thead>`;
  els.bwGroups.innerHTML = TRAINING_CATEGORIES.filter((c) => byCat.has(c))
    .map((cat) => {
      const list = byCat.get(cat)!;
      const catWithPart = list.filter((r) => r.coeff > 0).length;
      const body = list
        .map(
          (r) =>
            `<tr data-exrow="${escapeHtml(r.name)}"><td>` +
            `<span class="bw-ex-name" data-exname="${escapeHtml(r.name)}"><span class="caret">▸</span>${escapeHtml(r.name)}</span>${originBadge(r.name)}</td>` +
            `<td class="num"><input class="bw-input" type="number" step="0.05" min="0" max="2" ` +
            `value="${r.coeff}" data-ex="${escapeHtml(r.name)}" aria-label="Bodyweight part for ${escapeHtml(r.name)}" /></td>` +
            `<td class="num">${r.count.toLocaleString()}</td></tr>`,
        )
        .join("");
      const partNote = catWithPart > 0 ? ` · ${catWithPart} with a BW part` : "";
      return (
        `<details class="bw-cat" data-cat="${escapeHtml(cat)}"${open(cat) ? " open" : ""}>` +
        `<summary class="bw-cat-summary">` +
        `<span class="bw-cat-dot" style="background:${CATEGORY_COLORS[cat]}"></span>` +
        `<span class="bw-cat-name">${escapeHtml(cat)}</span>` +
        `<span class="bw-cat-meta muted">${list.length} exercise${list.length === 1 ? "" : "s"}${partNote}</span>` +
        `</summary>` +
        `<table class="data-table">${head}<tbody>${body}</tbody></table>` +
        `</details>`
      );
    })
    .join("");
}

/** Expanded info panel for one exercise on the Index page: category / muscle /
 * tier, bodyweight part, merged spellings, total sets, who trains it, the best
 * estimated 1RM ever logged (any athlete) and the date span. */
function exerciseInfoHtml(name: string): string {
  const formula = currentFormula();
  const recs = computedRecords().filter((r) => r.exerciseName === name);
  const cat = exerciseCategory(name);
  const mg = muscleGroup(name);
  const tierLabel = { main: "Main lift", second: "Secondary", third: "Cardio/mobility" }[exerciseTier(name)];
  const coeff = coeffFor(name);
  const variants = exerciseOrigin(name).filter((v) => v !== name);

  const athletes = new Map<string, string>();
  let first = "", last = "", setCount = 0;
  let best: { e1rm: number; who: string; date: string; w: number | null; reps: number } | null = null;
  for (const r of recs) {
    setCount++;
    if (r.username) athletes.set(r.username, r.user || r.username);
    if (r.date) { if (!first || r.date < first) first = r.date; if (!last || r.date > last) last = r.date; }
    const e = addedWeight1RM(r, formula);
    if (e !== null && (!best || e > best.e1rm))
      best = { e1rm: e, who: r.user || r.username, date: r.date, w: r.weight, reps: r.reps ?? 0 };
  }
  const item = (label: string, value: string) =>
    `<div class="ex-info-item"><span class="ex-info-lbl">${escapeHtml(label)}</span><span class="ex-info-val">${value}</span></div>`;

  const rows = [
    item("Category", escapeHtml(cat)),
    item("Muscle group", escapeHtml(mg)),
    item("Tier", escapeHtml(tierLabel)),
    item("Bodyweight part", coeff > 0 ? pct(coeff) : "—"),
    item("Total sets", setCount.toLocaleString()),
    item("Athletes", `${athletes.size} — ${escapeHtml([...athletes.values()].join(", ")) || "—"}`),
    best
      ? item("Best 1RM (anyone)", `${fmt(best.e1rm)} kg <span class="muted">(${escapeHtml(best.who)} · ${best.w === null ? "—" : fmt(best.w)}×${best.reps} · ${shortDate(best.date)})</span>`)
      : item("Best 1RM (anyone)", "—"),
    first && last ? item("Logged", `${shortDate(first)} → ${shortDate(last)}`) : "",
    variants.length ? item("Also logged as", escapeHtml(variants.join(", "))) : "",
  ].join("");
  return `<div class="ex-info">${rows}</div>`;
}

/** Open the Exercises (merges & data) page and scroll to one exercise's row,
 * opening its category dropdown and flashing the row. Called from the per-athlete
 * drill-in's "Exercise info" button — the same exercise, but with no person. */
function jumpToExerciseInfo(exName: string) {
  switchTopTab("bwparts");
  const row = els.bwGroups.querySelector<HTMLTableRowElement>(`tr[data-exrow="${CSS.escape(exName)}"]`);
  if (!row) return;
  const details = row.closest<HTMLDetailsElement>("details.bw-cat");
  if (details && !details.open) details.open = true;
  // Let the just-opened <details> lay out before scrolling to the row.
  requestAnimationFrame(() => {
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("wo-flash");
    window.setTimeout(() => row.classList.remove("wo-flash"), 1600);
  });
}

/** Apply an edited bodyweight coefficient and refresh every dependent view. */
function onBwInputChange(e: Event) {
  const input = e.target as HTMLElement;
  if (!input.classList.contains("bw-input")) return;
  const el = input as HTMLInputElement;
  const name = el.dataset.ex;
  if (name === undefined) return;
  let v = parseFloat(el.value);
  if (!Number.isFinite(v)) v = 0;
  v = Math.min(2, Math.max(0, v));
  el.value = String(v);
  setCoeff(name, v);
  // Recompute everything that uses the coefficient (but not the BW table itself,
  // so the row you're editing keeps its place and focus).
  renderLeaderboard();
  renderPersonalRecords();
  renderAthlete();
}

/** Fill the Test-tab exercise <select> with the chosen athlete's exercises. */
function populateTestExercises(username: string) {
  if (username === "") {
    els.testExercise.innerHTML = `<option value="">— pick an athlete first —</option>`;
    return;
  }
  const exercises = exerciseCountsForUser(activeRecords(), username);
  els.testExercise.innerHTML = exercises
    .map((e) => `<option value="${escapeHtml(e.exerciseName)}">${escapeHtml(e.exerciseName)}</option>`)
    .join("");
  // Default to Squat when this athlete has it, else their most-trained lift.
  const squat = exercises.find((e) => e.exerciseName.toLowerCase() === "squat");
  els.testExercise.value = squat?.exerciseName ?? exercises[0]?.exerciseName ?? "";
}

/** Load the picked athlete+exercise's top set (best 1RM) into the calculator inputs. */
function prefillTestFromPick() {
  const username = els.testAthlete.value;
  const exName = els.testExercise.value;
  if (username === "" || exName === "") {
    els.testPickHint.textContent = "";
    return;
  }
  const formula = currentFormula();
  // Pick the top set the SAME way the athlete page does: best bodyweight-aware
  // added-weight 1RM (honours the rep cap), not a raw estimate — so the Test tab
  // seeds the exact set the PR/leaderboard would. Display the logged bar weight.
  const sets = setsForUserExercise(data.records, username, exName);
  let best: SetRecord | null = null;
  let bestE1rm = -Infinity;
  for (const s of sets) {
    const e = addedWeight1RM(computeRecord(s), formula);
    if (e !== null && e > bestE1rm) {
      bestE1rm = e;
      best = s; // keep the raw set so we show the logged weight/reps
    }
  }
  if (!best || best.weight === null || best.reps === null) {
    els.testPickHint.textContent = "No logged sets with a usable 1RM for this exercise.";
    return;
  }
  els.calcWeight.value = String(best.weight);
  els.calcReps.value = String(best.reps);
  els.calcBw.value = String(best.bodyweight ?? ATHLETES[username]?.weight ?? els.calcBw.value);
  els.calcCoeff.value = String(coeffFor(exName));
  const label = els.testAthlete.selectedOptions[0]?.textContent ?? username;
  els.testPickHint.textContent =
    `Loaded ${label}'s top ${exName}: ${best.weight}kg × ${best.reps} on ${shortDate(best.date)} ` +
    `(${fmt(bestE1rm)}kg est. 1RM). Tweak any number below.`;
  renderTest();
}

// The 1RM formula shown in the Test-tab calculator (its own tab, independent of
// the dashboard-wide setting so people can compare them side by side).
let calcTab: OneRepMaxFormula = DEFAULT_FORMULA;

// ---- Test tab: live calculator showing the selected formula with the numbers ----
function renderTest() {
  const num = (el: HTMLInputElement, fallback: number) => {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : fallback;
  };
  const weight = num(els.calcWeight, 0);
  const reps = Math.max(1, Math.round(num(els.calcReps, 1)));
  const bw = num(els.calcBw, 0);
  const coeff = num(els.calcCoeff, 0);

  // Named parts of the lift (the same names the code uses everywhere):
  const addedWeight = weight; // what's on the bar (the logged weight)
  const effLoad = effectiveLoad(weight, bw, coeff) ?? 0; // added + bodyweight share
  const bodyweightLoad = effLoad - addedWeight; // coeff × bodyweight, the body's share
  const isBodyweightLift = bodyweightLoad > 0.01;
  const vol = setVolume(weight, reps);
  const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

  // One tight line per step: "Label — formula = result".
  const line = (title: string, expr: string) =>
    `<div class="calc-row"><span class="calc-label">${title}</span><span class="calc-expr">${expr}</span></div>`;
  const res = (s: string) => `<span class="calc-result">${s}</span>`;
  const eq = (formula: string, result: string | null) => (result === null ? formula : `${formula} = ${res(result)}`);

  // 1RM of the effective load for the selected formula, then peel the bodyweight
  // share back off so the answer is added (bar) weight — comparable to logged
  // weights, and the exact number the leaderboards/PRs now use.
  let effective1RM: number | null;
  let formulaText: string;
  if (calcTab === "brzycki") {
    effective1RM = brzycki1RM(effLoad, reps);
    formulaText = reps >= 37 ? "undefined at 37+ reps" : `${f2(effLoad)} × 36 / (37 − ${reps})`;
  } else if (calcTab === "nuzzo") {
    effective1RM = nuzzo1RM(effLoad, reps);
    formulaText = reps === 1 ? "a single is the 1RM" : `${f2(effLoad)} ÷ ${f2(benchPctForReps(reps))}%`;
  } else {
    effective1RM = epley1RM(effLoad, reps);
    formulaText = `${f2(effLoad)} × (1 + ${reps}/30)`;
  }
  const addedWeight1RM = effective1RM === null ? null : effective1RM - bodyweightLoad;
  const perBw = addedWeight1RM !== null && bw > 0 ? addedWeight1RM / bw : null;
  const kg = (n: number | null) => (n === null ? null : `${f2(n)} kg`);

  const rows: string[] = [];
  if (isBodyweightLift) {
    rows.push(line("BW load", eq(`${coeff} × ${f2(bw)}`, `${f2(bodyweightLoad)} kg`)));
    rows.push(line("Effective", eq(`${f2(addedWeight)} + ${f2(bodyweightLoad)}`, `${f2(effLoad)} kg`)));
  }
  // Nuzzo divides the load by the %1RM that this many reps represents, so derive
  // that % FIRST — the 1RM line below reads "load ÷ that %", in logical order.
  if (calcTab === "nuzzo") {
    rows.push(line("Bench %1RM", `${reps} reps ≈ ${res(`${f2(benchPctForReps(reps))}%`)}`));
  }
  if (isBodyweightLift) {
    rows.push(line("Effective 1RM", eq(formulaText, kg(effective1RM))));
    rows.push(line("Added 1RM", eq(`${effective1RM === null ? "—" : f2(effective1RM)} − ${f2(bodyweightLoad)}`, kg(addedWeight1RM))));
  } else {
    rows.push(line("Est. 1RM", eq(formulaText, kg(addedWeight1RM))));
  }
  rows.push(line("Volume", eq(`${f2(weight)} × ${reps}`, vol === null ? null : f2(vol))));
  rows.push(
    line(
      "Per BW",
      addedWeight1RM === null || bw <= 0
        ? "needs 1RM & BW"
        : eq(`${f2(addedWeight1RM)} ÷ ${f2(bw)}`, perBw === null ? null : bwMult(perBw)),
    ),
  );
  els.calcOut.innerHTML = rows.join("");
  renderCalcCurve(effLoad, bodyweightLoad, reps, addedWeight, calcTab);
}

/**
 * Calculator graph — the Nuzzo research chart, plotted on YOUR scale: the study's
 * bench point estimates as dots and the best-fit curve, but the x-axis is the BAR
 * WEIGHT (added kg) the curve predicts at each %1RM for your set's estimated 1RM,
 * not the bare %1RM. So it reads "at this weight on the bar you can do N reps".
 * Each %1RM p maps to bar weight = (p/100 × eff1RM) − bodyweight share; reps stay
 * on y. Your typed set is the gold dot at (added weight, reps). Same study data +
 * best-fit curve as the explainer page (public/reps-1rm.html), just on a kg axis.
 */
function renderCalcCurve(
  effLoad: number,
  bodyweightLoad: number,
  curReps: number,
  curAdded: number,
  _formula: OneRepMaxFormula,
) {
  const box = document.getElementById("calcCurveChart");
  if (!box) return;

  // The set's Nuzzo 1RM sets the weight scale (this is the Nuzzo bench chart).
  // Without a usable 1RM (e.g. no reps yet) we can't place a weight axis.
  const eff1rm = nuzzo1RM(effLoad, Math.max(1, curReps));
  if (eff1rm === null || eff1rm <= 0) {
    els.calcCurveNote.textContent = "Enter a weight and reps to see the weight↔reps curve.";
    if (calcCurveSvg) calcCurveSvg.update({ series: [] });
    return;
  }
  // %1RM → bar weight (added kg) for THIS set: peel the bodyweight share back off.
  const barAt = (pct: number) => (pct / 100) * eff1rm - bodyweightLoad;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  // All 17 study points, each at its predicted bar weight.
  const studyPts: SvgPoint[] = BENCH_REPS_STUDY.map(([pct, reps]) => ({
    x: r1(barAt(pct)),
    y: r1(reps),
    meta: `${reps.toFixed(1)} reps @ ${Math.round(pct)}%`,
  }));
  // Best-fit curve sampled densely across the data span (95% → 15% of 1RM).
  const fitPts: SvgPoint[] = [];
  for (let pct = 95; pct >= 15; pct -= 0.5) {
    fitPts.push({ x: r1(barAt(pct)), y: r1(benchRepsAtPct(pct)) });
  }
  const series: SvgSeries[] = [
    { name: "Best-fit curve", color: "#284e86", type: "line", points: fitPts, noLegend: true },
    { name: "Study estimates (Nuzzo et al.)", color: "#1a1a1a", type: "scatter", points: studyPts },
  ];
  // Overlay the set you typed at its actual added weight.
  if (curReps >= 1) {
    series.push({
      name: "Your set",
      color: "#b8902f",
      type: "scatter",
      points: [{ x: r1(curAdded), y: curReps, meta: `${fmt(curAdded)} kg × ${curReps}` }],
    });
  }
  const config: SvgChartConfig = {
    series,
    xKind: "linear",
    yBeginAtZero: true,
    height: 300,
    yUnit: "reps",
    formatX: (x) => `${Math.round(x)}`,
    formatTipX: (x) => `${Math.round(x)} kg`,
  };
  if (!calcCurveSvg) calcCurveSvg = mountSvgChart(box, config);
  else calcCurveSvg.update(config);
  els.calcCurveNote.textContent =
    "Reps you can do at each bar weight (kg) for this set's Nuzzo 1RM — dots are the study data, the line is the best-fit curve (gold dot = the set you typed). Drag to pan · wheel to zoom.";
}

function renderAll() {
  refreshActiveSet(); // keep the app-wide active exercise set current before any render
  renderLeaderboard();
  renderPersonalRecords();
  renderAthlete();
  renderBwParts();
  renderTest();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Non-overlapping rep bands for the leaderboard histogram. Each band's 1RM is
 * estimated only from sets whose reps fall in that band, so a 5-rep set counts
 * once (in 4–6), never twice.
 */
const REP_BANDS: { id: string; label: string; min: number; max?: number }[] = [
  { id: "1-3", label: "1–3", min: 1, max: 3 },
  { id: "4-6", label: "4–6", min: 4, max: 6 },
  { id: "7-10", label: "7–10", min: 7, max: 10 },
  { id: "11-15", label: "11–15", min: 11, max: 15 },
  { id: "16-20", label: "16–20", min: 16, max: 20 },
  { id: "21+", label: "21+", min: 21 },
];

function setSettingsOpen(open: boolean) {
  els.settingsPanel.hidden = !open;
  els.settingsBtn.setAttribute("aria-expanded", String(open));
}

async function init() {
  try {
    data = await loadData();
  } catch (err) {
    els.status.innerHTML = `<span class="badge warn">Failed to load data</span> ${escapeHtml(String(err))}`;
    return;
  }
  // Fold in any hand-logged sets saved on this device (the Add tab).
  csvRecordCount = data.records.length;
  mergeManualSets();
  loadAlone(); // "trained alone" workout tags saved on this device

  // Build the leaderboard exercise picker (see populateExercisePicker): every
  // distinct logged lift, each on its own.
  populateExercisePicker();
  els.rank.innerHTML =
    `<option value="abs">Total (kg)</option><option value="rel">Per bodyweight</option>`;
  els.rank.value = "abs";

  els.exercise.addEventListener("change", () => {
    renderLeaderboard();
    renderPersonalRecords(); // PRs are scoped to the selected exercise
  });
  els.rank.addEventListener("change", renderLeaderboard);

  // Coliseum comparison filters: re-render both the chart and the PR table, which
  // share the sex/bodyweight filter. The axis inputs only affect the chart, but
  // re-running the whole leaderboard is cheap and keeps the wiring simple.
  const refreshColiseum = () => {
    renderLeaderboard();
    renderPersonalRecords();
  };
  els.sexFilter.addEventListener("change", refreshColiseum);
  els.bwMin.addEventListener("input", refreshColiseum);
  els.bwMax.addEventListener("input", refreshColiseum);
  els.axisMin.addEventListener("input", renderLeaderboard);
  els.axisMax.addEventListener("input", renderLeaderboard);
  els.axisReset.addEventListener("click", () => {
    els.axisMin.value = "";
    els.axisMax.value = "";
    renderLeaderboard();
  });

  els.formula.value = DEFAULT_FORMULA;

  // Populate athlete dropdown (alphabetical by display name).
  const users = distinctUsers(data.records);
  els.athlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  // Pick the athlete to show on load: the one remembered from last visit if it's
  // still in the data, otherwise default to Indre.
  const remembered = loadLastAthlete();
  const rememberedUser = remembered ? users.find((u) => u.username === remembered) : undefined;
  if (rememberedUser) {
    els.athlete.value = rememberedUser.username;
  } else {
    const indre = users.find((u) => u.username.toLowerCase() === "indre_ju");
    if (indre) els.athlete.value = indre.username;
  }
  buildAthleteChips(); // custom chip row mirrors the hidden <select>

  // Test-tab pickers (native selects): choosing an athlete + exercise prefills the
  // calculator with that athlete's top set (custom numbers still work afterwards).
  // Defaults to Adomas + Squat.
  els.testAthlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  const adomas = users.find((u) => u.username.toLowerCase().includes("adomas") || u.user.toLowerCase().includes("adomas"));
  els.testAthlete.value = adomas?.username ?? users[0]?.username ?? "";
  populateTestExercises(els.testAthlete.value);
  els.testAthlete.addEventListener("change", () => {
    populateTestExercises(els.testAthlete.value);
    prefillTestFromPick();
  });
  els.testExercise.addEventListener("change", prefillTestFromPick);

  // Calculator formula tabs (Epley / Brzycki / Nuzzo) — independent of the setting.
  els.calcTabs.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".calc-tab");
    const f = btn?.dataset.formula;
    if (f !== "epley" && f !== "brzycki" && f !== "nuzzo") return;
    calcTab = f;
    for (const t of els.calcTabs.querySelectorAll(".calc-tab"))
      t.classList.toggle("is-active", (t as HTMLElement).dataset.formula === f);
    renderTest();
  });

  prefillTestFromPick(); // load Adomas / Squat into the calculator on first paint

  // Version label + history come from the single CHANGELOG source. The tag is
  // clickable — it opens the Version history page.
  const verEl = document.querySelector<HTMLElement>(".version");
  if (verEl) {
    verEl.textContent = CURRENT_VERSION;
    verEl.title = "Version history";
    verEl.style.cursor = "pointer";
    verEl.addEventListener("click", openChangelog);
  }
  els.changelogVer.textContent = CURRENT_VERSION;
  renderChangelog();

  // Whole-site effort (SP) under the title — just the total and its Fibonacci
  // grade. The per-part breakdown lives in Settings → Version history.
  const effortSummary = document.getElementById("effortSummary");
  if (effortSummary)
    effortSummary.innerHTML =
      `<span class="effort-lbl">Effort</span>` +
      `<span class="effort-total">${WEBSITE_EXACT_SP} SP <span class="effort-fib">≈ ${WEBSITE_SP}</span></span>`;

  renderStatus();
  renderHealth();
  renderAll();
  setupTabs();
  setupDataTab();
  renderDataTab();
  setupAddTab();
  setupGroupsView();
  setupTeamView();
  setupChecklists();

  // Dark / light theme toggle (the saved theme is already applied in <head>).
  els.themeBtn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀" : "🌙";
  els.themeBtn.addEventListener("click", () =>
    setTheme(document.documentElement.getAttribute("data-theme") !== "dark"),
  );

  // "Legs (all)" category visibility in the By-category list (off by default).
  els.showLegsAll.checked = showLegsAll;
  els.showLegsAll.addEventListener("change", () => {
    showLegsAll = els.showLegsAll.checked;
    try { localStorage.setItem("colosseum.legsAll", showLegsAll ? "1" : "0"); } catch { /* ignore */ }
    renderExercisesPage();
  });

  // Settings popover (holds the 1RM formula).
  els.settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSettingsOpen(els.settingsPanel.hidden);
  });
  document.addEventListener("click", (e) => {
    const t = e.target as Node;
    if (!els.settingsPanel.hidden && !els.settingsPanel.contains(t) && t !== els.settingsBtn)
      setSettingsOpen(false);
  });

  // Data health lives on its own overlay page, opened from Settings or by
  // tapping a parse-issues / sanity-warnings badge in the status bar.
  els.healthBtn.addEventListener("click", openHealth);
  els.status.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".badge-link")) openHealth();
  });
  els.healthClose.addEventListener("click", () => {
    els.healthPage.hidden = true;
  });
  els.changelogBtn.addEventListener("click", openChangelog);
  els.changelogClose.addEventListener("click", () => {
    els.changelogPage.hidden = true;
  });

  els.formula.addEventListener("change", renderAll);
  els.bwSource.addEventListener("change", renderAll);
  els.excludeDropsets.addEventListener("change", renderAll);
  els.athlete.addEventListener("change", renderAthlete);
  // Clicking a custom chip drives the hidden <select> (single source of truth).
  els.athleteChips.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".athlete-chip");
    if (!btn?.dataset.username || btn.dataset.username === els.athlete.value) return;
    els.athlete.value = btn.dataset.username;
    renderAthlete();
  });
  els.workoutCalendar.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // Custom filter dropdown: toggle its menu, or pick an option.
    if (target.closest(".xdd-heat .xdd-btn")) {
      const dd = target.closest<HTMLElement>(".xdd-heat")!;
      const menu = dd.querySelector<HTMLElement>(".xdd-menu")!;
      const opening = menu.hasAttribute("hidden");
      menu.toggleAttribute("hidden", !opening);
      dd.classList.toggle("open", opening);
      return;
    }
    const heatOpt = target.closest<HTMLElement>(".xdd-heat .xdd-opt");
    if (heatOpt?.dataset.heatval !== undefined) {
      heatFilter = heatOpt.dataset.heatval;
      return renderWorkoutCalendar();
    }
    const scopeBtn = target.closest<HTMLElement>(".cal-mode-btn");
    if (scopeBtn?.dataset.heatScope) {
      heatScope = scopeBtn.dataset.heatScope === "all" ? "all" : "single";
      return renderWorkoutCalendar();
    }
    const nav = target.closest<HTMLElement>(".cal-nav");
    if (nav?.dataset.heat === "prev") return shiftHeatYear(-1); // older year
    if (nav?.dataset.heat === "next") return shiftHeatYear(1); // newer year
    // "Tag alone": arm/disarm paint mode so day taps toggle the alone tag.
    if (target.closest<HTMLElement>(".cal-tagmode")) {
      aloneTagMode = !aloneTagMode;
      return renderWorkoutCalendar();
    }
    const cell = target.closest<HTMLElement>(".hm-cell[data-date]");
    // In paint mode, tapping a trained day toggles its "alone" tag in place
    // (no jump) so many days can be tagged quickly without scrolling the list.
    if (aloneTagMode && cell?.dataset.date) {
      const key = aloneKey(cell.dataset.date);
      if (aloneTags.has(key)) aloneTags.delete(key);
      else aloneTags.add(key);
      saveAlone();
      cell.classList.toggle("hm-alone", aloneTags.has(key)); // live ring, no full re-render
      return;
    }
    // Otherwise, tapping a trained day in the heatmap jumps to it in the list below.
    if (cell?.dataset.date) jumpToWorkoutDate(cell.dataset.date);
  });
  // Close the heatmap filter menu on any click outside it.
  document.addEventListener("click", (e) => {
    for (const dd of document.querySelectorAll<HTMLElement>(".xdd-heat.open"))
      if (!dd.contains(e.target as Node)) {
        dd.classList.remove("open");
        dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
      }
    // Same for any open per-set RIR dropdown.
    if (!(e.target as HTMLElement).closest(".xdd-rpe.open")) closeAllRpeMenus();
  });
  // "Center on data" snaps the drill-in chart's pan/zoom back to the data fit.
  els.exerciseProgressCenter.addEventListener("click", () => {
    if (selectedExercise) renderExerciseProgressChart(selectedExercise); // re-render resets the view
  });
  // Toggle the drill-in chart between the 1RM trend and the per-set weight→1RM range.
  els.exPersetBest.addEventListener("click", () => {
    exPersetBestOnly = !exPersetBestOnly;
    if (selectedExercise !== null) renderExerciseProgressChart(selectedExercise);
  });
  els.summariseBtn.addEventListener("click", runSummary);
  els.workoutView.addEventListener("change", () => {
    workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.workoutGrouping.addEventListener("change", renderWorkoutsPage);
  els.workoutsPageSize.addEventListener("change", () => {
    workoutsPageSize = Number(els.workoutsPageSize.value) === 50 ? 50 : 20;
    workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.restToggle.addEventListener("change", () => {
    workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.aloneFilter.addEventListener("click", () => {
    aloneFilter = ALONE_FILTER_NEXT[aloneFilter];
    els.aloneFilter.dataset.state = aloneFilter;
    els.aloneFilter.textContent = ALONE_FILTER_LABEL[aloneFilter];
    workoutsPage = 0;
    renderWorkoutsPage();
  });

  // Expand/collapse rows.
  els.lbTable.addEventListener("click", onLeaderboardRowClick);
  els.athleteTable.addEventListener("click", onExerciseRowClick);
  // Back link in the exercise drill-in (lives in the title, outside the table).
  els.athleteTitle.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".back-btn")) {
      selectedExercise = null;
      renderExercisesPage();
      return;
    }
    const info = (e.target as HTMLElement).closest<HTMLElement>(".ex-info-btn");
    if (info?.dataset.exinfo) jumpToExerciseInfo(info.dataset.exinfo);
  });
  // Combine bar: add (select) / remove (chip ✕) an exercise to view together.
  els.exCombineBar.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>(".ex-combine-add");
    if (!sel || !sel.value || selectedExercise === null) return;
    if (sel.value !== selectedExercise && !combinedWith.includes(sel.value)) combinedWith.push(sel.value);
    renderExercisesPage();
  });
  els.exCombineBar.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(".ex-combine-chip[data-remove]");
    const name = chip?.dataset.remove;
    if (!name) return;
    combinedWith = combinedWith.filter((n) => n !== name);
    renderExercisesPage();
  });
  els.workoutsTable.addEventListener("click", onWorkoutRowClick);

  // Reps↔weight calculator table in the exercise drill-in: editing a weight or
  // reps cell recomputes the other cell IN THAT ROW (delegated so it works for
  // rows added later). The source cell is the one being typed, so they don't fight.
  els.ecalcRows.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    const tr = target.closest<HTMLTableRowElement>("tr.ecalc-row");
    if (!tr) return;
    const index = Number(tr.dataset.index);
    if (target.classList.contains("ecalc-cell-weight")) onExerciseCalcInput(index, "weight");
    else if (target.classList.contains("ecalc-cell-reps")) onExerciseCalcInput(index, "reps");
  });
  // Delete-row buttons (delegated). Re-render reindexes the remaining rows.
  els.ecalcRows.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".ecalc-del");
    if (!btn) return;
    const tr = btn.closest<HTMLTableRowElement>("tr.ecalc-row");
    if (tr) ecalcRemoveRow(Number(tr.dataset.index));
  });
  els.ecalcAddRow.addEventListener("click", ecalcAddRow);

  // Period filter for the exercises list — a custom dropdown (not a native
  // select) so the menu looks the same on every OS.
  setupExerciseRange();
  setupExerciseSort();
  setupExerciseSearch();

  // Exercises in-page tabs: List & stats  ↔  Compare graph.
  els.exercisesTabs.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".ex-tab");
    if (!btn?.dataset.extab) return;
    const t = btn.dataset.extab === "compare" ? "compare" : "list";
    if (t === exercisesTab) return;
    exercisesTab = t;
    for (const b of els.exercisesTabs.querySelectorAll<HTMLElement>(".ex-tab"))
      b.classList.toggle("is-active", b.dataset.extab === t);
    renderExercisesPage();
  });
  // Kebab (⋯) opens the filters/sort menu; click-outside closes it.
  els.exFiltersBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.exerciseFilter.hidden = !els.exerciseFilter.hidden;
  });
  // Rep-max reps live in the column header now: editing the header input (fires
  // on blur/Enter, so typing doesn't lose focus) recalculates the column.
  els.athleteTable.addEventListener("change", (e) => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>(".rm-col-input");
    if (!inp) return;
    const n = Math.round(Number(inp.value));
    repMaxCols = Number.isFinite(n) && n >= 1 && n <= 30 ? [n] : [1];
    if (exercisesTab === "list" && selectedExercise === null) renderExercisesPage();
  });
  // Category picker bar: tap a category chip to show/hide it in the list.
  els.exCatBar.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(".ex-cat-chip");
    if (!chip?.dataset.cat) return;
    const cat = chip.dataset.cat;
    if (hiddenExCats.has(cat)) hiddenExCats.delete(cat);
    else hiddenExCats.add(cat);
    try { localStorage.setItem("colosseum.hiddenCats", JSON.stringify([...hiddenExCats])); } catch { /* ignore */ }
    renderExercisesPage();
  });
  document.addEventListener("click", (e) => {
    if (!els.exerciseFilter.hidden && !els.exerciseFilter.contains(e.target as Node) && e.target !== els.exFiltersBtn)
      els.exerciseFilter.hidden = true;
  });

  // Compare-graph chips: toggle an exercise in/out of the overlay (delegated).
  els.compareChips.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-chip");
    if (!chip?.dataset.ex) return;
    const name = chip.dataset.ex;
    if (compareSelected.has(name)) compareSelected.delete(name);
    else compareSelected.add(name);
    renderCompareChips(); // keeps the selected count + chip states in sync
    renderCompareChart();
  });
  // Search box filters the chip list to anything matching by name.
  els.compareSearch.addEventListener("input", () => {
    compareChipQuery = els.compareSearch.value;
    renderCompareChips();
  });
  // Category / tier quick-picks add or remove a whole group at once.
  els.compareCats.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-group");
    if (btn?.dataset.cat) compareToggleCategory(btn.dataset.cat);
  });
  els.compareTiers.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-group");
    if (btn?.dataset.tier) compareToggleTier(btn.dataset.tier);
  });
  els.compareClear.addEventListener("click", () => {
    compareSelected.clear();
    renderCompareSection();
  });
  // Trend ↔ per-set-range view toggle for the compare graph.
  document.getElementById("compareView")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-compareview]");
    if (!btn) return;
    const v = btn.dataset.compareview === "perset" ? "perset" : "trend";
    if (v === compareView) return;
    compareView = v;
    for (const b of document.querySelectorAll<HTMLButtonElement>("#compareView [data-compareview]"))
      b.classList.toggle("is-active", b === btn);
    renderCompareChart();
  });

  // Pagination (delegated on the persistent pager containers). The exercises
  // List & stats view no longer paginates — the Period filter scopes it.
  els.workoutsPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      workoutsPage = p;
      renderWorkoutsPage();
    }
  });
  els.bwGroups.addEventListener("change", onBwInputChange);
  // App-wide active-set controls (Index): tier cutoff dropdown + clear-overrides.
  els.activeSetBar.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("#activeCutoff");
    if (sel) onActiveCutoffChange(sel.value);
  });
  els.activeSetBar.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-asclear]")) clearActiveOverrides();
  });
  // Tap an exercise name on the Index to expand its info panel (toggle).
  els.bwGroups.addEventListener("click", (e) => {
    const nameEl = (e.target as HTMLElement).closest<HTMLElement>(".bw-ex-name");
    if (!nameEl?.dataset.exname) return;
    const row = nameEl.closest<HTMLTableRowElement>("tr");
    if (!row) return;
    if (toggleCollapse(row)) return; // open → close
    insertDetail(row, 3, exerciseInfoHtml(nameEl.dataset.exname));
  });
  for (const input of [els.calcWeight, els.calcReps, els.calcBw, els.calcCoeff])
    input.addEventListener("input", () => {
      els.testPickHint.textContent = ""; // numbers are now custom, not the loaded top set
      renderTest();
    });

  setupBottomNav();

  // Replace every native <select> with a custom HTML/CSS dropdown. Done last, so
  // each select already has its options and current value. (#athlete stays hidden
  // behind its chip row; #exerciseRange is already a custom dropdown.)
  enhanceSelect(els.exercise, { wide: true });
  enhanceSelect(els.dataExercise, { wide: true });
  for (const sel of [
    els.formula, els.bwSource, els.rank, els.sexFilter,
    els.workoutView, els.workoutsPageSize, els.testAthlete, els.testExercise,
    els.dataUser, els.groupsAthlete,
  ])
    enhanceSelect(sel);
}

/** Read the target page index from a pager button click, or null. */
function pageFromClick(e: MouseEvent): number | null {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button.page-btn");
  if (!btn || btn.disabled) return null;
  return Number(btn.dataset.page);
}

// ---- Data tab: see the original CSV and the processed table side by side ----
const DATA_PAGE_SIZE = 100;
let dataView: "processed" | "original" = "processed";
let dataPage = 0;
let dataSearch = "";

/** A number for display: rounded to 2 dp, trailing zeros trimmed; "" for null. */
function dataNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(Math.round(n * 100) / 100);
}

/** One display row. `user`/`date`/`exercise` are the group key (shown once in a
 * header above their rows, not repeated per row); `cells` holds the remaining
 * per-set columns with those three already removed. */
interface DataRow {
  user: string;
  date: string;
  exercise: string; // canonical (processed) or raw (original) exercise name
  cells: string[];
}

/** Raw exercise name → canonical (merged) name, so the Exercise dropdown — which
 * lists canonical names — can also filter the original CSV's raw spellings. */
function rawToCanonicalExercise(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of data.records) {
    if (r.originalExerciseName && r.originalExerciseName !== r.exerciseName) {
      m.set(r.originalExerciseName, r.exerciseName);
    }
  }
  return m;
}

// The three columns lifted into the group header rather than repeated per row.
const DATA_GROUP_COLS = new Set(["user", "date", "exercise_name"]);

/** Build the header + rows for whichever table is active. Username and set_number
 * are omitted entirely; user/date/exercise_name are pulled out as the group key,
 * so `header`/`cells` contain only the remaining per-set columns. */
function dataRows(): { header: string[]; rows: DataRow[] } {
  if (dataView === "original") {
    const raw = parseCsvRows(data.rawCsv);
    const rawHeader = raw[0] ?? [];
    // Drop username/set_number, and split out the grouped columns.
    const dropIdx = new Set(
      rawHeader.flatMap((h, i) => (h === "username" || h === "set_number" ? [i] : [])),
    );
    const userIdx = rawHeader.indexOf("user");
    const dateIdx = rawHeader.indexOf("date");
    const exIdx = rawHeader.indexOf("exercise_name");
    const keep = (row: string[]) =>
      row.filter((_, i) => !dropIdx.has(i) && !DATA_GROUP_COLS.has(rawHeader[i] ?? ""));
    const header = keep(rawHeader);
    const toCanon = rawToCanonicalExercise();
    const rows = raw.slice(1).map((row) => {
      const rawEx = exIdx >= 0 ? (row[exIdx] ?? "") : "";
      return {
        user: userIdx >= 0 ? (row[userIdx] ?? "") : "",
        date: dateIdx >= 0 ? (row[dateIdx] ?? "") : "",
        // Match on the canonical name so the dropdown catches merged spellings.
        exercise: toCanon.get(rawEx) ?? rawEx,
        cells: keep(row),
      };
    });
    return { header, rows };
  }
  // Processed: a tracking table that lays bare EVERY variable and function the
  // app derives for a set, in the order they're computed — so a wrong number can
  // be traced to the exact step. Each column maps to a named function/value:
  //   raw_name        — original logged exercise name (before canonicalisation)
  //   bw_coeff        — coeffFor(): how much bodyweight the lift loads
  //   logged_w        — weight as logged
  //   real_added      — realPullupWeight(): assisted-machine weight halved
  //   bodyweight      — the bodyweight used (per-set log, or athlete table)
  //   bw_source       — which of the two the Setting picked
  //   eff_load        — effectiveLoad() = coeff*bodyweight + real_added (1RM input)
  //   reps / capped   — logged reps, and reps capped at MAX_1RM_REPS for 1RM
  //   epley/brzycki/nuzzo — each estimate1RM formula on the effective load
  //   added_1RM       — addedWeight1RM(): the headline number (bw share peeled off)
  //   volume          — setVolume() = logged_w * reps
  //   dropset/percentile/category/tier/notes — flags & classification
  const header = [
    "raw_name", "bw_coeff", "logged_w", "real_added", "bodyweight", "bw_source",
    "eff_load", "reps", "capped", "epley", "brzycki", "nuzzo", "added_1RM",
    "volume", "dropset", "percentile", "category", "tier", "notes",
  ];
  const fromTable = els.bwSource.value !== "perset";
  const rows = computedRecords().map((r) => {
    // r.weight is already the effective (bw-inclusive) load; r.origWeight is what
    // was logged. Recompute the named intermediates for full transparency.
    const logged = r.origWeight !== undefined ? r.origWeight : r.weight;
    const coeff = coeffFor(r.exerciseName);
    const realAdded = realPullupWeight(r.exerciseName, logged);
    const bw = fromTable ? (ATHLETES[r.username]?.weight ?? null) : r.bodyweight;
    const effLoad = r.weight; // = effectiveLoad(realAdded, bw, coeff)
    const cappedReps = r.reps === null ? null : Math.min(r.reps, MAX_1RM_REPS);
    const overCap = r.reps !== null && r.reps > MAX_1RM_REPS;
    return {
      user: r.user,
      date: r.date,
      exercise: r.exerciseName,
      cells: [
        r.originalExerciseName && r.originalExerciseName !== r.exerciseName ? r.originalExerciseName : "",
        dataNum(coeff),
        dataNum(logged),
        realAdded === logged ? "" : dataNum(realAdded),
        dataNum(bw),
        coeff > 0 ? (fromTable ? "table" : "per-set") : "—",
        dataNum(effLoad),
        dataNum(r.reps),
        cappedReps !== r.reps ? dataNum(cappedReps) : "",
        // Above the rep cap there's no reliable 1RM — blank the formula columns
        // (matches addedWeight1RM, which returns "—" past the cap).
        overCap ? "" : dataNum(epley1RM(effLoad, r.reps)),
        overCap ? "" : dataNum(brzycki1RM(effLoad, r.reps)),
        overCap ? "" : dataNum(nuzzo1RM(effLoad, r.reps)),
        dataNum(addedWeight1RM(r, currentFormula())),
        dataNum(setVolume(logged, r.reps)),
        r.dropset ? "TRUE" : "",
        dataNum(r.percentile),
        exerciseCategory(r.exerciseName),
        exerciseTier(r.exerciseName),
        r.notes,
      ],
    };
  });
  return { header, rows };
}

function renderDataTab() {
  const { header, rows } = dataRows();
  const exPick = els.dataExercise.value;
  const userPick = els.dataUser.value;
  const q = dataSearch.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (userPick && row.user !== userPick) return false;
    if (exPick && row.exercise !== exPick) return false;
    if (q && !row.cells.some((c) => c.toLowerCase().includes(q))) return false;
    return true;
  });

  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / DATA_PAGE_SIZE) - 1);
  if (dataPage > maxPage) dataPage = maxPage;
  const start = dataPage * DATA_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + DATA_PAGE_SIZE);

  // Group consecutive rows by (user, date, exercise): emit the key once as a
  // banner row, then its data rows below. prevKey starts null so the first row
  // of every page always re-prints its banner (groups can span page breaks).
  const cols = header.length;
  let prevKey: string | null = null;
  const bodyParts: string[] = [];
  for (const row of pageRows) {
    const key = `${row.user} ${row.date} ${row.exercise}`;
    if (key !== prevKey) {
      bodyParts.push(
        `<tr class="data-group"><td colspan="${cols}">` +
          `<span class="dg-user">${escapeHtml(row.user)}</span>` +
          `<span class="dg-sep">·</span><span class="dg-ex">${escapeHtml(row.exercise)}</span>` +
          `<span class="dg-sep">·</span><span class="dg-date">${escapeHtml(row.date)}</span>` +
          `</td></tr>`,
      );
      prevKey = key;
    }
    bodyParts.push(`<tr>${row.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`);
  }

  const thead = `<thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
  const active = exPick || userPick || q;
  const count = `<p class="muted" style="margin:0 0 0.6rem">${total.toLocaleString()} rows${active ? " (filtered)" : ""}</p>`;
  els.dataTableWrap.innerHTML =
    count + `<table class="data-table data-raw-table">${thead}<tbody>${bodyParts.join("")}</tbody></table>`;
  els.dataPager.innerHTML = pagerHtml(dataPage, total, DATA_PAGE_SIZE);
}

/** Fill the Data-tab Exercise and Athlete dropdowns from the loaded records. */
function populateDataFilters() {
  const exercises = distinctExercises(data.records);
  els.dataExercise.innerHTML =
    `<option value="">All exercises</option>` +
    exercises.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  // Value is the display name ("Adomas") because that's the `user` column both
  // the processed records and the original CSV carry — so one dropdown filters
  // both tables consistently.
  const users = distinctUsers(data.records);
  els.dataUser.innerHTML =
    `<option value="">All athletes</option>` +
    users.map((u) => `<option value="${escapeHtml(u.user)}">${escapeHtml(u.user)}</option>`).join("");
}

// ---- "Refresh data" status -------------------------------------------------
// The refresh runs as a GitHub Action (see the Data tab + fetch-data.yml). The
// browser can read its status from the public GitHub API (api.github.com sends
// CORS headers, and public-repo run status needs no auth), so we can tell the
// owner whether to keep waiting or that it failed — without leaving the page.
const REFRESH_RUNS_API =
  "https://api.github.com/repos/adomasgaudi/data/actions/workflows/fetch-data.yml/runs?per_page=1";
let refreshPollTimer: number | null = null;

/** Human "x min ago" for an ISO timestamp. */
function agoText(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function setRefreshStatus(html: string, cls: string) {
  els.refreshStatus.className = `refresh-status ${cls}`;
  els.refreshStatus.innerHTML = html;
}

/** Fetch the latest fetch-data run and show whether to keep waiting / it failed.
 * Re-polls itself every 12 s while a run is still going. */
async function pollRefreshStatus(): Promise<void> {
  if (refreshPollTimer !== null) { clearTimeout(refreshPollTimer); refreshPollTimer = null; }
  let run: {
    status: string; conclusion: string | null; html_url: string;
    run_started_at?: string; updated_at: string; created_at: string;
  } | null = null;
  try {
    const res = await fetch(REFRESH_RUNS_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    run = data.workflow_runs?.[0] ?? null;
  } catch {
    setRefreshStatus(
      `Couldn't reach GitHub to check status — <a href="https://github.com/adomasgaudi/data/actions/workflows/fetch-data.yml" target="_blank" rel="noopener">open it on GitHub</a>.`,
      "is-unknown",
    );
    return;
  }
  if (!run) {
    setRefreshStatus("No refresh has run yet. Click the button above to start one.", "is-idle");
    return;
  }
  const link = `<a href="${escapeHtml(run.html_url)}" target="_blank" rel="noopener">view on GitHub →</a>`;
  if (run.status !== "completed") {
    const started = run.run_started_at ?? run.created_at;
    setRefreshStatus(
      `⏳ <strong>Refresh is running…</strong> keep waiting (started ${agoText(started)}). This page will update the status by itself. ${link}`,
      "is-running",
    );
    refreshPollTimer = window.setTimeout(pollRefreshStatus, 12_000);
    return;
  }
  // Completed.
  if (run.conclusion === "success") {
    setRefreshStatus(
      `✓ <strong>Last refresh succeeded</strong> (${agoText(run.updated_at)}). If you just ran it, reload this page to see the new data. ${link}`,
      "is-ok",
    );
  } else {
    setRefreshStatus(
      `✗ <strong>Last refresh failed</strong> (${run.conclusion ?? "stopped"}, ${agoText(run.updated_at)}). ${link}`,
      "is-fail",
    );
  }
}

function setupDataTab() {
  populateDataFilters();
  els.refreshStatusBtn.addEventListener("click", () => {
    setRefreshStatus("Checking…", "is-idle");
    void pollRefreshStatus();
  });
  document.querySelectorAll<HTMLButtonElement>(".data-viewbtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.dataview === "original" ? "original" : "processed";
      if (v === dataView) return;
      dataView = v;
      dataPage = 0;
      document.querySelectorAll<HTMLButtonElement>(".data-viewbtn").forEach((b) =>
        b.classList.toggle("is-active", b === btn),
      );
      renderDataTab();
    });
  });
  els.dataExercise.addEventListener("change", () => {
    dataPage = 0;
    renderDataTab();
  });
  els.dataUser.addEventListener("change", () => {
    dataPage = 0;
    renderDataTab();
  });
  els.dataSearch.addEventListener("input", () => {
    dataSearch = els.dataSearch.value;
    dataPage = 0;
    renderDataTab();
  });
  els.dataPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      dataPage = p;
      renderDataTab();
    }
  });
}

/**
 * Wire up the Guide's training checklists: restore ticked boxes from this
 * device's localStorage, save on every change, keep the "x / y done" count
 * fresh and let the Reset button clear a list. Each box has a stable data-key.
 */
// ---- Add tab: hand-logged sets, saved on-device and merged with the CSV data --
interface ManualEntry {
  id: string;
  user: string;
  username: string;
  date: string;
  exerciseName: string;
  weight: number | null;
  reps: number | null;
}
const MANUAL_KEY = "colosseum.manualSets.v1";
let manualEntries: ManualEntry[] = loadManual();

function loadManual(): ManualEntry[] {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    return raw ? (JSON.parse(raw) as ManualEntry[]) : [];
  } catch {
    return [];
  }
}
function saveManual() {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(manualEntries));
  } catch {
    /* storage unavailable (private mode) — entries still apply this session */
  }
}

/** Turn a stored entry into a SetRecord matching the CSV shape, so every view
 * treats it identically. Bodyweight comes from the athlete profile table. */
function manualToRecord(m: ManualEntry): SetRecord {
  return {
    user: m.user,
    username: m.username,
    date: m.date,
    bodyweight: ATHLETES[m.username]?.weight ?? null,
    exerciseName: m.exerciseName,
    setNumber: 1,
    weight: m.weight,
    reps: m.reps,
    notes: "",
    dropset: false,
    percentile: null,
  };
}

/** Append the hand-logged sets to the loaded dataset (called once after load and
 * after any add/delete, by rebuilding from data.csvRecords + manual). */
let csvRecordCount = 0; // how many of data.records came from the CSV (the prefix)
function mergeManualSets() {
  // Keep the first csvRecordCount records (the CSV) and re-append manual ones.
  data.records.length = csvRecordCount;
  for (const m of manualEntries) data.records.push(manualToRecord(m));
}

/** Populate the Add form's athlete dropdown + exercise suggestions and the table. */
function renderAddTab() {
  const users = distinctUsers(data.records);
  const prev = els.addAthlete.value;
  els.addAthlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  if (prev) els.addAthlete.value = prev;
  els.addExerciseList.innerHTML = distinctExercises(data.records)
    .map((e) => `<option value="${escapeHtml(e)}"></option>`)
    .join("");
  if (!els.addDate.value) els.addDate.value = todayIso();

  // Recently-added list (newest first), each with a delete button.
  const rows = [...manualEntries]
    .reverse()
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.user)}</td><td>${escapeHtml(m.exerciseName)}</td>` +
        `<td class="num">${m.weight ?? "—"}${m.reps != null ? `×${m.reps}` : ""}</td>` +
        `<td class="num">${escapeHtml(m.date)}</td>` +
        `<td class="num"><button type="button" class="manual-del" data-id="${escapeHtml(m.id)}" aria-label="Delete">×</button></td></tr>`,
    )
    .join("");
  els.addCount.textContent = manualEntries.length ? `(${manualEntries.length})` : "";
  els.addTable.innerHTML = manualEntries.length
    ? `<thead><tr><th>Athlete</th><th>Exercise</th><th class="num">Set</th><th class="num">Date</th><th></th></tr></thead><tbody>${rows}</tbody>`
    : `<tbody><tr><td class="muted">No hand-logged sets yet.</td></tr></tbody>`;
}

function onAddSubmit() {
  const username = els.addAthlete.value;
  const user = els.addAthlete.selectedOptions[0]?.textContent ?? username;
  const exerciseName = els.addExercise.value.trim();
  const weight = parseFloat(els.addWeight.value);
  const reps = Math.round(parseFloat(els.addReps.value));
  const date = els.addDate.value || todayIso();
  if (!username || !exerciseName) {
    els.addHint.textContent = "Pick an athlete and enter an exercise.";
    return;
  }
  if (!Number.isFinite(reps) || reps < 1) {
    els.addHint.textContent = "Enter the reps (1 or more).";
    return;
  }
  manualEntries.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user,
    username,
    date,
    exerciseName,
    weight: Number.isFinite(weight) ? weight : null,
    reps,
  });
  saveManual();
  mergeManualSets();
  els.addWeight.value = "";
  els.addReps.value = "";
  els.addExercise.value = "";
  els.addHint.textContent = `Added ${exerciseName} ${Number.isFinite(weight) ? `${weight}kg × ` : ""}${reps} for ${user}.`;
  renderAddTab();
  renderAll(); // every view now includes the new set
  renderDataTab();
}

/** Download the hand-logged sets as a JSON backup (portable across devices). */
function exportManual() {
  const blob = new Blob([JSON.stringify(manualEntries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `colosseum-added-sets-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Merge an imported backup into the on-device sets (dedupe by id). */
async function importManual(file: File) {
  try {
    const arr = JSON.parse(await file.text()) as ManualEntry[];
    if (!Array.isArray(arr)) throw new Error("not a backup file");
    const byId = new Map(manualEntries.map((m) => [m.id, m]));
    let added = 0;
    for (const m of arr)
      if (m && typeof m.id === "string" && typeof m.username === "string" && typeof m.exerciseName === "string") {
        if (!byId.has(m.id)) added++;
        byId.set(m.id, m);
      }
    manualEntries = [...byId.values()];
    saveManual();
    mergeManualSets();
    renderAddTab();
    renderAll();
    renderDataTab();
    els.addHint.textContent = `Imported — ${added} new set${added === 1 ? "" : "s"} added (${manualEntries.length} total).`;
  } catch (err) {
    els.addHint.textContent = `Couldn't read that file: ${String(err)}`;
  }
}

function setupAddTab() {
  renderAddTab();
  els.addSubmit.addEventListener("click", onAddSubmit);
  els.addExport.addEventListener("click", exportManual);
  els.addImport.addEventListener("click", () => els.addImportFile.click());
  els.addImportFile.addEventListener("change", () => {
    const file = els.addImportFile.files?.[0];
    if (file) void importManual(file);
    els.addImportFile.value = ""; // allow re-importing the same file
  });
  els.addTable.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".manual-del");
    if (!btn?.dataset.id) return;
    manualEntries = manualEntries.filter((m) => m.id !== btn.dataset.id);
    saveManual();
    mergeManualSets();
    renderAddTab();
    renderAll();
    renderDataTab();
  });
}

function setupChecklists() {
  const lists = Array.from(document.querySelectorAll<HTMLElement>("[data-checklist]"));
  for (const list of lists) {
    const storeKey = `colosseum.checklist.${list.dataset.checklist}`;
    const boxes = Array.from(
      list.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-key]'),
    );
    const progress = list.querySelector<HTMLElement>("[data-progress]");
    const resetBtn = list.querySelector<HTMLButtonElement>("[data-reset]");

    let saved: Record<string, boolean> = {};
    try {
      saved = JSON.parse(localStorage.getItem(storeKey) ?? "{}");
    } catch {
      saved = {};
    }

    const updateProgress = () => {
      if (!progress) return;
      const done = boxes.filter((b) => b.checked).length;
      progress.textContent = `${done} / ${boxes.length} done`;
    };

    const save = () => {
      const state: Record<string, boolean> = {};
      for (const b of boxes) if (b.checked) state[b.dataset.key!] = true;
      try {
        localStorage.setItem(storeKey, JSON.stringify(state));
      } catch {
        // Storage may be full or blocked (private mode); ticks just won't persist.
      }
    };

    for (const b of boxes) {
      b.checked = saved[b.dataset.key!] === true;
      b.addEventListener("change", () => {
        save();
        updateProgress();
      });
    }
    updateProgress();

    resetBtn?.addEventListener("click", () => {
      for (const b of boxes) b.checked = false;
      save();
      updateProgress();
    });
  }
}

/** Toggle which tab panel is visible when a tab button is clicked. */
// ---- Group view: muscle-group categories across athletes --------------------

/** One collapsible-free card per group, with a small heading + a count chip. */
function groupCard(name: string, memberCount: number, bodyHtml: string): string {
  return (
    `<div class="gv-card"><div class="gv-card-head">` +
    `<h3>${escapeHtml(name)}</h3>` +
    `<span class="muted gv-count">${memberCount} lift${memberCount === 1 ? "" : "s"}</span>` +
    `</div>${bodyHtml}</div>`
  );
}

/** Render the Group view: each category (LIST_CATEGORIES, multi-membership)
 * shown for one athlete (best 1RM per member lift) or for everyone (a mini
 * leaderboard across the category's member lifts). */
function renderGroupsView() {
  const formula = currentFormula();
  const recs = computedRecords();
  const present = distinctExercises(activeRecords()); // most-trained first (active set)

  // Athlete picker: "Everyone" + each athlete; keep the current selection.
  const users = distinctUsers(data.records);
  const prev = els.groupsAthlete.value;
  els.groupsAthlete.innerHTML =
    `<option value="">Everyone</option>` +
    users.map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`).join("");
  els.groupsAthlete.value = prev || "";
  const who = els.groupsAthlete.value;

  // Each "source" is a named category bucket with its member lifts in the data.
  const sources: { name: string; members: string[] }[] = LIST_CATEGORIES.map((cat) => ({
    name: cat,
    members: present.filter((e) => exerciseCategories(e).includes(cat)),
  }));

  const base = filterRecords(recs, { excludeDropsets: els.excludeDropsets.checked });
  const cards: string[] = [];

  for (const g of sources) {
    const members = g.members;
    if (members.length === 0) continue;

    if (who) {
      // One athlete: best estimated 1RM per member lift, biggest as the headline.
      const prs = personalRecords(
        filterRecords(recs, { usernames: [who], excludeDropsets: els.excludeDropsets.checked }),
        formula,
      );
      const byEx = new Map(prs.map((p) => [p.exerciseName, p]));
      const rows = members
        .map((m) => byEx.get(m))
        .filter((p): p is PersonalRecord => p !== undefined)
        .sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm);
      if (rows.length === 0) {
        cards.push(groupCard(g.name, members.length, `<p class="muted gv-empty">Not trained yet.</p>`));
        continue;
      }
      const best = rows[0]!.bestE1rm;
      const body =
        `<div class="gv-head-num"><span class="gv-big">${fmt(best.e1rm)}</span><span class="gv-unit">kg est. 1RM</span></div>` +
        `<table class="data-table gv-table"><tbody>` +
        rows
          .map((p) => {
            const w = p.bestE1rm.weight;
            return (
              `<tr><td><span class="ex-code">${escapeHtml(exerciseCode(p.exerciseName))}</span>` +
              `<span class="gv-sub muted">${escapeHtml(p.exerciseName)}</span></td>` +
              `<td class="num">${fmt(p.bestE1rm.e1rm)}</td>` +
              `<td class="num gv-raw">${w === null ? "—" : fmt(w)}×${p.bestE1rm.reps}</td></tr>`
            );
          })
          .join("") +
        `</tbody></table>`;
      cards.push(groupCard(g.name, members.length, body));
    } else {
      // Everyone: best e1rm per athlete across the group's member lifts, ranked.
      const byUser = new Map<string, { user: string; e1rm: number; ex: string }>();
      for (const m of members) {
        for (const e of leaderboard(base, m, formula)) {
          const cur = byUser.get(e.username);
          if (!cur || e.e1rm > cur.e1rm) byUser.set(e.username, { user: e.user, e1rm: e.e1rm, ex: m });
        }
      }
      const ranked = [...byUser.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);
      const body =
        ranked.length === 0
          ? `<p class="muted gv-empty">Not trained yet.</p>`
          : `<table class="data-table gv-table"><tbody>` +
            ranked
              .map(
                (r, i) =>
                  `<tr><td class="gv-rank">${i + 1}</td>` +
                  `<td>${escapeHtml(r.user)}<span class="gv-sub muted">${escapeHtml(exerciseCode(r.ex))}</span></td>` +
                  `<td class="num">${fmt(r.e1rm)}</td></tr>`,
              )
              .join("") +
            `</tbody></table>`;
      cards.push(groupCard(g.name, members.length, body));
    }
  }

  els.groupsBody.innerHTML =
    cards.join("") || `<p class="muted">No grouped lifts in the data yet.</p>`;
}

function setupGroupsView() {
  els.groupsAthlete.addEventListener("change", renderGroupsView);
  renderGroupsView(); // populate the athlete picker before first open
}

// ---- Group view: train two+ people together, levels + workouts side by side --

/** Who's in the current training session (usernames). Seeded with the first two
 * athletes the first time the view opens; the user toggles people in/out. */
const teamSelected = new Set<string>();

/** Render the multi-person Group view: ONE combined table of every exercise any
 * selected athlete has trained, with each person's estimated 1RM side by side so
 * they can be compared directly (— where someone hasn't done it; the leader's
 * cell per row is highlighted). A compact per-person summary sits on top. */
function renderTeamView() {
  const users = distinctUsers(data.records);
  if (teamSelected.size === 0) for (const u of users.slice(0, 2)) teamSelected.add(u.username);
  for (const name of [...teamSelected]) if (!users.some((x) => x.username === name)) teamSelected.delete(name);

  els.teamChips.innerHTML = users
    .map(
      (u) =>
        `<button type="button" class="team-chip${teamSelected.has(u.username) ? " is-active" : ""}" ` +
        `data-username="${escapeHtml(u.username)}">${escapeHtml(u.user)}</button>`,
    )
    .join("");

  const picks = users.filter((u) => teamSelected.has(u.username));
  if (picks.length === 0) {
    els.teamBody.innerHTML = `<p class="muted">Pick at least one person above.</p>`;
    return;
  }
  const formula = currentFormula();
  const recs = computedRecords();

  // Per-person best estimated 1RM by exercise, plus a quick header summary.
  const maps = picks.map((u) => {
    const m = new Map<string, number>();
    for (const p of personalRecords(
      filterRecords(recs, { usernames: [u.username], excludeDropsets: els.excludeDropsets.checked }),
      formula,
    ))
      m.set(p.exerciseName, p.bestE1rm.e1rm);
    return m;
  });
  const summaries = picks
    .map((u) => {
      const s = athleteSummary(activeRecords(), u.username);
      const bw = s.bodyweightLast;
      return (
        `<div class="team-sumchip"><strong>${escapeHtml(u.user)}</strong>` +
        `<span class="muted">${bw !== null ? `${fmt(bw)} kg · ` : ""}${s.sessionsPerWeek.toFixed(1)}/wk · ${s.sets} sets</span></div>`
      );
    })
    .join("");

  // Union of every exercise anyone in the group has trained, busiest 1RM first.
  const union = [...new Set(maps.flatMap((m) => [...m.keys()]))];
  const topOf = (ex: string) => Math.max(...maps.map((m) => m.get(ex) ?? 0));
  union.sort((a, b) => topOf(b) - topOf(a));
  const codes = exerciseCodesFor(union);

  const head =
    `<thead><tr><th>Exercise</th>${picks.map((u) => `<th class="num">${escapeHtml(u.user)}</th>`).join("")}</tr></thead>`;
  const rows = union
    .map((ex) => {
      const vals = maps.map((m) => m.get(ex));
      const present = vals.filter((v): v is number => v !== undefined);
      const best = present.length ? Math.max(...present) : null;
      const shared = present.length === picks.length && picks.length > 1;
      const cells = vals
        .map((v) => `<td class="num${v !== undefined && v === best ? " team-win" : ""}">${v === undefined ? "—" : fmt(v)}</td>`)
        .join("");
      return (
        `<tr class="${shared ? "team-shared-row" : ""}"><td><span class="ex-code">${escapeHtml(codes.get(ex) ?? exerciseCode(ex))}</span>` +
        `<span class="gv-sub muted">${escapeHtml(ex)}</span></td>${cells}</tr>`
      );
    })
    .join("");

  els.teamBody.innerHTML =
    `<div class="team-summaries">${summaries}</div>` +
    (union.length
      ? `<div class="team-sec-lbl">All exercises · est 1RM (kg) — shared rows highlighted</div>` +
        `<table class="data-table team-shared-table">${head}<tbody>${rows}</tbody></table>`
      : `<p class="muted">No exercises logged for the selected people in this view.</p>`);
}

function setupTeamView() {
  for (const u of loadTeamPicks()) teamSelected.add(u); // remember last session's picks
  els.teamChips.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".team-chip");
    const name = btn?.dataset.username;
    if (!name) return;
    if (teamSelected.has(name)) teamSelected.delete(name);
    else teamSelected.add(name);
    saveTeamPicks([...teamSelected]);
    renderTeamView();
  });
}

/**
 * Switch the visible top-level panel (leaderboards, athlete, groups, add, …).
 * The old top `.tabs` bar is hidden (CSS) in favour of the bottom nav, but its
 * buttons stay in the DOM as the is-active source of truth; this drives both.
 */
function switchTopTab(name: string) {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab, .guide-btn"));
  for (const t of tabs) t.classList.toggle("is-active", t.dataset.tab === name);
  // Panels aren't all backed by a .tab button (e.g. #tab-groups), so toggle by id.
  for (const panel of document.querySelectorAll<HTMLElement>(".tab-panel"))
    panel.hidden = panel.id !== `tab-${name}`;
  // Chart.js needs a resize nudge if it was first drawn while hidden.
  if (name === "leaderboards") renderLeaderboard(); // re-render at the real width
  if (name === "data") void pollRefreshStatus();
  if (name === "sitemap") renderSiteMap();
  if (name === "groups") renderGroupsView();
  if (name === "team") renderTeamView();
  updateBottomNav();
}

function setupTabs() {
  // ".guide-btn" is the top-bar Guide button (lives outside the .tabs nav but
  // still switches to the guide panel via its data-tab).
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".tab, .guide-btn"))
    tab.addEventListener("click", () => switchTopTab(tab.dataset.tab ?? ""));
}

/**
 * Replace a native <select> with a custom HTML/CSS dropdown (no OS chrome). The
 * native select is hidden but kept as the source of truth, so all existing
 * population (innerHTML of <option>s), `.value` reads and "change" listeners
 * keep working untouched. A MutationObserver re-syncs the custom UI whenever the
 * options are repopulated; selecting an option sets `.value` and fires "change".
 */
function enhanceSelect(sel: HTMLSelectElement, opts: { wide?: boolean } = {}) {
  sel.classList.add("dd-native");
  const dd = document.createElement("div");
  dd.className = "xdd" + (opts.wide ? " xdd-wide" : "");
  sel.insertAdjacentElement("afterend", dd);

  const optHtml = (o: HTMLOptionElement) =>
    `<button type="button" class="xdd-opt${o.value === sel.value ? " is-active" : ""}" data-val="${escapeHtml(o.value)}" role="option">${escapeHtml(o.textContent ?? "")}</button>`;

  const sync = () => {
    let menu = "";
    for (const node of Array.from(sel.children)) {
      if (node instanceof HTMLOptGroupElement) {
        menu += `<div class="xdd-group">${escapeHtml(node.label)}</div>`;
        for (const o of Array.from(node.children)) if (o instanceof HTMLOptionElement) menu += optHtml(o);
      } else if (node instanceof HTMLOptionElement) {
        menu += optHtml(node);
      }
    }
    const wasOpen = dd.classList.contains("open");
    dd.innerHTML =
      `<button type="button" class="xdd-btn">${escapeHtml(sel.selectedOptions[0]?.textContent ?? "")}<span class="xdd-caret">▾</span></button>` +
      `<div class="xdd-menu"${wasOpen ? "" : " hidden"} role="listbox">${menu}</div>`;
  };
  sync();

  const close = () => {
    dd.classList.remove("open");
    dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
  };
  dd.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".xdd-btn")) {
      const menu = dd.querySelector<HTMLElement>(".xdd-menu")!;
      const opening = menu.hasAttribute("hidden");
      menu.toggleAttribute("hidden", !opening);
      dd.classList.toggle("open", opening);
      return;
    }
    const opt = t.closest<HTMLElement>(".xdd-opt");
    if (opt?.dataset.val !== undefined) {
      if (sel.value !== opt.dataset.val) {
        sel.value = opt.dataset.val;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close();
      sync();
    }
  });
  document.addEventListener("click", (e) => {
    if (!dd.contains(e.target as Node)) close();
  });
  // Repopulating the select (new <option>s) or a code-driven change re-syncs.
  new MutationObserver(() => sync()).observe(sel, { childList: true, subtree: true });
  sel.addEventListener("change", sync);
}

/** Show one of the Athlete sub-views (Workouts / Exercises). Decoupled from the
 * nav buttons so it works whether called from the bottom nav or from code (e.g.
 * a list row jumping to Exercises). Does NOT switch the top tab — callers that
 * need the Athlete panel visible should switchTopTab("athlete") first. */
function showSubtab(name: string) {
  for (const n of ["workouts", "exercises"]) {
    const panel = document.getElementById(`sub-${n}`);
    if (panel) panel.hidden = n !== name;
  }
  updateBottomNav();
}

/** Light up the right bottom-nav item: Workouts/Exercises when the Athlete tab
 * shows that sub-view, otherwise "Other" (anything reached via the sheet). */
function updateBottomNav() {
  const athleteOpen = document.getElementById("tab-athlete")?.hidden === false;
  const activeSub = !athleteOpen
    ? null
    : document.getElementById("sub-exercises")?.hidden === false
      ? "exercises"
      : "workouts";
  for (const b of document.querySelectorAll<HTMLButtonElement>(".subtab")) {
    const nav = b.dataset.nav;
    const active = nav === "other" ? !athleteOpen : athleteOpen && nav === activeSub;
    b.classList.toggle("is-active", active);
  }
}

function setOtherSheetOpen(open: boolean) {
  els.otherSheet.hidden = !open;
  document.body.classList.toggle("sheet-open", open);
}

/** Bottom nav (Workouts | Exercises | Other) + the "Other" sheet of secondary
 * views. Workouts/Exercises drive the Athlete sub-views; Other opens the sheet,
 * whose items jump to their top-tab panel. */
function setupBottomNav() {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".subtab")) {
    b.addEventListener("click", () => {
      const nav = b.dataset.nav;
      if (nav === "other") {
        setOtherSheetOpen(els.otherSheet.hidden);
        return;
      }
      setOtherSheetOpen(false);
      switchTopTab("athlete");
      showSubtab(nav ?? "workouts");
    });
  }
  // Sheet items each open a top-tab panel and close the sheet.
  for (const item of els.otherSheet.querySelectorAll<HTMLButtonElement>(".other-item")) {
    item.addEventListener("click", () => {
      setOtherSheetOpen(false);
      switchTopTab(item.dataset.tab ?? "");
    });
  }
  // Tapping the backdrop (or anything marked data-other-close) dismisses it.
  els.otherSheet.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-other-close]")) setOtherSheetOpen(false);
  });
}

// Decorative landing gate. It's skipped entirely once you've signed in (the head
// script hides it before paint via .signed-in); otherwise lock scrolling until the
// single "Sign in as admin" button reveals the app and remembers you for next time.
{
  const signedIn = (() => { try { return localStorage.getItem("colosseum.signedIn") === "1"; } catch { return false; } })();
  const gate = document.getElementById("loginGate");
  if (signedIn) {
    if (gate) gate.hidden = true;
  } else {
    document.body.classList.add("locked");
    document.getElementById("loginAdminBtn")?.addEventListener("click", () => {
      try { localStorage.setItem("colosseum.signedIn", "1"); } catch { /* ignore */ }
      if (gate) gate.hidden = true;
      document.body.classList.remove("locked");
    });
  }
}

void init();
