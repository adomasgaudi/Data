/**
 * App entry point. Thin glue only: load + validate data, read control state,
 * call the pure compute functions, and paint the DOM. No business logic lives
 * here — it's all in metrics.ts / aggregate.ts where it is tested.
 */
import { Chart, registerables } from "chart.js";
import { loadData, type LoadedData } from "./dataSource";
import {
  distinctExercises,
  distinctUsers,
  exerciseCountsForUser,
  setsForUserExercise,
  setsByWeek,
  workoutsForUser,
  workoutsWithRestDays,
  weeksForUser,
  exerciseProgressForUser,
  filterRecords,
  leaderboard,
  personalRecords,
  scaleToGroup,
  athleteSummary,
  type PersonalRecord,
  type WorkoutDay,
  type ExerciseCount,
} from "./aggregate";
import {
  epley1RM,
  brzycki1RM,
  nuzzo1RM,
  benchPctForReps,
  estimate1RM,
  setVolume,
  effectiveLoad,
  linearFit,
  type OneRepMaxFormula,
} from "./metrics";
import type { SetRecord } from "./domain";
import {
  ATHLETES,
  EXERCISE_BW_COEFF,
  defaultBwCoeff,
  realPullupWeight,
  EXERCISE_GROUPS,
  exerciseCategory,
  TRAINING_CATEGORIES,
  type TrainingCategory,
} from "./profile";
import { DEFAULT_FORMULA } from "./config";

Chart.register(...registerables);

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
  athlete: $<HTMLSelectElement>("athlete"),
  athleteProfile: $("athleteProfile"),
  athleteStats: $("athleteStats"),
  trainBreakdown: $("trainBreakdown"),
  athleteTitle: $("athleteTitle"),
  athleteTable: $<HTMLTableElement>("athleteTable"),
  exerciseRecord: $("exerciseRecord"),
  exerciseFilter: $("exerciseFilter"),
  exerciseRange: $<HTMLDetailsElement>("exerciseRange"),
  exercisesPager: $("exercisesPager"),
  workoutsTitle: $("workoutsTitle"),
  workoutCalendar: $("workoutCalendar"),
  workoutsTable: $<HTMLTableElement>("workoutsTable"),
  workoutsPager: $("workoutsPager"),
  workoutView: $<HTMLSelectElement>("workoutView"),
  restToggle: $<HTMLInputElement>("restToggle"),
  restToggleLabel: $("restToggleLabel"),
  progressExercise: $<HTMLSelectElement>("progressExercise"),
  progressNote: $("progressNote"),
  summariseBtn: $<HTMLButtonElement>("summariseBtn"),
  summaryOut: $("summaryOut"),
  bwTitle: $("bwTitle"),
  bwGroups: $("bwGroups"),
  recordsTitle: $("recordsTitle"),
  recordsTable: $<HTMLTableElement>("recordsTable"),
  recordsPager: $("recordsPager"),
  calcWeight: $<HTMLInputElement>("calcWeight"),
  calcReps: $<HTMLInputElement>("calcReps"),
  calcBw: $<HTMLInputElement>("calcBw"),
  calcCoeff: $<HTMLInputElement>("calcCoeff"),
  calcOut: $("calcOut"),
  testAthlete: $<HTMLSelectElement>("testAthlete"),
  testExercise: $<HTMLSelectElement>("testExercise"),
  testPickHint: $("testPickHint"),
  calcTabs: $("calcTabs"),
};

let data: LoadedData;
let lbChart: Chart | null = null;
let progressChart: Chart | null = null;

const PAGE_SIZE = 20;

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

/** Weight with reps as a superscript, e.g. 100⁵. Unit (kg) lives in the header. */
const wr = (weight: number | null, reps: number | null): string =>
  weight === null ? "—" : `${fmt(weight)}${reps === null ? "" : `<sup>${reps}</sup>`}`;

/** "2026-05-02" -> "5-02" (month without leading zero, day kept 2-digit). */
const shortDate = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return m && d ? `${Number(m)}-${d}` : iso;
};

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

/**
 * Records with the bodyweight-lifted load baked into `weight`, so the existing
 * leaderboard / PR / progress maths produce bodyweight-aware estimated 1RMs.
 * The chosen bodyweight source (profile table vs the value logged per set) is a
 * Setting. Exercises with coefficient 0 are returned untouched.
 */
