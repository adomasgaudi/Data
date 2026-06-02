/**
 * App entry point. Thin glue only: load + validate data, read control state,
 * call the pure compute functions, and paint the DOM. No business logic lives
 * here — it's all in metrics.ts / aggregate.ts where it is tested.
 */
import { Chart, registerables } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import Hammer from "hammerjs";
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
  scaleToGroup,
  athleteSummary,
  type PersonalRecord,
  type WorkoutDay,
  type ExerciseCount,
  type ExerciseDayPoint,
} from "./aggregate";
import {
  epley1RM,
  brzycki1RM,
  nuzzo1RM,
  benchPctForReps,
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
  EXERCISE_GROUPS,
  exerciseCategory,
  exerciseCode,
  exerciseCodesFor,
  exerciseTier,
  TRAINING_CATEGORIES,
  type TrainingCategory,
} from "./profile";
import { DEFAULT_FORMULA } from "./config";
import { CHANGELOG, CURRENT_VERSION } from "./changelog";

// chartjs-plugin-zoom reads Hammer from the global scope for touch pan/pinch on
// phones; make it available before the plugin registers.
(globalThis as unknown as { Hammer?: unknown }).Hammer ??= Hammer;
Chart.register(...registerables, zoomPlugin);

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const els = {
  status: $("status"),
  settingsBtn: $<HTMLButtonElement>("settingsBtn"),
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
  groupToggle: $<HTMLInputElement>("groupToggle"),
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
  exProgressView: $("exProgressView"),
  exerciseFilter: $("exerciseFilter"),
  exerciseCompare: $<HTMLDetailsElement>("exerciseCompare"),
  compareChips: $("compareChips"),
  compareNote: $("compareNote"),
  exerciseSearch: $<HTMLInputElement>("exerciseSearch"),
  exerciseNotTrained: $<HTMLInputElement>("exerciseNotTrained"),
  exerciseShowThird: $<HTMLInputElement>("exerciseShowThird"),
  exerciseRange: $<HTMLDetailsElement>("exerciseRange"),
  exerciseSort: $("exerciseSort"),
  exercisesPager: $("exercisesPager"),
  workoutsTitle: $("workoutsTitle"),
  workoutCalendar: $("workoutCalendar"),
  workoutsTable: $<HTMLTableElement>("workoutsTable"),
  workoutsPager: $("workoutsPager"),
  workoutView: $<HTMLSelectElement>("workoutView"),
  workoutsPageSize: $<HTMLSelectElement>("workoutsPageSize"),
  restToggle: $<HTMLInputElement>("restToggle"),
  restToggleLabel: $("restToggleLabel"),
  summariseBtn: $<HTMLButtonElement>("summariseBtn"),
  summaryOut: $("summaryOut"),
  bwTitle: $("bwTitle"),
  bwGroups: $("bwGroups"),
  mergeList: $("mergeList"),
  recordsTitle: $("recordsTitle"),
  recordsTable: $<HTMLTableElement>("recordsTable"),
  recordsPager: $("recordsPager"),
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
  dataSearch: $<HTMLInputElement>("dataSearch"),
  dataExercise: $<HTMLSelectElement>("dataExercise"),
  dataUser: $<HTMLSelectElement>("dataUser"),
};

let data: LoadedData;
let lbChart: Chart | null = null;
let exerciseChart: Chart | null = null; // per-exercise drill-in progress graph
let calcCurveChart: Chart | null = null; // Test-tab weight-vs-reps diagram
let compareChart: Chart | null = null; // Exercises list multi-exercise overlay
const compareSelected = new Set<string>(); // exercises ticked for the overlay graph
let exProgressView: "trend" | "perset" = "trend"; // 1RM-trend vs per-set weight→1RM range

const PAGE_SIZE = 20;

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

function computedRecords(): SetRecord[] {
  return data.records.map(computeRecord);
}

/**
 * Fill the Colosseum exercise picker. By DEFAULT (toggle off) it lists only pure
 * exercises — every distinct logged lift, on its own, no scaling. When the owner
 * ticks the grouped/scaled toggle, the scaled GROUP names are prepended (and the
 * member lifts stay listed too, so you can still pick the pure version).
 * Re-runnable: keeps the current selection if it still exists, else picks the
 * first option. Call it on load and whenever the toggle flips.
 *
 * AI-NOTE: groups are intentionally hidden by default — see selectionRecords.
 */
function populateExercisePicker(): void {
  const prev = els.exercise.value;
  const exercises = distinctExercises(data.records); // pure lifts, most-logged first
  const groupsWithData = els.groupToggle.checked
    ? EXERCISE_GROUPS.filter((g) => exercises.some((e) => g.members[e] !== undefined)).map((g) => g.name)
    : [];
  const options = [...groupsWithData, ...exercises];
  els.exercise.innerHTML = options
    .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
    .join("");
  els.exercise.value = options.includes(prev) ? prev : (options[0] ?? "");
}

/**
 * If the leaderboard selection is a group, fold its members in (scaled); else as-is.
 *
 * AI-NOTE: group scaling is OFF by default. It fabricates a cross-exercise
 * comparison (e.g. a single-leg RDL ÷0.35 looks like a much bigger deadlift), so
 * groups only appear — and only scale — when the owner ticks the "grouped/scaled
 * estimates" toggle. With the toggle off, group names aren't even offered in the
 * picker (see populateExercisePicker), so this returns records unchanged.
 */
function selectionRecords(records: SetRecord[], selection: string): SetRecord[] {
  if (!els.groupToggle.checked) return records; // pure exercises only
  const grp = EXERCISE_GROUPS.find((g) => g.name === selection);
  return grp ? scaleToGroup(records, grp.name, grp.members) : records;
}

/** True when the current selection is a scaled exercise group (not a pure lift). */
function selectionIsGroup(selection: string): boolean {
  return els.groupToggle.checked && EXERCISE_GROUPS.some((g) => g.name === selection);
}

// ---- "Where this name came from" indicator, shared by every view -------------
// Two kinds of combine carry an origin note:
//   • merged spellings  — e.g. "Pull Ups" was also logged as "Chin Ups"
//   • scaling groups    — e.g. "Squat pattern" combines Squat, Front Squat, …
// exerciseOrigin() returns the source names for either, so the same "(also: …)"
// badge can be shown wherever an exercise name appears.
let mergeVariantsCache: Map<string, string[]> | null = null;

