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
  type OneRepMaxFormula,
} from "./metrics";
import type { SetRecord } from "./domain";
import { ATHLETES, EXERCISE_BW_COEFF, DEFAULT_BW_COEFF } from "./profile";
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
  reps: $<HTMLSelectElement>("reps"),
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
  athleteTitle: $("athleteTitle"),
  athleteTable: $<HTMLTableElement>("athleteTable"),
  exerciseRecord: $("exerciseRecord"),
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
  bwTable: $<HTMLTableElement>("bwTable"),
  bwPager: $("bwPager"),
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
  return EXERCISE_BW_COEFF[exerciseName] ?? DEFAULT_BW_COEFF;
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
    if (coeff <= 0) return r;
    const bw = fromTable ? (ATHLETES[r.username]?.weight ?? null) : r.bodyweight;
    // weight = bodyweight-inclusive load (for the 1RM calc); origWeight = what to display.
    return { ...r, weight: effectiveLoad(r.weight, bw, coeff), origWeight: r.weight };
  });
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
  const total = data.issues.length + data.warnings.length;
  els.healthBadge.textContent = total === 0 ? "✓ clear" : `⚠ ${total}`;
  if (total === 0) {
    els.health.innerHTML = `<p class="muted">No issues — every row validated cleanly.</p>`;
    return;
  }
  const lines: string[] = [];
  for (const issue of data.issues.slice(0, 50))
    lines.push(`<div class="health-item warn">Row ${issue.index}: ${escapeHtml(issue.message)}</div>`);
  for (const w of data.warnings.slice(0, 50))
    lines.push(
      `<div class="health-item warn">${escapeHtml(w.record.user)} — ${escapeHtml(w.record.exerciseName)}: ${w.field} = ${w.value} (out of plausible range)</div>`,
    );
  els.health.innerHTML = lines.join("");
}

interface LbRow {
  user: string;
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
  const range = REP_RANGES.find((r) => r.id === els.reps.value);
  const filtered = filterRecords(computedRecords(), {
    excludeDropsets: els.excludeDropsets.checked,
    requireWeightAndReps: true,
    ...(range?.min !== undefined ? { minReps: range.min } : {}),
    ...(range?.max !== undefined ? { maxReps: range.max } : {}),
  });
  const entries = leaderboard(filtered, exercise, formula);

  let rows: LbRow[];
  if (rel) {
    // Bodyweight-lifted ranking: estimated 1RM divided by the athlete's bodyweight.
    rows = entries
      .map((e): LbRow | null => {
        const bw = ATHLETES[e.username]?.weight;
        if (!bw) return null; // can't compute a ratio without a bodyweight on file
        const ratio = e.e1rm / bw;
        return { user: e.user, value: ratio, valueText: `${ratio.toFixed(2)} BW`, best: wr(e.weight, e.reps), date: e.date, e1rm: e.e1rm, ratio };
      })
      .filter((r): r is LbRow => r !== null)
      .sort((a, b) => b.value - a.value);
  } else {
    rows = entries.map((e) => {
      const bw = ATHLETES[e.username]?.weight;
      return {
        user: e.user,
        value: e.e1rm,
        valueText: fmt(e.e1rm),
        best: wr(e.weight, e.reps),
        date: e.date,
        e1rm: e.e1rm,
        ratio: bw ? e.e1rm / bw : null,
      };
    });
  }

  lbRows = rows;
  const repsNote = range && range.id !== "all" ? ` · ${range.label}` : "";
  const metricNote = rel ? "per bodyweight" : `est. 1RM, ${formula}`;
  els.lbTitle.textContent = `${exercise}${repsNote} · ${metricNote}`;
  renderLeaderboardTable(rows, rel);
  renderLeaderboardChart(rows, rel);
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

function renderLeaderboardChart(rows: LbRow[], rel: boolean) {
  const canvas = $<HTMLCanvasElement>("lbChart");
  lbChart?.destroy();
  lbChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.user),
      datasets: [
        {
          label: rel ? "1RM per bodyweight (×BW)" : "Estimated 1RM (kg)",
          data: rows.map((r) => Math.round(r.value * 100) / 100),
          backgroundColor: rows.map((_, i) => (i === 0 ? "#b8902f" : "#284e86")),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#ececec" }, ticks: { color: "#6b7280" } },
        // autoSkip:false so every athlete label shows (not every other one).
        y: { grid: { display: false }, ticks: { color: "#1a1a1a", autoSkip: false } },
      },
    },
  });
}