function computedRecords(): SetRecord[] {
  const fromTable = els.bwSource.value !== "perset";
  return data.records.map((r) => {
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
  });
}

/** If the leaderboard selection is a group, fold its members in (scaled); else as-is. */
function selectionRecords(records: SetRecord[], selection: string): SetRecord[] {
  const grp = EXERCISE_GROUPS.find((g) => g.name === selection);
  return grp ? scaleToGroup(records, grp.name, grp.members) : records;
}

function renderStatus() {
  const users = distinctUsers(data.records).length;
  let latest: string | null = null;
  for (const r of data.records) if (r.date && (latest === null || r.date > latest)) latest = r.date;

  let html = `${data.records.length.toLocaleString()} sets · ${users} athletes`;
  if (latest) html += ` · latest ${latest}`;
  if (data.issues.length) html += ` <span class="badge warn">${data.issues.length} parse issues</span>`;
  if (data.warnings.length) html += ` <span class="badge warn">${data.warnings.length} sanity warnings</span>`;
  els.status.innerHTML = html;
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
        return { user: e.user, username: e.username, value: ratio, valueText: `${ratio.toFixed(2)} BW`, best: wr(e.weight, e.reps), date: e.date, e1rm: e.e1rm, ratio };
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
  els.lbTitle.textContent = `${exercise} · ${metricNote} · best per rep band`;
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
    item("Per bodyweight", r.ratio === null ? "—" : `${r.ratio.toFixed(2)} BW`) +
    item("Achieved", shortDate(r.date)) +
    `</div>`;
  insertDetail(row, 3, detail);
}

// One colour per rep band: low reps (1–3) darkest, higher reps lighter.
const BAND_COLORS = ["#1b3a5d", "#284e86", "#3b66a6", "#5681c0", "#7fa1d4", "#a9c0e4"];

function renderLeaderboardChart(
  rows: LbRow[],
  bandData: { label: string; byUser: Map<string, number> }[],
  rel: boolean,
) {
  const canvas = $<HTMLCanvasElement>("lbChart");
  lbChart?.destroy();
  const round = (n: number) => Math.round(n * 100) / 100;
  // Each athlete gets enough height for its group of band-bars (one per band),
  // so bars stay readable and the y-axis names never overlap.
  const wrap = canvas.parentElement;
  if (wrap) wrap.style.height = `${Math.max(220, rows.length * 74 + 56)}px`;
  lbChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.user),
      datasets: bandData.map((band, i) => ({
        label: `${band.label} reps`,
        data: rows.map((r) => round(band.byUser.get(r.username) ?? 0)),
        backgroundColor: BAND_COLORS[i % BAND_COLORS.length],
        borderRadius: 2,
        categoryPercentage: 0.86,
        barPercentage: 0.96,
      })),
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#6b7280", boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${c.parsed.x} ${rel ? "BW" : "kg"}`,
          },
        },
      },
      scales: {
        // Grouped (not stacked) so each band shows its own 1RM, not the sum.
        x: { grid: { color: "#ececec" }, ticks: { color: "#6b7280" } },
        y: { grid: { display: false }, ticks: { color: "#1a1a1a", autoSkip: false } },
      },
    },
  });
}