/** canonical display name → the other raw spellings folded into it (from merges). */
function mergeVariantsFor(name: string): string[] {
  if (!mergeVariantsCache) {
    mergeVariantsCache = new Map();
    for (const m of data.merges) mergeVariantsCache.set(m.canonical, m.variants);
  }
  return mergeVariantsCache.get(name) ?? [];
}

/** The source names behind an exercise/group name, or [] if it's a plain lift.
 * For a scaling group it's the member lifts; for a merged name it's the other
 * spellings. */
function exerciseOrigin(name: string): string[] {
  const group = EXERCISE_GROUPS.find((g) => g.name === name);
  if (group) return Object.keys(group.members);
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

/** Render the version-history list (newest first) into the overlay. */
function renderChangelog() {
  els.changelog.innerHTML = CHANGELOG.map(
    (r) =>
      `<div class="cl-row"><span class="cl-ver">${escapeHtml(r.version)}</span>` +
      `<div class="cl-body"><span class="cl-title">${escapeHtml(r.title)}</span>` +
      `<span class="cl-note">${escapeHtml(r.note)}</span></div></div>`,
  ).join("");
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
  const groupNote = selectionIsGroup(exercise) ? " · ⚠ scaled estimate (group)" : "";
  els.lbTitle.textContent = `${exercise}${originBadge(exercise, true)} · ${metricNote} · best per rep band${groupNote}${coliseumFilterNote()}`;
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

function renderLeaderboardChart(
  rows: LbRow[],
  bandData: { label: string; byUser: Map<string, number> }[],
  rel: boolean,
) {
  const canvas = $<HTMLCanvasElement>("lbChart");
  lbChart?.destroy();
  const round = (n: number) => Math.round(n * 100) / 100;
  // Each athlete gets one horizontal track; the rep bands appear as coloured
  // dots along it (one dot per band, placed at that band's theoretical 1RM).
  // ~22 px per athlete keeps the compact dot rows close together.
  const wrap = canvas.parentElement;
  if (wrap) wrap.style.height = `${Math.max(160, rows.length * 22 + 48)}px`;

  // Manual x-axis (weight) range from the From/To inputs; either end can be left
  // blank for auto, and the min may be negative (e.g. a body-weight-adjusted lift
  // that nets out below zero). With no min set we keep the old start-at-zero.
  const xMin = numInput(els.axisMin);
  const xMax = numInput(els.axisMax);
  const xScale: Record<string, unknown> = { grid: { color: "#ececec" }, ticks: { color: "#6b7280" } };
  if (xMin !== null) xScale.min = xMin;
  else xScale.beginAtZero = true;
  if (xMax !== null) xScale.max = xMax;
  lbChart = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: bandData.map((band, i) => ({
        label: `${band.label} reps`,
        // One {x: 1RM, y: athlete} dot per athlete that has a record in this
        // band; bands with no record simply get no dot (no zero placeholder).
        // Cast: a scatter point's y is typed numeric, but on a category axis
        // Chart.js matches the athlete name string at runtime.
        data: rows.flatMap((r) => {
          const v = band.byUser.get(r.username);
          return v === undefined ? [] : [{ x: round(v), y: r.user } as unknown as { x: number; y: number }];
        }),
        backgroundColor: BAND_COLORS[i % BAND_COLORS.length],
        borderColor: BAND_COLORS[i % BAND_COLORS.length],
        pointRadius: 3.5,
        pointHoverRadius: 6,
        showLine: false,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#6b7280", boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${c.parsed.x} ${rel ? "BW" : "kg"}`,
          },
        },
      },
      scales: {
        x: xScale,
        // Athletes as discrete tracks; `offset` keeps dots off the top/bottom edge.
        y: {
          type: "category",
          labels: rows.map((r) => r.user),
          offset: true,
          grid: { display: false },
          ticks: { color: "#1a1a1a", autoSkip: false },
        },
      },
    },
  });
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
// Exercises shown in the Records sub-page, in display order — what a Records row
// click maps back to so it can jump to that exercise's drill-in.
let recordsView: string[] = [];
let selectedExercise: string | null = null; // null = exercise list; set = drill-in detail
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
let exercisesPage = 0;
let workoutsPage = 0;
let workoutsPageSize = 20; // entries per page in the Workouts list (20 or 50)
let recordsPage = 0;
// How the Exercises list is ordered: "sets" = flat, most-trained first;
// "category" = grouped by muscle/movement category (categories ordered by total
// sets), and within each category still by sets.
let exerciseSort: "sets" | "category" | "tier" = "sets";
// Live search filter for the exercises list (substring on the exercise name).
let exerciseSearch = "";
// When true, append exercises this athlete has never logged (greyed) so gaps
// in their training are visible instead of being an empty search result.
let exerciseShowNotTrained = false;
// When false (default), 3rd-tier exercises (cardio / mobility / warm-ups — not
// really strength) are folded out of the list; the toggle reveals them.
let exerciseShowThird = false;
// In category mode, which category headers the user has collapsed (their
// exercise rows are hidden until tapped open again).
const collapsedExCats = new Set<string>();
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
  }
}

/** Re-render every athlete sub-page for the selected athlete (resets paging). */
function renderAthlete() {
  saveLastAthlete(els.athlete.value); // remember across reloads
  syncAthleteChips();
  exercisesPage = 0;
  workoutsPage = 0;
  recordsPage = 0;
  selectedExercise = null;
  athleteWorkouts = workoutsForUser(data.records, els.athlete.value);
  els.summaryOut.textContent = ""; // clear last athlete's AI summary
  initHeatYear();
  renderAthleteProfile();
  renderAthleteStats();
  renderMomentum();
  renderTrainBreakdown();
  renderMuscleMap();
  renderExercisesPage();
  renderWorkoutCalendar();
  renderWorkoutsPage();
  renderRecordsPage();
}