function renderPersonalRecords() {
  const formula = currentFormula();
  const exercise = els.exercise.value;
  const filtered = filterRecords(computedRecords(), { excludeDropsets: els.excludeDropsets.checked });
  // Personal records for the currently selected exercise only (one row per athlete).
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
let bwPage = 0;

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

// ---- Exercises page: a list that drills into one exercise (like a tab change) ----
function renderExercisesPage() {
  if (selectedExercise !== null) {
    renderExerciseDetail(selectedExercise);
    return;
  }
  els.exerciseRecord.hidden = true; // top-record card only shows inside a drill-in
  const counts = exerciseCountsForUser(data.records, els.athlete.value);
  const totalSets = counts.reduce((sum, c) => sum + c.count, 0);
  els.athleteTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — exercises by sets ` +
    `<span class="muted">(${counts.length} exercises · ${totalSets.toLocaleString()} sets · tap an exercise)</span>`;

  const head = `<thead><tr><th class="rank">#</th><th>Exercise</th><th class="num">Sets</th></tr></thead>`;
  const start = exercisesPage * PAGE_SIZE;
  const rows = counts
    .slice(start, start + PAGE_SIZE)
    .map((c, i) => {
      const abs = start + i;
      return (
        `<tr class="ex-row" data-index="${abs}"><td class="rank ${abs === 0 ? "rank-1" : ""}">${abs + 1}</td>` +
        `<td>${escapeHtml(c.exerciseName)}</td>` +
        `<td class="num">${c.count.toLocaleString()} <span class="go-chevron">›</span></td></tr>`
      );
    })
    .join("");
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="3" class="muted">No exercises for this athlete.</td></tr>`}</tbody>`;
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

  // Inside the drill-in view: a week -> expand to that week's sets (by date).
  const wkRow = target.closest("tr.wk-row") as HTMLTableRowElement | null;
  if (wkRow) {
    if (toggleCollapse(wkRow)) return;
    if (selectedExercise === null) return;
    const week = setsByWeek(setsForUserExercise(data.records, els.athlete.value, selectedExercise)).find(
      (w) => w.weekStart === wkRow.dataset.wk,
    );
    if (!week) return;
    insertDetail(wkRow, 2, setsTableHtml(week.sets, { showDate: true }));
    return;
  }

  // List view: tapping an exercise switches to its detail (no inline dropdown).
  const row = target.closest("tr.ex-row") as HTMLTableRowElement | null;
  if (!row) return;
  const exName = athleteExercises[Number(row.dataset.index)];
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
  insertDetail(row, 3, workoutGroupHtml(grp, idx)); // expand it like a tap would
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

  const head = `<thead><tr><th>${byWeek ? "Week" : "Date"}</th><th>Did</th><th class="num">Sets</th></tr></thead>`;
  const start = workoutsPage * PAGE_SIZE;
  const rows = workoutGroups
    .slice(start, start + PAGE_SIZE)
    .map((g, i) => {
      if (g.rest) {
        return `<tr class="rest-row"><td class="wo-date">${g.label}</td><td>rest</td><td class="num">0</td></tr>`;
      }
      const abs = start + i;
      const did = g.exercises
        .map((e) => `${escapeHtml(e.exerciseName)} <span class="muted">${e.count}</span>`)
        .join("<br>");
      return (
        `<tr class="wo-row" data-index="${abs}"><td class="wo-date"><span class="caret">▸</span>${g.label}</td>` +
        `<td>${did}</td><td class="num">${g.totalSets}</td></tr>`
      );
    })
    .join("");
  els.workoutsTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="3" class="muted">No workouts for this athlete.</td></tr>`}</tbody>`;
  els.workoutsPager.innerHTML = pagerHtml(workoutsPage, workoutGroups.length);
}

function onWorkoutRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement;

  // Second level: an exercise inside an expanded group -> show its sets.
  const exRow = target.closest("tr.wo-ex-row") as HTMLTableRowElement | null;
  if (exRow) {
    if (toggleCollapse(exRow)) return;
    const grp = workoutGroups[Number(exRow.dataset.day)];
    const exName = grp?.exercises[Number(exRow.dataset.exidx)]?.exerciseName;
    if (!grp || exName === undefined) return;
    insertDetail(exRow, 2, setsTableHtml(grp.sets.filter((s) => s.exerciseName === exName), {}));
    return;
  }

  // First level: a day/week -> list the exercises done in it.
  const row = target.closest("tr.wo-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const idx = Number(row.dataset.index);
  const grp = workoutGroups[idx];
  if (!grp) return;
  insertDetail(row, 3, workoutGroupHtml(grp, idx));
}

/** Inner table of the exercises in one group; each row expands to its sets. */
function workoutGroupHtml(group: WorkoutGroup, idx: number): string {
  const head = `<thead><tr><th>Exercise</th><th class="num">Sets</th></tr></thead>`;
  const rows = group.exercises
    .map(
      (e, i) =>
        `<tr class="wo-ex-row" data-day="${idx}" data-exidx="${i}">` +
        `<td><span class="caret">▸</span>${escapeHtml(e.exerciseName)}</td><td class="num">${e.count}</td></tr>`,
    )
    .join("");
  return `<table class="data-table detail-table">${head}<tbody>${rows}</tbody></table>`;
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

/** Inner table of sets with calculated values; optionally an Exercise column. */
function setsTableHtml(sets: readonly SetRecord[], opts: { showExercise?: boolean; showDate?: boolean } = {}): string {
  const formula = currentFormula();
  const dateHead = opts.showDate ? "<th>Date</th>" : "";
  const exHead = opts.showExercise ? "<th>Exercise</th>" : "";
  const head =
    `<thead><tr>${dateHead}${exHead}<th class="num">Weight (kg)</th>` +
    `<th class="num">Est. 1RM (kg)</th><th class="num">Volume</th><th>Notes</th></tr></thead>`;
  const rows = sets
    .map((s) => {
      const e1rm = estimate1RM(s.weight, s.reps, formula);
      const vol = setVolume(s.weight, s.reps);
      const note = [s.dropset ? "dropset" : "", s.notes].filter(Boolean).join(" · ");
      const dateCell = opts.showDate ? `<td class="wo-date">${shortDate(s.date)}</td>` : "";
      const exCell = opts.showExercise ? `<td>${escapeHtml(s.exerciseName)}</td>` : "";
      return (
        `<tr>${dateCell}${exCell}` +
        `<td class="num">${wr(s.weight, s.reps)}</td>` +
        `<td class="num">${e1rm === null ? "—" : fmt(e1rm)}</td>` +
        `<td class="num">${vol === null ? "—" : fmt(vol)}</td>` +
        `<td class="muted">${escapeHtml(note)}</td></tr>`
      );
    })
    .join("");
  return `<table class="data-table detail-table">${head}<tbody>${rows}</tbody></table>`;
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
  els.progressNote.textContent =
    `Bars = sets per day · line = best estimated 1RM (${currentFormula()}) · ${series.length} session(s).`;

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
    .map((name) => ({ name, coeff: coeffFor(name), count: counts.get(name)! }))
    // Bodyweight-heavy first, then most-trained, then alphabetical.
    .sort((a, b) => b.coeff - a.coeff || b.count - a.count || a.name.localeCompare(b.name));

  const withPart = rows.filter((r) => r.coeff > 0).length;
  els.bwTitle.innerHTML =
    `Exercises <span class="muted">(${rows.length} · ${withPart} with a bodyweight part · edit to update all stats)</span>`;

  const head = `<thead><tr><th>Exercise</th><th class="num">BW part</th><th class="num">Sets</th></tr></thead>`;
  const start = bwPage * PAGE_SIZE;
  const body = rows
    .slice(start, start + PAGE_SIZE)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.name)}</td>` +
        `<td class="num"><input class="bw-input" type="number" step="0.05" min="0" max="2" ` +
        `value="${r.coeff}" data-ex="${escapeHtml(r.name)}" aria-label="Bodyweight part for ${escapeHtml(r.name)}" /></td>` +
        `<td class="num">${r.count.toLocaleString()}</td></tr>`,
    )
    .join("");
  els.bwTable.innerHTML = head + `<tbody>${body}</tbody>`;
  els.bwPager.innerHTML = pagerHtml(bwPage, rows.length);
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
  els.calcCoeff.value = String(EXERCISE_BW_COEFF[exName] ?? DEFAULT_BW_COEFF);
  const label = els.testAthlete.selectedOptions[0]?.textContent ?? username;
  els.testPickHint.textContent =
    `Loaded ${label}'s top ${exName}: ${best.weight}kg × ${best.reps} on ${shortDate(best.date)} ` +
    `(${fmt(bestE1rm)}kg est. 1RM). Tweak any number below.`;
  renderTest();
}