function renderPersonalRecords() {
  const formula = currentFormula();
  const exercise = els.exercise.value;
  const base = selectionRecords(computedRecords(), exercise);
  const filtered = filterRecords(base, { excludeDropsets: els.excludeDropsets.checked });
  // Personal records for the currently selected exercise/group only (one row per athlete).
  const prs = personalRecords(filtered, formula).filter((p) => p.exerciseName === exercise);
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
let athleteExercises: string[] = [];
// Exercises shown in the (date-filtered) list, in display order — what the
// row click handler maps an index back to (differs from athleteExercises when
// a period filter is active).
let exercisesView: string[] = [];
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
let recordsPage = 0;
// Which exercise categories are expanded in the Exercises tab. null = first paint
// (open them all); a Set afterwards = the user's remembered open/closed choices.
let bwOpenCats: Set<string> | null = null;

/** Re-render every athlete sub-page for the selected athlete (resets paging). */
function renderAthlete() {
  exercisesPage = 0;
  workoutsPage = 0;
  recordsPage = 0;
  selectedExercise = null;
  athleteExercises = exerciseCountsForUser(data.records, els.athlete.value).map((c) => c.exerciseName);
  athleteWorkouts = workoutsForUser(data.records, els.athlete.value);
  els.summaryOut.textContent = ""; // clear last athlete's AI summary
  initCalendarMonth();
  renderAthleteProfile();
  renderAthleteStats();
  renderTrainBreakdown();
  populateProgressExercise();
  renderExercisesPage();
  renderWorkoutCalendar();
  renderWorkoutsPage();
  renderRecordsPage();
  renderProgress();
}

// ---- Athlete Records sub-page: this athlete's PRs across all exercises ----
function renderRecordsPage() {
  const username = els.athlete.value;
  const recs = personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    currentFormula(),
  ).sort((a, b) => b.bestE1rm.e1rm - a.bestE1rm.e1rm);

  els.recordsTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — personal records <span class="muted">(${recs.length} exercises)</span>`;
  const head = `<thead><tr><th>Exercise</th><th class="num">Top weight (kg)</th><th class="num">Best 1RM (kg)</th><th class="num">Date</th></tr></thead>`;
  const start = recordsPage * PAGE_SIZE;
  const rows = recs
    .slice(start, start + PAGE_SIZE)
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.exerciseName)}</td>` +
        `<td class="num">${wr(p.topWeight.weight, p.topWeight.reps)}</td>` +
        `<td class="num">${fmt(p.bestE1rm.e1rm)}</td><td class="num wo-date">${shortDate(p.bestE1rm.date)}</td></tr>`,
    )
    .join("");
  els.recordsTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="4" class="muted">No records for this athlete.</td></tr>`}</tbody>`;
  els.recordsPager.innerHTML = pagerHtml(recordsPage, recs.length);
}