// ---- Athlete Records sub-page: this athlete's PRs across all exercises ----
function renderRecordsPage() {
  const username = els.athlete.value;
  const recs = personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    currentFormula(),
  ).sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm);

  els.recordsTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — personal records ` +
    `<span class="muted">(${recs.length} exercises · est. working weights, kg · short codes · tap to open)</span>`;
  // Codes are made unique across this athlete's whole record set (all pages), so
  // the suffix on a collision doesn't shift as you page through.
  const codes = exerciseCodesFor(recs.map((p) => p.exerciseName));
  const formula = currentFormula();
  // Estimated working weight for N reps off the best 1RM (— if undefined).
  const rm = (oneRm: number, reps: number) => {
    const w = reps === 1 ? oneRm : weightForReps(oneRm, reps, formula);
    return w === null ? "—" : fmt(w);
  };
  const head =
    `<thead><tr><th>Exercise</th><th class="num">1RM</th><th class="num">5RM</th>` +
    `<th class="num">10RM</th><th class="num">15RM</th></tr></thead>`;
  // recordsView maps a clicked row back to its exercise name (for the drill-in jump).
  recordsView = recs.map((p) => p.exerciseName);
  const start = recordsPage * PAGE_SIZE;
  const rows = recs
    .slice(start, start + PAGE_SIZE)
    .map((p, i) => {
      const e1rm = p.bestE1rm.e1rm;
      // Cramped (5 columns), so the exercise is shown as its 3-letter code with
      // the full name in the tooltip and a small subline so it stays readable.
      return (
        `<tr class="rec-row" data-index="${start + i}" title="${escapeHtml(p.exerciseName)}">` +
        `<td><span class="ex-code">${escapeHtml(codes.get(p.exerciseName) ?? exerciseCode(p.exerciseName))}</span> <span class="go-chevron">›</span>` +
        `<div class="ex-fullname muted">${escapeHtml(p.exerciseName)}${originBadge(p.exerciseName)}</div></td>` +
        `<td class="num">${rm(e1rm, 1)}</td><td class="num">${rm(e1rm, 5)}</td>` +
        `<td class="num">${rm(e1rm, 10)}</td><td class="num">${rm(e1rm, 15)}</td></tr>`
      );
    })
    .join("");
  els.recordsTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="5" class="muted">No records for this athlete.</td></tr>`}</tbody>`;
  els.recordsPager.innerHTML = pagerHtml(recordsPage, recs.length);
}

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

/** Compact "what they've been doing" stat chips for the selected athlete. */
function renderAthleteStats() {
  const s = athleteSummary(data.records, els.athlete.value);
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
  const top = exerciseCountsForUser(data.records, username).slice(0, 12);
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
  const counts = exerciseCountsForUser(data.records, els.athlete.value);
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
  for (const r of data.records) {
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
  const counts = exerciseCountsForUser(data.records, username);
  const workouts = workoutsForUser(data.records, username);
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

/** Currently-selected period, in days (0 = all time). */
let exerciseRangeDays = 0;

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
    exercisesPage = 0;
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
    exercisesPage = 0;
    selectedExercise = null;
    renderExercisesPage();
  });
}

/** Wire the exercises search box and the "Show not-trained" toggle. Both reset
 * paging and re-render the list. */
function setupExerciseSearch(): void {
  els.exerciseSearch.addEventListener("input", () => {
    exerciseSearch = els.exerciseSearch.value;
    exercisesPage = 0;
    selectedExercise = null;
    renderExercisesPage();
  });
  els.exerciseNotTrained.addEventListener("change", () => {
    exerciseShowNotTrained = els.exerciseNotTrained.checked;
    exercisesPage = 0;
    selectedExercise = null;
    renderExercisesPage();
  });
  els.exerciseShowThird.addEventListener("change", () => {
    exerciseShowThird = els.exerciseShowThird.checked;
    exercisesPage = 0;
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
function orderedExerciseCounts<T extends ExerciseCount>(counts: T[]): T[] {
  if (exerciseSort === "tier") {
    // Tier mode is just most-trained-first; the tier headers are emitted during
    // render as the set count crosses each threshold.
    return [...counts].sort((a, b) => b.count - a.count);
  }
  if (exerciseSort !== "category") return counts;
  const buckets = new Map<TrainingCategory, T[]>();
  for (const c of counts) {
    const cat = exerciseCategory(c.exerciseName);
    (buckets.get(cat) ?? buckets.set(cat, []).get(cat)!).push(c);
  }
  return [...buckets.values()]
    .sort((a, b) => sumCounts(b) - sumCounts(a))
    .flat();
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
 * Exercises-list "compare on one graph" tool: chips to tick the athlete's
 * exercises (most-trained first), and an overlaid estimated-1RM trend line per
 * ticked exercise. Defaults to the athlete's top two exercises the first time.
 */
function renderCompareSection() {
  const username = els.athlete.value;
  const exercises = exerciseCountsForUser(data.records, username).map((c) => c.exerciseName);

  // Drop any previous picks that this athlete doesn't have; seed with top 2.
  for (const name of [...compareSelected]) if (!exercises.includes(name)) compareSelected.delete(name);
  if (compareSelected.size === 0) for (const name of exercises.slice(0, 2)) compareSelected.add(name);

  els.compareChips.innerHTML = exercises
    .map(
      (name) =>
        `<button type="button" class="compare-chip${compareSelected.has(name) ? " is-active" : ""}" ` +
        `data-ex="${escapeHtml(name)}">${escapeHtml(name)}${originBadge(name)}</button>`,
    )
    .join("");

  renderCompareChart();
}

/** Draw the overlay: one estimated-1RM line per ticked exercise, on a time axis. */
function renderCompareChart() {
  compareChart?.destroy();
  compareChart = null;
  const canvas = document.getElementById("compareChart") as HTMLCanvasElement | null;
  if (!canvas) return;

  const username = els.athlete.value;
  const formula = currentFormula();
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  const picks = [...compareSelected];
  if (picks.length === 0) {
    els.compareNote.textContent = "Tick one or more exercises above to overlay their 1RM trends.";
    return;
  }

  const ts = (d: string) => Date.parse(d);
  const datasets = picks.map((name, i) => {
    const series = exerciseProgressByWeek(recs, username, name, formula).filter((p) => p.bestE1rm !== null);
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length]!;
    return {
      label: name,
      data: series.map((p) => ({ x: ts(p.date), y: Math.round(p.bestE1rm! * 10) / 10 })),
      borderColor: color,
      backgroundColor: color,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 2,
    };
  });

  compareChart = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { title: (items) => tsLabel(Number(items[0]?.parsed.x)), label: (it) => `${it.dataset.label}: ${it.formattedValue} kg` } },
      },
      scales: {
        x: { type: "linear", grid: { color: "#ececec" }, ticks: { callback: (v) => tsLabel(Number(v)), maxRotation: 0, autoSkip: true } },
        y: { title: { display: true, text: "est. 1RM (kg)" }, grid: { color: "#ececec" } },
      },
    },
  });
  els.compareNote.textContent = `Estimated 1RM (${formula}) over time for the ticked exercises.`;
}

// ---- Exercises page: a list that drills into one exercise (like a tab change) ----
function renderExercisesPage() {
  if (selectedExercise !== null) {
    els.exerciseFilter.hidden = true; // period filter is a list-view control only
    els.exerciseCompare.hidden = true; // compare graph is a list-view tool only
    renderExerciseDetail(selectedExercise);
    return;
  }
  els.exerciseFilter.hidden = false;
  els.exerciseCompare.hidden = false;
  renderCompareSection();
  els.exerciseRecord.hidden = true; // top-record card only shows inside a drill-in
  els.exerciseWeekly.hidden = true; // sets-per-week chips are a drill-in detail too
  els.exerciseTargets.hidden = true; // rep-max targets are a drill-in control too
  els.exerciseProgress.hidden = true; // per-exercise graph only in the drill-in
  exerciseChart?.destroy();
  exerciseChart = null;
  const cutoff = exerciseRangeCutoff();
  const scoped = cutoff ? data.records.filter((r) => r.date && r.date >= cutoff) : data.records;
  const username = els.athlete.value;
  // Weekly-sets numbers are absolute (their own time windows), so they read the
  // full log, not the period-scoped subset shown in the list.
  const today = todayIso();

  // The displayed list: the athlete's trained exercises, plus — when "Show
  // not-trained" is on — every other exercise in the whole dataset that this
  // athlete has never logged, marked so the gaps are obvious instead of being
  // an empty search result.
  type ExItem = ExerciseCount & { trained: boolean };
  let items: ExItem[] = exerciseCountsForUser(scoped, username).map((c) => ({ ...c, trained: true }));
  if (exerciseShowNotTrained) {
    const trainedEver = new Set(exerciseCountsForUser(data.records, username).map((c) => c.exerciseName));
    for (const name of distinctExercises(data.records))
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

  // List view: no title. The athlete chips above already name the athlete.
  els.athleteTitle.innerHTML = "";

  const head = `<thead><tr><th>Exercise</th><th class="num">Sets</th></tr></thead>`;
  const start = exercisesPage * PAGE_SIZE;
  // When grouping, emit a category sub-header row whenever the category changes.
  // Track the previous page's last category so a header isn't dropped at a page
  // boundary. Sub-header rows carry no data-index, so click mapping is unaffected.
  const prevItem = start > 0 ? ordered[start - 1] : undefined;
  let prevCat = exerciseSort === "category" && prevItem ? exerciseCategory(prevItem.exerciseName) : null;
  // Tier mode: track the previous row's tier so a header is emitted when it
  // changes (and not dropped at a page boundary).
  let prevTier =
    exerciseSort === "tier" && prevItem ? (frequencyTier(prevItem.count)?.tier ?? null) : null;
  const rowHtml = (it: ExItem, abs: number, rankCls: string) => {
    // Not-trained rows are greyed, non-clickable (no `ex-row` class / data-index).
    if (!it.trained)
      return (
        `<tr class="ex-missing-row"><td>${escapeHtml(it.exerciseName)}` +
        `<div class="ex-wk">not trained</div></td><td class="num">—</td></tr>`
      );
    const wk = weeklySetStats(setsForUserExercise(data.records, username, it.exerciseName), today);
    const sub = `<div class="ex-wk muted">${wk.thisWeek}/${wk.peakPerWeek}</div>`; // this week / peak
    return (
      `<tr class="ex-row" data-index="${abs}"><td class="${rankCls}">${escapeHtml(it.exerciseName)}${originBadge(it.exerciseName)}${sub}</td>` +
      `<td class="num">${it.count.toLocaleString()} <span class="go-chevron">›</span></td></tr>`
    );
  };
  const rows = ordered
    .slice(start, start + PAGE_SIZE)
    .map((it, i) => {
      const abs = start + i;
      if (exerciseSort === "tier") {
        // Emit a tier banner when the frequency tier changes going down the list.
        const ft = frequencyTier(it.count);
        const tier = ft?.tier ?? null;
        let header = "";
        if (tier !== prevTier) {
          header = ft
            ? `<tr class="ex-tier-row"><td colspan="2"><span class="tier-badge tier-${ft.tier}">${ft.tier}</span> ${escapeHtml(ft.label)}</td></tr>`
            : "";
          prevTier = tier;
        }
        return header + rowHtml(it, abs, "");
      }
      if (exerciseSort !== "category") return rowHtml(it, abs, abs === 0 && it.trained ? "rank-1" : "");
      // Category mode: emit a collapsible sub-header when the category changes;
      // a row under a collapsed category is skipped (its abs is unchanged, so the
      // click→exercise mapping still lines up when reopened).
      const cat = exerciseCategory(it.exerciseName);
      let header = "";
      if (cat !== prevCat) {
        const collapsed = collapsedExCats.has(cat);
        header =
          `<tr class="ex-cat-row${collapsed ? " is-collapsed" : ""}" data-cat="${escapeHtml(cat)}">` +
          `<td colspan="2"><span class="caret">▸</span>${escapeHtml(cat)}</td></tr>`;
        prevCat = cat;
      }
      return header + (collapsedExCats.has(cat) ? "" : rowHtml(it, abs, ""));
    })
    .join("");
  const emptyMsg = q
    ? `No exercises match “${escapeHtml(exerciseSearch.trim())}”.`
    : "No exercises trained in this period.";
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="2" class="muted">${emptyMsg}</td></tr>`}</tbody>`;
  els.exercisesPager.innerHTML = pagerHtml(exercisesPage, ordered.length);
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
    `<button type="button" class="back-btn">‹ Exercises</button> ${escapeHtml(exName)}${originBadge(exName)} ${bwPart}`;
  els.exercisesPager.innerHTML = "";
  const username = els.athlete.value;
  const pr = personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    currentFormula(),
  ).find((p) => p.exerciseName === exName);
  // Stats start collapsed on every drill-in (the <details> persists across
  // exercises, so reset it). renderExerciseWeekly always fills the chips, so the
  // dropdown always has content to show.
  els.exerciseStats.open = false;
  renderExerciseRecord(pr);
  renderExerciseWeekly(exName);
  renderExerciseTargets(pr);
  renderExerciseCalc(pr);
  renderExerciseProgressChart(exName);
  const weeks = setsByWeek(setsForUserExercise(data.records, username, exName));
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

/** Sets-per-week chips for the drilled-in exercise: the busiest week ever, this
 * week so far, and the trailing 1-month / 3-month average sets per week. */
function renderExerciseWeekly(exName: string) {
  const stats = weeklySetStats(setsForUserExercise(data.records, els.athlete.value, exName), todayIso());
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

/** Per-exercise progress graph shown inside the drill-in (same shape as the Progress tab). */
function renderExerciseProgressChart(exName: string) {
  exerciseChart?.destroy();
  exerciseChart = null;
  // Use the SAME records the Records card/table use — honour "Exclude dropsets"
  // — so the chart's 1RM matches them (an unfiltered feed counted dropset sets
  // the rest of the app drops, inflating the diagram's 1RM).
  const recs = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  const formula = currentFormula();
  const canvas = $<HTMLCanvasElement>("exerciseProgressChart");

  if (exProgressView === "perset") {
    const sets = recs.filter((r) => r.username === els.athlete.value && r.exerciseName === exName);
    const chart = drawSetRangeChart(canvas, sets, formula);
    if (!chart) {
      els.exerciseProgress.hidden = true;
      els.exerciseProgressNote.textContent = "";
      return;
    }
    els.exerciseProgress.hidden = false;
    exerciseChart = chart;
    els.exerciseProgressNote.textContent =
      "Each bar spans the weight used (bottom) up to that set's estimated 1RM (top), per set over time.";
    return;
  }

  const series = exerciseProgressByWeek(recs, els.athlete.value, exName, formula);
  if (series.length === 0) {
    els.exerciseProgress.hidden = true;
    els.exerciseProgressNote.textContent = "";
    return;
  }
  els.exerciseProgress.hidden = false;
  els.exerciseProgressNote.textContent = progressSummaryNote(series);
  exerciseChart = drawProgressChart(canvas, series);
}

/** Per-set view: one floating bar per set, from the weight used up to that set's
 * estimated (added-weight) 1RM, on a real time x-axis. Null if no usable sets. */
function drawSetRangeChart(canvas: HTMLCanvasElement, sets: readonly SetRecord[], formula: OneRepMaxFormula): Chart | null {
  const ts = (d: string) => Date.parse(d);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const pts = sets
    .map((s) => {
      const e1rm = addedWeight1RM(s, formula);
      if (e1rm === null) return null;
      const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
      return { x: ts(s.date), low: r1(added), high: r1(e1rm), reps: s.reps ?? 0 };
    })
    .filter((p): p is { x: number; low: number; high: number; reps: number } => p !== null);
  if (pts.length === 0) return null;

  const times = pts.map((p) => p.x);
  const pad = 2 * 86_400_000;
  return new Chart(canvas, {
    type: "bar",
    data: {
      datasets: [
        {
          label: "Weight → 1RM",
          // Floating bars: y is a [low, high] tuple at runtime (cast for Chart.js types).
          data: pts.map((p) => ({ x: p.x, y: [p.low, p.high] })) as unknown as { x: number; y: number }[],
          backgroundColor: "#284e86",
          borderSkipped: false,
          maxBarThickness: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const p = pts[items[0]?.dataIndex ?? -1];
              return p ? tsLabel(p.x) : "";
            },
            label: (item) => {
              const p = pts[item.dataIndex];
              return p ? `${fmt(p.low)} kg × ${p.reps} → ${fmt(p.high)} kg 1RM` : "";
            },
          },
        },
        zoom: {
          pan: { enabled: true, mode: "xy" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: Math.min(...times) - pad,
          max: Math.max(...times) + pad,
          grid: { color: "#ececec" },
          ticks: { color: "#6b7280", maxRotation: 0, autoSkip: true, mirror: true, padding: 8, callback: (v) => tsLabel(Number(v)) },
        },
        y: {
          grid: { color: "#ececec" },
          ticks: { color: "#6b7280", mirror: true, padding: 4 },
        },
      },
    },
  });
}

/** Clicks within the Exercises panel: drill into an exercise, expand a week, or go back. */
function onExerciseRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (toggleE1rmFormula(target)) return; // a 1RM cell → show its formula
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level

  // Category mode: tapping a category header collapses/expands its exercises.
  const catRow = target.closest("tr.ex-cat-row") as HTMLTableRowElement | null;
  if (catRow) {
    const cat = catRow.dataset.cat ?? "";
    if (collapsedExCats.has(cat)) collapsedExCats.delete(cat);
    else collapsedExCats.add(cat);
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
  renderExercisesPage();
}

// ---- Workouts page (one row per day or week, 20/page, expandable) ----
function buildWorkoutGroups(): WorkoutGroup[] {
  if (els.workoutView.value === "week") {
    return weeksForUser(data.records, els.athlete.value).map((w) => ({
      label: `Week of ${shortDate(w.weekStart)}`,
      date: w.weekStart,
      totalSets: w.totalSets,
      exercises: w.exercises,
      sets: w.sets,
      rest: false,
    }));
  }
  const days = els.restToggle.checked ? workoutsWithRestDays(athleteWorkouts) : athleteWorkouts;
  return days.map((d) => ({
    label: shortDate(d.date),
    date: d.date,
    totalSets: d.totalSets,
    exercises: d.exercises,
    sets: d.sets,
    rest: d.totalSets === 0,
  }));
}

// ---- Workouts overview: a per-year heatmap of training days ----
let heatYear = 2026; // the year shown in single-year mode (‹ › to change)
let heatScope: "single" | "all" = "single"; // one year (scroll/nav) vs every year
let heatFilter = "all"; // "all" | "cat:<Category>" | "ex:<Exercise>"

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

/** Open the heatmap on the athlete's most recent training year, filter cleared
 * (a previous athlete's exercise filter won't apply to the new one). */
function initHeatYear() {
  const latest = athleteWorkouts.find((d) => d.totalSets > 0)?.date ?? athleteWorkouts[0]?.date;
  const y = Number(latest?.slice(0, 4));
  if (Number.isFinite(y)) heatYear = y;
  heatFilter = "all";
}

/** Intensity bucket (0–4) for a day's set count, GitHub-contribution style. */
function heatLevel(sets: number): number {
  if (sets <= 0) return 0;
  if (sets <= 3) return 1;
  if (sets <= 7) return 2;
  if (sets <= 12) return 3;
  return 4;
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
    const title = `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${year}${sets ? ` — ${sets} sets — tap to jump` : " — rest"}`;
    cells.push(
      `<div class="hm-cell lvl-${heatLevel(sets)}"${sets ? ` data-date="${iso}"` : ""} title="${title}"></div>`,
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
  const exs = exerciseCountsForUser(data.records, els.athlete.value); // most-trained first
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
  const controls = `<div class="heat-controls">${heatScopeToggle()}${heatFilterSelect()}</div>`;
  const legend =
    `<div class="hm-legend muted">Less <span class="hm-cell lvl-0"></span><span class="hm-cell lvl-1"></span>` +
    `<span class="hm-cell lvl-2"></span><span class="hm-cell lvl-3"></span><span class="hm-cell lvl-4"></span> More</div>`;
  const count = (g: { days: number; totalSets: number }) =>
    `<span class="cal-count muted">${g.days} day${g.days === 1 ? "" : "s"} · ${g.totalSets.toLocaleString()} sets</span>`;

  if (heatScope === "all") {
    const blocks = years
      .map((y) => {
        const g = yearGridHtml(y, counts);
        return `<div class="hm-block"><div class="cal-head"><strong>${y}</strong>${count(g)}</div>${g.html}</div>`;
      })
      .join("");
    els.workoutCalendar.innerHTML = controls + blocks + legend;
    return;
  }

  const g = yearGridHtml(heatYear, counts);
  const idx = years.indexOf(heatYear);
  const olderExists = idx < years.length - 1; // a smaller (older) year exists
  const newerExists = idx > 0; // a larger (newer) year exists
  els.workoutCalendar.innerHTML =
    controls +
    `<div class="cal-head">` +
    `<button type="button" class="cal-nav" data-heat="prev" aria-label="Previous year"${olderExists ? "" : " disabled"}>‹</button>` +
    `<strong>${heatYear}</strong>` +
    `<button type="button" class="cal-nav" data-heat="next" aria-label="Next year"${newerExists ? "" : " disabled"}>›</button>` +
    count(g) +
    `</div>` +
    g.html +
    legend;
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
      const did = g.exercises
        .map((e) => `${escapeHtml(e.exerciseName)} <span class="muted">${e.count}</span>`)
        .join("<br>");
      return (
        `<tr class="wo-row" data-index="${abs}"><td>` +
        `<div class="wo-date"><span class="caret">▸</span>${g.label}</div>` +
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
        `<tr class="set-ex-row"><td colspan="3" class="wo-exname">` +
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
  `<thead><tr><th class="num">W</th><th class="num">1RM</th><th class="num">Vol</th></tr></thead>`;

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
  const main =
    `<tr${note ? ' class="set-row has-note"' : ""}>` +
    `<td class="num wcell">${preview}${wr(s.weight, s.reps)}</td>` +
    `<td class="num">${e1rmCell}</td>` +
    `<td class="num">${vol === null ? "—" : fmt(vol)}</td></tr>`;
  const noteRow = note
    ? `<tr class="set-note-row" hidden><td colspan="3" class="muted">${escapeHtml(note)}</td></tr>`
    : "";
  const formulaRow =
    e1rm === null
      ? ""
      : `<tr class="e1rm-formula-row" hidden><td colspan="3" class="muted">${escapeHtml(oneRmFormulaText(computed, formula))}</td></tr>`;
  return main + noteRow + formulaRow;
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
    const header = `<tr class="set-date-row"><td colspan="3" class="wo-date">${shortDate(date)}</td></tr>`;
    return header + daySets.map((s) => setRowsHtml(s, formula)).join("");
  }).join("");
  return `<table class="data-table detail-table">${SETS_HEAD}<tbody>${body}</tbody></table>`;
}

/** Best / latest / trend summary line for an exercise's day-by-day 1RM series.
 * Shown under the per-exercise drill-in chart. */
function progressSummaryNote(series: ExerciseDayPoint[]): string {
  const pts = series.filter((p) => p.bestE1rm !== null);
  let trendNote = "";
  if (pts.length >= 2) {
    const t0 = Date.parse(pts[0]!.date);
    const day = (d: string) => (Date.parse(d) - t0) / 86_400_000;
    const fit = linearFit(pts.map((p) => ({ x: day(p.date), y: p.bestE1rm! })));
    if (fit) {
      const perWeek = fit.slope * 7;
      const arrow = perWeek > 0.05 ? "▲" : perWeek < -0.05 ? "▼" : "▪";
      trendNote = ` · trend ${arrow} ${perWeek >= 0 ? "+" : ""}${perWeek.toFixed(1)} kg/week`;
    }
  }
  const best = pts.reduce((m, p) => (p.bestE1rm! > m.v ? { v: p.bestE1rm!, date: p.date } : m), { v: -Infinity, date: "" });
  const latest = pts[pts.length - 1];
  const summary = best.v > -Infinity
    ? `Best ${fmt(best.v)} kg (${shortDate(best.date)}) · latest ${fmt(latest!.bestE1rm!)} kg${trendNote}`
    : "No estimable 1RM yet";
  return `${summary} · ${series.length} week(s). Bars = sets/week, gold = best 1RM, dashed = trend.`;
}

/**
 * Draw the sets-per-day bars + best-1RM line + fitted trend for one exercise's
 * series onto a canvas, returning the Chart handle (caller owns destroying it).
 * Shared by the Progress sub-page and the per-exercise drill-in graph.
 */
/** Format a millisecond timestamp back to the "Apr 16" short-date label. */
function tsLabel(ts: number): string {
  return shortDate(new Date(ts).toISOString().slice(0, 10));
}

function drawProgressChart(canvas: HTMLCanvasElement, series: ExerciseDayPoint[]): Chart {
  // X is a real time axis (milliseconds), so dates sit at their true spacing —
  // a 2-month gap looks like a gap, not the same step as consecutive sessions.
  const ts = (d: string) => Date.parse(d);
  // Progression: fit a line to the estimated-1RM history to read a kg/week rate.
  const pts = series.filter((p) => p.bestE1rm !== null);
  let trendData: { x: number; y: number }[] = [];
  if (pts.length >= 2) {
    const t0 = ts(pts[0]!.date);
    const day = (d: string) => (ts(d) - t0) / 86_400_000;
    const fit = linearFit(pts.map((p) => ({ x: day(p.date), y: p.bestE1rm! })));
    if (fit) {
      // Two endpoints are enough for a straight line on a numeric axis.
      trendData = [pts[0]!, pts[pts.length - 1]!].map((p) => ({
        x: ts(p.date),
        y: Math.round((fit.intercept + fit.slope * day(p.date)) * 10) / 10,
      }));
    }
  }

  // A little horizontal breathing room so edge bars aren't clipped.
  const times = series.map((p) => ts(p.date));
  const pad = 2 * 86_400_000;
  const xMin = Math.min(...times) - pad;
  const xMax = Math.max(...times) + pad;

  // Keep the sets bars short: cap the sets axis well above the busiest week so the
  // tallest bar only reaches ~45% of the height, leaving the 1RM line room above.
  const maxSets = Math.max(1, ...series.map((p) => p.sets));
  const setsAxisMax = Math.ceil(maxSets * 2.2);

  return new Chart(canvas, {
    type: "bar",
    data: {
      datasets: [
        {
          type: "bar",
          label: "Sets/week",
          data: series.map((p) => ({ x: ts(p.date), y: p.sets })),
          yAxisID: "ySets",
          backgroundColor: "#284e86",
          borderRadius: 3,
          maxBarThickness: 22,
          order: 2,
        },
        {
          type: "line",
          label: "Est. 1RM (kg)",
          data: series.map((p) => ({ x: ts(p.date), y: p.bestE1rm === null ? null : Math.round(p.bestE1rm * 10) / 10 })),
          yAxisID: "y1rm",
          borderColor: "#b8902f",
          backgroundColor: "#b8902f",
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
          order: 1,
        },
        {
          type: "line",
          label: "Trend",
          data: trendData,
          yAxisID: "y1rm",
          borderColor: "#c0603a",
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          spanGaps: true,
          tension: 0,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // intersect:true → the tooltip only shows when you're directly on a bar/
      // point, so tapping empty space dismisses it (it no longer sticks open and
      // obscures the plot).
      interaction: { mode: "nearest", intersect: true },
      // Legend + axis titles are dropped on purpose: the note line below the
      // chart already says what each colour is, so every pixel goes to the plot.
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const x = items[0]?.parsed.x;
              return x == null ? "" : `Week of ${tsLabel(x)}`;
            },
          },
        },
        // Drag / wheel / pinch to roam the plot freely in any direction; the
        // "Center" button (wired in setup) calls resetZoom() to snap back to data.
        zoom: {
          pan: { enabled: true, mode: "xy" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: xMin,
          max: xMax,
          grid: { color: "#ececec" },
          ticks: {
            color: "#6b7280",
            maxRotation: 0,
            autoSkip: true,
            // Sit the date labels inside the plot so they steal no edge space.
            // mirror flips them above the bottom axis; a positive padding lifts
            // them clear of the canvas edge so they're not clipped at the bottom.
            mirror: true,
            padding: 8,
            z: 2,
            callback: (value) => tsLabel(Number(value)),
          },
        },
        ySets: {
          position: "left",
          beginAtZero: true,
          max: setsAxisMax, // headroom so the sets bars stay short
          grid: { color: "#ececec" },
          // mirror: labels hang inside the plot area, off the left axis line.
          ticks: { color: "#6b7280", precision: 0, mirror: true, padding: 4, z: 2 },
        },
        y1rm: {
          position: "right",
          grid: { display: false },
          ticks: { color: "#6b7280", mirror: true, padding: 4, z: 2 },
        },
      },
    },
  });
}

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
            `<tr><td>${escapeHtml(r.name)}${originBadge(r.name)}</td>` +
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
  const exercises = exerciseCountsForUser(data.records, username);
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
 * Test-tab diagram: weight (y) vs reps (x). For the current set's effective 1RM,
 * plot the BAR weight you'd be predicted to lift across 1..15 reps under the
 * selected formula (effective weightForReps minus the bodyweight share), and
 * mark the set you typed. Shows how the formula trades weight for reps.
 */
function renderCalcCurve(
  effLoad: number,
  bodyweightLoad: number,
  curReps: number,
  curAdded: number,
  formula: OneRepMaxFormula,
) {
  const canvas = document.getElementById("calcCurveChart") as HTMLCanvasElement | null;
  if (!canvas) return;
  calcCurveChart?.destroy();
  calcCurveChart = null;

  // 1RM of the effective load at the current reps, then read the curve back out.
  const eff1rm = estimate1RM(effLoad, Math.min(curReps, MAX_1RM_REPS), formula);
  if (eff1rm === null || eff1rm <= 0) {
    els.calcCurveNote.textContent = "Enter a weight and reps to see the weight↔reps curve.";
    return;
  }
  const maxReps = 15;
  const labels: string[] = [];
  const barWeights: (number | null)[] = [];
  for (let reps = 1; reps <= maxReps; reps++) {
    labels.push(String(reps));
    const effW = weightForReps(eff1rm, reps, formula);
    // Show the bar weight (peel the constant bodyweight share back off).
    barWeights.push(effW === null ? null : Math.round((effW - bodyweightLoad) * 10) / 10);
  }
  // Highlight the user's current (reps, bar weight) point.
  const pointData = labels.map((_, i) => (i + 1 === Math.min(curReps, maxReps) ? Math.round(curAdded * 10) / 10 : null));

  calcCurveChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Predicted bar weight",
          data: barWeights,
          borderColor: "#284e86",
          backgroundColor: "rgba(40,78,134,0.08)",
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: "Your set",
          data: pointData,
          borderColor: "#b8902f",
          backgroundColor: "#b8902f",
          pointRadius: 6,
          pointHoverRadius: 7,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { title: (items) => `${items[0]?.label} reps`, label: (it) => `${it.formattedValue} kg` } },
      },
      scales: {
        x: { title: { display: true, text: "reps" }, grid: { color: "#ececec" } },
        y: { title: { display: true, text: "bar weight (kg)" }, grid: { color: "#ececec" } },
      },
    },
  });
  els.calcCurveNote.textContent =
    `Weight you could lift at each rep count for this ${formula} 1RM (gold dot = the set you typed).`;
}

function renderAll() {
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

  // Build the leaderboard exercise picker (see populateExercisePicker). By
  // default it lists PURE exercises only; the grouped/scaled estimates appear
  // only when the owner ticks the toggle.
  populateExercisePicker();
  els.rank.innerHTML =
    `<option value="abs">Total (kg)</option><option value="rel">Per bodyweight</option>`;
  els.rank.value = "abs";

  els.exercise.addEventListener("change", () => {
    renderLeaderboard();
    renderPersonalRecords(); // PRs are scoped to the selected exercise
  });
  els.rank.addEventListener("change", renderLeaderboard);

  // Grouped/scaled estimates toggle: rebuild the picker (adds/removes group
  // names) and re-render. Off by default, so the Colosseum shows pure lifts.
  els.groupToggle.addEventListener("change", () => {
    populateExercisePicker();
    renderLeaderboard();
    renderPersonalRecords();
  });

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

  // Version label + history come from the single CHANGELOG source.
  const verEl = document.querySelector(".version");
  if (verEl) verEl.textContent = CURRENT_VERSION;
  els.changelogVer.textContent = CURRENT_VERSION;
  renderChangelog();

  renderStatus();
  renderHealth();
  renderAll();
  setupTabs();
  setupDataTab();
  renderDataTab();
  setupChecklists();

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
    // Tapping a trained day in the heatmap jumps to it in the list below.
    const cell = target.closest<HTMLElement>(".hm-cell[data-date]");
    if (cell?.dataset.date) jumpToWorkoutDate(cell.dataset.date);
  });
  // Close the heatmap filter menu on any click outside it.
  document.addEventListener("click", (e) => {
    for (const dd of document.querySelectorAll<HTMLElement>(".xdd-heat.open"))
      if (!dd.contains(e.target as Node)) {
        dd.classList.remove("open");
        dd.querySelector<HTMLElement>(".xdd-menu")?.setAttribute("hidden", "");
      }
  });
  // "Center on data" snaps the drill-in chart's pan/zoom back to the data fit.
  els.exerciseProgressCenter.addEventListener("click", () => exerciseChart?.resetZoom());
  // Toggle the drill-in chart between the 1RM trend and the per-set weight→1RM range.
  els.exProgressView.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".cal-mode-btn");
    const view = btn?.dataset.exview;
    if (view !== "trend" && view !== "perset") return;
    exProgressView = view;
    for (const b of els.exProgressView.querySelectorAll<HTMLElement>(".cal-mode-btn"))
      b.classList.toggle("is-active", b.dataset.exview === view);
    if (selectedExercise !== null) renderExerciseProgressChart(selectedExercise);
  });
  els.summariseBtn.addEventListener("click", runSummary);
  els.workoutView.addEventListener("change", () => {
    workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.workoutsPageSize.addEventListener("change", () => {
    workoutsPageSize = Number(els.workoutsPageSize.value) === 50 ? 50 : 20;
    workoutsPage = 0;
    renderWorkoutsPage();
  });
  els.restToggle.addEventListener("change", () => {
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
    }
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

  // A Records row jumps to that exercise's drill-in on the Exercises sub-tab.
  els.recordsTable.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest("tr.rec-row") as HTMLTableRowElement | null;
    if (!row) return;
    const exName = recordsView[Number(row.dataset.index)];
    if (exName === undefined) return;
    showSubtab("exercises");
    selectedExercise = exName;
    renderExercisesPage();
  });

  // Period filter for the exercises list — a custom dropdown (not a native
  // select) so the menu looks the same on every OS.
  setupExerciseRange();
  setupExerciseSort();
  setupExerciseSearch();

  // Compare-graph chips: toggle an exercise in/out of the overlay (delegated).
  els.compareChips.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>(".compare-chip");
    if (!chip?.dataset.ex) return;
    const name = chip.dataset.ex;
    if (compareSelected.has(name)) compareSelected.delete(name);
    else compareSelected.add(name);
    chip.classList.toggle("is-active");
    renderCompareChart();
  });

  // Pagination (delegated on the persistent pager containers).
  els.exercisesPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      exercisesPage = p;
      renderExercisesPage();
    }
  });
  els.workoutsPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      workoutsPage = p;
      renderWorkoutsPage();
    }
  });
  els.bwGroups.addEventListener("change", onBwInputChange);
  for (const input of [els.calcWeight, els.calcReps, els.calcBw, els.calcCoeff])
    input.addEventListener("input", () => {
      els.testPickHint.textContent = ""; // numbers are now custom, not the loaded top set
      renderTest();
    });
  els.recordsPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      recordsPage = p;
      renderRecordsPage();
    }
  });

  setupSubtabs();

  // Replace every native <select> with a custom HTML/CSS dropdown. Done last, so
  // each select already has its options and current value. (#athlete stays hidden
  // behind its chip row; #exerciseRange is already a custom dropdown.)
  enhanceSelect(els.exercise, { wide: true });
  enhanceSelect(els.dataExercise, { wide: true });
  for (const sel of [
    els.formula, els.bwSource, els.rank, els.sexFilter,
    els.workoutView, els.workoutsPageSize, els.testAthlete, els.testExercise,
    els.dataUser,
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

function setupDataTab() {
  populateDataFilters();
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
function setupTabs() {
  // ".guide-btn" is the top-bar Guide button (lives outside the .tabs nav but
  // still switches to the guide panel via its data-tab).
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab, .guide-btn"));
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      for (const t of tabs) t.classList.toggle("is-active", t === tab);
      for (const t of tabs) {
        const panel = document.getElementById(`tab-${t.dataset.tab}`);
        if (panel) panel.hidden = t !== tab;
      }
      // Chart.js needs a resize nudge if it was first drawn while hidden.
      if (target === "leaderboards") lbChart?.resize();
    });
  }
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

/** Switch the active Athlete sub-tab (Workouts / Exercises / Records) and show
 * its panel. Exposed so other views (e.g. a Records row) can jump to a sub-tab. */
function showSubtab(name: string) {
  const subtabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".subtab"));
  for (const s of subtabs) s.classList.toggle("is-active", s.dataset.subtab === name);
  for (const s of subtabs) {
    const panel = document.getElementById(`sub-${s.dataset.subtab}`);
    if (panel) panel.hidden = s.dataset.subtab !== name;
  }
}

/** Sub-navigation inside the Athlete tab (Workouts / Exercises / Records). */
function setupSubtabs() {
  for (const sub of document.querySelectorAll<HTMLButtonElement>(".subtab"))
    sub.addEventListener("click", () => showSubtab(sub.dataset.subtab ?? ""));
}

void init();