// The 1RM formula shown in the Test-tab calculator (its own tab, independent of
// the dashboard-wide setting so people can compare them side by side).
let calcTab: OneRepMaxFormula = "epley";

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

/** Rep-range presets for the leaderboard filter (overlapping by design). */
const REP_RANGES: { id: string; label: string; min?: number; max?: number }[] = [
  { id: "all", label: "All reps" },
  { id: "1-3", label: "1–3 reps", min: 1, max: 3 },
  { id: "3-6", label: "3–6 reps", min: 3, max: 6 },
  { id: "5-10", label: "5–10 reps", min: 5, max: 10 },
  { id: "8-15", label: "8–15 reps", min: 8, max: 15 },
  { id: "15-30", label: "15–30 reps", min: 15, max: 30 },
  { id: "30+", label: "30+ reps", min: 30 },
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

  // Leaderboard exercise / reps / rank as native selects.
  const exercises = distinctExercises(data.records);
  els.exercise.innerHTML = exercises
    .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
    .join("");
  els.exercise.value = exercises[0] ?? "";
  els.reps.innerHTML = REP_RANGES.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join("");
  els.reps.value = "all";
  els.rank.innerHTML =
    `<option value="abs">Total (kg)</option><option value="rel">Per bodyweight</option>`;
  els.rank.value = "abs";

  els.exercise.addEventListener("change", () => {
    renderLeaderboard();
    renderPersonalRecords(); // PRs are scoped to the selected exercise
  });
  els.reps.addEventListener("change", renderLeaderboard);
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
  els.bwPager.addEventListener("click", (e) => {
    const p = pageFromClick(e);
    if (p !== null) {
      bwPage = p;
      renderBwParts();
    }
  });
  els.bwTable.addEventListener("change", onBwInputChange);
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

/** Toggle which tab panel is visible when a tab button is clicked. */
function setupTabs() {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
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