/** Profile line (weight / height / body fat / age) for the selected athlete. */
function renderAthleteProfile() {
  const p = ATHLETES[els.athlete.value];
  if (!p) {
    els.athleteProfile.textContent = "No profile on file";
    return;
  }
  const parts = [`${p.weight} kg`, `${p.height} cm`, `${Math.round(p.bodyFat * 100)}% body fat`];
  if (p.age != null) parts.push(`age ${p.age}`);
  els.athleteProfile.textContent = parts.join("  ·  ");
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
      ? `Body: ${p.weight} kg, ${p.height} cm, ${Math.round(p.bodyFat * 100)}% body fat${p.age != null ? `, age ${p.age}` : ""}`
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

/** Prev / range / Next controls for a paginated list. */
function pagerHtml(page: number, total: number): string {
  if (total <= PAGE_SIZE) return "";
  const pages = Math.ceil(total / PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
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

// ---- Exercises page: a list that drills into one exercise (like a tab change) ----
function renderExercisesPage() {
  if (selectedExercise !== null) {
    els.exerciseFilter.hidden = true; // period filter is a list-view control only
    renderExerciseDetail(selectedExercise);
    return;
  }
  els.exerciseFilter.hidden = false;
  els.exerciseRecord.hidden = true; // top-record card only shows inside a drill-in
  const cutoff = exerciseRangeCutoff();
  const scoped = cutoff ? data.records.filter((r) => r.date && r.date >= cutoff) : data.records;
  const counts = exerciseCountsForUser(scoped, els.athlete.value);
  exercisesView = counts.map((c) => c.exerciseName);
  const totalSets = counts.reduce((sum, c) => sum + c.count, 0);
  const periodNote = cutoff ? ` ${exerciseRangeLabel().toLowerCase()}` : "";
  els.athleteTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — exercises by sets ` +
    `<span class="muted">(${counts.length} exercises · ${totalSets.toLocaleString()} sets${periodNote} · tap an exercise)</span>`;

  const head = `<thead><tr><th>Exercise</th><th class="num">Sets</th></tr></thead>`;
  const start = exercisesPage * PAGE_SIZE;
  const rows = counts
    .slice(start, start + PAGE_SIZE)
    .map((c, i) => {
      const abs = start + i;
      return (
        `<tr class="ex-row" data-index="${abs}"><td class="${abs === 0 ? "rank-1" : ""}">${escapeHtml(c.exerciseName)}</td>` +
        `<td class="num">${c.count.toLocaleString()} <span class="go-chevron">›</span></td></tr>`
      );
    })
    .join("");
  els.athleteTable.innerHTML =
    head +
    `<tbody>${rows || `<tr><td colspan="2" class="muted">No exercises trained in this period.</td></tr>`}</tbody>`;
  els.exercisesPager.innerHTML = pagerHtml(exercisesPage, counts.length);
}

/** Drill-in view for one exercise: a back link + its sets grouped by week. */
function renderExerciseDetail(exName: string) {
  els.athleteTitle.innerHTML =
    `<button type="button" class="back-btn">‹ Exercises</button> ${escapeHtml(exName)}`;
  els.exercisesPager.innerHTML = "";
  renderExerciseRecord(exName);
  const weeks = setsByWeek(setsForUserExercise(data.records, els.athlete.value, exName));
  const head = `<thead><tr><th>Week</th><th class="num">Sets</th></tr></thead>`;
  const rows = weeks
    .map(
      (w) =>
        `<tr class="wk-row" data-wk="${w.weekStart}">` +
        `<td><span class="caret">▸</span>Week of ${shortDate(w.weekStart)}</td><td class="num">${w.sets.length}</td></tr>`,
    )
    .join("");
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="2" class="muted">No sets.</td></tr>`}</tbody>`;
}

/** Top-record card shown above the weeks list when an exercise is drilled into. */
function renderExerciseRecord(exName: string) {
  const username = els.athlete.value;
  const pr = personalRecords(
    filterRecords(computedRecords(), { usernames: [username], excludeDropsets: els.excludeDropsets.checked }),
    currentFormula(),
  ).find((p) => p.exerciseName === exName);
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

/** Clicks within the Exercises panel: drill into an exercise, expand a week, or go back. */
function onExerciseRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level

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

// ---- Workouts calendar: a month grid with training days marked ----
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
let calYear = 2026;
let calMonth = 0; // 0-based

/** Map of this athlete's training dates (ISO) → sets that day. */
function trainingDays(): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of athleteWorkouts) if (d.totalSets > 0) m.set(d.date, d.totalSets);
  return m;
}

/** Open the calendar on the athlete's most recent training month. */
function initCalendarMonth() {
  const latest = athleteWorkouts.find((d) => d.totalSets > 0)?.date ?? athleteWorkouts[0]?.date;
  const parts = latest?.split("-");
  if (parts && parts.length >= 2) {
    calYear = Number(parts[0]);
    calMonth = Number(parts[1]) - 1;
  }
}

function shiftCalendar(delta: number) {
  calMonth += delta;
  if (calMonth < 0) {
    calMonth = 11;
    calYear -= 1;
  } else if (calMonth > 11) {
    calMonth = 0;
    calYear += 1;
  }
  renderWorkoutCalendar();
}

function renderWorkoutCalendar() {
  const trained = trainingDays();
  const startDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((d) => `<div class="cal-dow">${d}</div>`)
    .join("");

  const cells: string[] = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="cal-cell empty"></div>`);
  let monthCount = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const sets = trained.get(iso);
    if (sets) monthCount++;
    cells.push(
      `<div class="cal-cell${sets ? " trained" : ""}"${sets ? ` data-date="${iso}" title="${sets} sets — tap to jump"` : ""}>` +
        `<span class="cal-day">${day}</span>${sets ? `<span class="cal-sets">${sets}</span>` : ""}</div>`,
    );
  }

  els.workoutCalendar.innerHTML =
    `<div class="cal-head">` +
    `<button type="button" class="cal-nav" data-cal="prev" aria-label="Previous month">‹</button>` +
    `<strong>${MONTH_NAMES[calMonth]} ${calYear}</strong>` +
    `<button type="button" class="cal-nav" data-cal="next" aria-label="Next month">›</button>` +
    `<span class="cal-count muted">${monthCount} training day${monthCount === 1 ? "" : "s"}</span>` +
    `</div>` +
    `<div class="cal-grid">${dow}${cells.join("")}</div>`;
}

/** Tapping a training day in the calendar: jump to that day in the list and open it. */
function jumpToWorkoutDate(iso: string) {
  if (els.workoutView.value !== "day") els.workoutView.value = "day"; // calendar is per-day
  const idx = buildWorkoutGroups().findIndex((g) => g.date === iso && !g.rest);
  if (idx < 0) return;
  workoutsPage = Math.floor(idx / PAGE_SIZE);
  renderWorkoutsPage();
  const row = els.workoutsTable.querySelector<HTMLTableRowElement>(`tr.wo-row[data-index="${idx}"]`);
  const grp = workoutGroups[idx];
  if (!row || !grp) return;
  insertDetail(row, 2, workoutGroupHtml(grp, idx)); // expand it like a tap would
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
  const start = workoutsPage * PAGE_SIZE;
  const rows = workoutGroups
    .slice(start, start + PAGE_SIZE)
    .map((g, i) => {
      if (g.rest) {
        return `<tr class="rest-row"><td><span class="wo-date">${g.label}</span> rest</td><td class="num">0</td></tr>`;
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
  els.workoutsPager.innerHTML = pagerHtml(workoutsPage, workoutGroups.length);
}

function onWorkoutRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (toggleSetNote(target)) return; // a set's note toggle, deepest level

  // Second level: an exercise inside an expanded group -> show its sets.
  const exRow = target.closest("tr.wo-ex-row") as HTMLTableRowElement | null;
  if (exRow) {
    if (toggleCollapse(exRow)) return;
    const grp = workoutGroups[Number(exRow.dataset.day)];
    const exName = grp?.exercises[Number(exRow.dataset.exidx)]?.exerciseName;
    if (!grp || exName === undefined) return;
    insertDetail(exRow, 2, setsTableHtml(grp.sets.filter((s) => s.exerciseName === exName)));
    return;
  }

  // First level: a day/week -> list the exercises done in it.
  const row = target.closest("tr.wo-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const idx = Number(row.dataset.index);
  const grp = workoutGroups[idx];
  if (!grp) return;
  insertDetail(row, 2, workoutGroupHtml(grp, idx));
}

/** Inner table of the exercises in one group; each row expands to its sets.
 * No header row — the columns (exercise, set count) are self-evident here. */
function workoutGroupHtml(group: WorkoutGroup, idx: number): string {
  const rows = group.exercises
    .map(
      (e, i) =>
        `<tr class="wo-ex-row" data-day="${idx}" data-exidx="${i}">` +
        `<td><span class="caret">▸</span>${escapeHtml(e.exerciseName)}</td><td class="num">${e.count}</td></tr>`,
    )
    .join("");
  return `<table class="data-table detail-table"><tbody>${rows}</tbody></table>`;
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
 * One set as table rows: the W/1RM/Vol line. When the set has a note (or is a
 * dropset) a short truncated preview of it sits on the left of the weight cell
 * with a caret; clicking the row expands a sub-row with the full note. The
 * preview lets you tell a throwaway remark from a real exercise change at a
 * glance. Notes belong to their own set, so they are never merged across sets.
 */
function setRowsHtml(s: SetRecord, formula: OneRepMaxFormula): string {
  const e1rm = estimate1RM(s.weight, s.reps, formula);
  const vol = setVolume(s.weight, s.reps);
  const note = [s.dropset ? "dropset" : "", s.notes].filter(Boolean).join(" · ");
  let preview = "";
  if (note) {
    const short = note.length > NOTE_PREVIEW_LEN ? `${note.slice(0, NOTE_PREVIEW_LEN)}…` : note;
    preview =
      `<button type="button" class="set-note" title="${escapeHtml(note)}">` +
      `${escapeHtml(short)}<span class="set-note-cue">›</span></button>`;
  }
  const main =
    `<tr${note ? ' class="set-row has-note"' : ""}>` +
    `<td class="num wcell">${preview}${wr(s.weight, s.reps)}</td>` +
    `<td class="num">${e1rm === null ? "—" : fmt(e1rm)}</td>` +
    `<td class="num">${vol === null ? "—" : fmt(vol)}</td></tr>`;
  const noteRow = note
    ? `<tr class="set-note-row" hidden><td colspan="3" class="muted">${escapeHtml(note)}</td></tr>`
    : "";
  return main + noteRow;
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

/** Inner table of sets with calculated values (all from the same day). */
function setsTableHtml(sets: readonly SetRecord[]): string {
  const formula = currentFormula();
  const rows = sets.map((s) => setRowsHtml(s, formula)).join("");
  return `<table class="data-table detail-table">${SETS_HEAD}<tbody>${rows}</tbody></table>`;
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

// ---- Progress page (time graph: sets per day + best estimated 1RM) ----
function populateProgressExercise() {
  const prev = els.progressExercise.value;
  els.progressExercise.innerHTML = athleteExercises
    .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
    .join("");
  // Keep the previous pick if this athlete also has it; else default to first.
  if (athleteExercises.includes(prev)) els.progressExercise.value = prev;
}

function renderProgress() {
  const exercise = els.progressExercise.value;
  progressChart?.destroy();
  progressChart = null;
  if (!exercise) {
    els.progressNote.textContent = "No exercises to chart for this athlete.";
    return;
  }
  const series = exerciseProgressForUser(computedRecords(), els.athlete.value, exercise, currentFormula());

  // Progression: fit a line to the estimated-1RM history to read a kg/week rate.
  const pts = series.filter((p) => p.bestE1rm !== null);
  let trendData: (number | null)[] = series.map(() => null);
  let trendNote = "";
  if (pts.length >= 2) {
    const t0 = Date.parse(pts[0]!.date);
    const day = (d: string) => (Date.parse(d) - t0) / 86_400_000;
    const fit = linearFit(pts.map((p) => ({ x: day(p.date), y: p.bestE1rm! })));
    if (fit) {
      const perWeek = fit.slope * 7;
      const arrow = perWeek > 0.05 ? "▲" : perWeek < -0.05 ? "▼" : "▪";
      trendNote = ` · trend ${arrow} ${perWeek >= 0 ? "+" : ""}${perWeek.toFixed(1)} kg/week`;
      trendData = series.map((p) => Math.round((fit.intercept + fit.slope * day(p.date)) * 10) / 10);
    }
  }
  const best = pts.reduce((m, p) => (p.bestE1rm! > m.v ? { v: p.bestE1rm!, date: p.date } : m), { v: -Infinity, date: "" });
  const latest = pts[pts.length - 1];
  const summary = best.v > -Infinity
    ? `Best ${fmt(best.v)} kg (${shortDate(best.date)}) · latest ${fmt(latest!.bestE1rm!)} kg${trendNote}`
    : "No estimable 1RM yet";
  els.progressNote.textContent = `${summary} · ${series.length} session(s). Bars = sets/day, gold = best 1RM, dashed = trend.`;

  const canvas = $<HTMLCanvasElement>("progressChart");
  progressChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: series.map((p) => shortDate(p.date)),
      datasets: [
        {
          type: "bar",
          label: "Sets",
          data: series.map((p) => p.sets),
          yAxisID: "ySets",
          backgroundColor: "#284e86",
          borderRadius: 3,
          order: 2,
        },
        {
          type: "line",
          label: "Est. 1RM (kg)",
          data: series.map((p) => (p.bestE1rm === null ? null : Math.round(p.bestE1rm * 10) / 10)),
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
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: true, labels: { color: "#1a1a1a" } } },
      scales: {
        x: { grid: { color: "#ececec" }, ticks: { color: "#6b7280", maxRotation: 0, autoSkip: true } },
        ySets: {
          position: "left",
          beginAtZero: true,
          title: { display: true, text: "Sets", color: "#6b7280" },
          grid: { color: "#ececec" },
          ticks: { color: "#6b7280", precision: 0 },
        },
        y1rm: {
          position: "right",
          title: { display: true, text: "Est. 1RM (kg)", color: "#6b7280" },
          grid: { display: false },
          ticks: { color: "#6b7280" },
        },
      },
    },
  });
}

// ---- BW parts tab: every exercise and its bodyweight coefficient ----
function renderBwParts() {
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
            `<tr><td>${escapeHtml(r.name)}</td>` +
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
  const sets = setsForUserExercise(data.records, username, exName);
  // The "top record": the set with the best estimated 1RM (matches the athlete page).
  let best: SetRecord | null = null;
  let bestE1rm = -Infinity;
  for (const s of sets) {
    const e = estimate1RM(s.weight, s.reps, formula);
    if (e !== null && e > bestE1rm) {
      bestE1rm = e;
      best = s;
    }
  }
  if (!best || best.weight === null || best.reps === null) {
    els.testPickHint.textContent = "No logged sets with weight & reps for this exercise.";
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
    rows.push(line("Effective 1RM", eq(formulaText, kg(effective1RM))));
    rows.push(line("Added 1RM", eq(`${effective1RM === null ? "—" : f2(effective1RM)} − ${f2(bodyweightLoad)}`, kg(addedWeight1RM))));
  } else {
    rows.push(line("Est. 1RM", eq(formulaText, kg(addedWeight1RM))));
  }
  if (calcTab === "nuzzo") {
    rows.push(line("Bench %1RM", `${reps} reps ≈ ${res(`${f2(benchPctForReps(reps))}%`)}`));
  }
  rows.push(line("Volume", eq(`${f2(weight)} × ${reps}`, vol === null ? null : f2(vol))));
  rows.push(
    line(
      "Per BW",
      addedWeight1RM === null || bw <= 0
        ? "needs 1RM & BW"
        : eq(`${f2(addedWeight1RM)} ÷ ${f2(bw)}`, perBw === null ? null : `${perBw.toFixed(2)} BW`),
    ),
  );
  els.calcOut.innerHTML = rows.join("");
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

  // Leaderboard exercise picker: groups (that have data) first, then any
  // ungrouped exercises. Selecting a group folds in its members (scaled).
  const exercises = distinctExercises(data.records);
  const memberNames = new Set<string>();
  for (const g of EXERCISE_GROUPS) for (const m of Object.keys(g.members)) memberNames.add(m);
  const groupsWithData = EXERCISE_GROUPS.filter((g) => exercises.some((e) => g.members[e] !== undefined)).map((g) => g.name);
  const ungrouped = exercises.filter((e) => !memberNames.has(e));
  const exerciseOptions = [...groupsWithData, ...ungrouped];
  els.exercise.innerHTML = exerciseOptions
    .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
    .join("");
  els.exercise.value = exerciseOptions[0] ?? "";
  els.rank.innerHTML =
    `<option value="abs">Total (kg)</option><option value="rel">Per bodyweight</option>`;
  els.rank.value = "abs";

  els.exercise.addEventListener("change", () => {
    renderLeaderboard();
    renderPersonalRecords(); // PRs are scoped to the selected exercise
  });
  els.rank.addEventListener("change", renderLeaderboard);

  els.formula.value = DEFAULT_FORMULA;

  // Populate athlete dropdown (alphabetical by display name).
  const users = distinctUsers(data.records);
  els.athlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");
  // Default to Marija for now, when present.
  const marija = users.find((u) => u.username.toLowerCase().includes("marija") || u.user.toLowerCase().includes("marija"));
  if (marija) els.athlete.value = marija.username;

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

  renderStatus();
  renderHealth();
  renderAll();
  setupTabs();
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

  // Data health lives on its own overlay page, opened from Settings.
  els.healthBtn.addEventListener("click", () => {
    setSettingsOpen(false);
    els.healthPage.hidden = false;
  });
  els.healthClose.addEventListener("click", () => {
    els.healthPage.hidden = true;
  });

  els.formula.addEventListener("change", renderAll);
  els.bwSource.addEventListener("change", renderAll);
  els.excludeDropsets.addEventListener("change", renderAll);
  els.athlete.addEventListener("change", renderAthlete);
  els.workoutCalendar.addEventListener("click", (e) => {
    const nav = (e.target as HTMLElement).closest<HTMLElement>(".cal-nav");
    if (nav?.dataset.cal === "prev") return shiftCalendar(-1);
    if (nav?.dataset.cal === "next") return shiftCalendar(1);
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".cal-cell.trained");
    if (cell?.dataset.date) jumpToWorkoutDate(cell.dataset.date);
  });
  els.progressExercise.addEventListener("change", renderProgress);
  els.summariseBtn.addEventListener("click", runSummary);
  els.workoutView.addEventListener("change", () => {
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

  // Period filter for the exercises list — a custom dropdown (not a native
  // select) so the menu looks the same on every OS.
  setupExerciseRange();

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
}

/** Read the target page index from a pager button click, or null. */
function pageFromClick(e: MouseEvent): number | null {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button.page-btn");
  if (!btn || btn.disabled) return null;
  return Number(btn.dataset.page);
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
      if (target === "athlete") progressChart?.resize();
    });
  }
}

/** Sub-navigation inside the Athlete tab (Workouts / Exercises / Progress). */
function setupSubtabs() {
  const subtabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".subtab"));
  for (const sub of subtabs) {
    sub.addEventListener("click", () => {
      const target = sub.dataset.subtab;
      for (const s of subtabs) s.classList.toggle("is-active", s === sub);
      for (const s of subtabs) {
        const panel = document.getElementById(`sub-${s.dataset.subtab}`);
        if (panel) panel.hidden = s !== sub;
      }
      if (target === "progress") progressChart?.resize();
    });
  }
}

void init();
