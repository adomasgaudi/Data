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
  workoutsForUser,
  exerciseProgressForUser,
  filterRecords,
  leaderboard,
  personalRecords,
  type LeaderboardEntry,
  type PersonalRecord,
  type WorkoutDay,
} from "./aggregate";
import { estimate1RM, setVolume, type OneRepMaxFormula } from "./metrics";
import type { SetRecord } from "./domain";
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
  exerciseBtn: $<HTMLButtonElement>("exerciseBtn"),
  exerciseMenu: $<HTMLUListElement>("exerciseMenu"),
  exerciseLabel: $("exerciseLabel"),
  repsBtn: $<HTMLButtonElement>("repsBtn"),
  repsMenu: $<HTMLUListElement>("repsMenu"),
  repsLabel: $("repsLabel"),
  formula: $<HTMLSelectElement>("formula"),
  excludeDropsets: $<HTMLInputElement>("excludeDropsets"),
  prSearch: $<HTMLInputElement>("prSearch"),
  lbTitle: $("lbTitle"),
  lbTable: $<HTMLTableElement>("lbTable"),
  prTable: $<HTMLTableElement>("prTable"),
  prCount: $("prCount"),
  healthPanel: $("healthPanel"),
  health: $("health"),
  athlete: $<HTMLSelectElement>("athlete"),
  athleteTitle: $("athleteTitle"),
  athleteTable: $<HTMLTableElement>("athleteTable"),
  exercisesPager: $("exercisesPager"),
  workoutsTitle: $("workoutsTitle"),
  workoutsTable: $<HTMLTableElement>("workoutsTable"),
  workoutsPager: $("workoutsPager"),
  progressExercise: $<HTMLSelectElement>("progressExercise"),
  progressNote: $("progressNote"),
};

let data: LoadedData;
let lbChart: Chart | null = null;
let progressChart: Chart | null = null;

const PAGE_SIZE = 20;

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

function currentFormula(): OneRepMaxFormula {
  return els.formula.value === "brzycki" ? "brzycki" : "epley";
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
  if (!data.issues.length && !data.warnings.length) {
    els.healthPanel.hidden = true;
    return;
  }
  els.healthPanel.hidden = false;
  const lines: string[] = [];
  for (const issue of data.issues.slice(0, 50))
    lines.push(`<div class="health-item warn">Row ${issue.index}: ${escapeHtml(issue.message)}</div>`);
  for (const w of data.warnings.slice(0, 50))
    lines.push(
      `<div class="health-item warn">${escapeHtml(w.record.user)} — ${escapeHtml(w.record.exerciseName)}: ${w.field} = ${w.value} (out of plausible range)</div>`,
    );
  els.health.innerHTML = lines.join("");
}

function renderLeaderboard() {
  const exercise = exerciseDropdown?.value() ?? "";
  const formula = currentFormula();
  const range = REP_RANGES.find((r) => r.id === (repsDropdown?.value() ?? "all"));
  const filtered = filterRecords(data.records, {
    excludeDropsets: els.excludeDropsets.checked,
    requireWeightAndReps: true,
    ...(range?.min !== undefined ? { minReps: range.min } : {}),
    ...(range?.max !== undefined ? { maxReps: range.max } : {}),
  });
  const entries = leaderboard(filtered, exercise, formula);

  const repsNote = range && range.id !== "all" ? ` · ${range.label}` : "";
  els.lbTitle.textContent = `Leaderboard — ${exercise}${repsNote} (est. 1RM, ${formula})`;
  renderLeaderboardTable(entries);
  renderLeaderboardChart(entries);
}

function renderLeaderboardTable(entries: LeaderboardEntry[]) {
  const head = `<thead><tr><th>Athlete</th><th class="num">Est. 1RM</th><th class="num">Best set</th><th class="num">Date</th></tr></thead>`;
  const rows = entries
    .map(
      (e, i) =>
        `<tr><td class="${i === 0 ? "rank-1" : ""}">${escapeHtml(e.user)}</td>` +
        `<td class="num">${fmt(e.e1rm)} kg</td><td class="num">${fmt(e.weight)}×${e.reps}</td><td class="num">${e.date}</td></tr>`,
    )
    .join("");
  els.lbTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="4" class="muted">No data for this exercise.</td></tr>`}</tbody>`;
}

function renderLeaderboardChart(entries: LeaderboardEntry[]) {
  const canvas = $<HTMLCanvasElement>("lbChart");
  lbChart?.destroy();
  lbChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: entries.map((e) => e.user),
      datasets: [
        {
          label: "Estimated 1RM (kg)",
          data: entries.map((e) => Math.round(e.e1rm * 10) / 10),
          backgroundColor: entries.map((_, i) => (i === 0 ? "#b8902f" : "#284e86")),
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
        y: { grid: { display: false }, ticks: { color: "#1a1a1a" } },
      },
    },
  });
}

function renderPersonalRecords() {
  const formula = currentFormula();
  const filtered = filterRecords(data.records, { excludeDropsets: els.excludeDropsets.checked });
  let prs = personalRecords(filtered, formula);

  const q = els.prSearch.value.trim().toLowerCase();
  if (q) prs = prs.filter((p) => p.user.toLowerCase().includes(q) || p.exerciseName.toLowerCase().includes(q));

  els.prCount.textContent = `(${prs.length})`;
  const head = `<thead><tr><th>Athlete</th><th>Exercise</th><th class="num">Top weight</th><th class="num">Best 1RM</th><th class="num">Date</th></tr></thead>`;
  const rows = prs
    .map(
      (p: PersonalRecord) =>
        `<tr><td>${escapeHtml(p.user)}</td><td>${escapeHtml(p.exerciseName)}</td>` +
        `<td class="num">${fmt(p.topWeight.weight)}×${p.topWeight.reps}</td>` +
        `<td class="num">${fmt(p.bestE1rm.e1rm)} kg</td><td class="num">${p.bestE1rm.date}</td></tr>`,
    )
    .join("");
  els.prTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="5" class="muted">No matches.</td></tr>`}</tbody>`;
}

// State for the currently shown athlete. The displayed-order arrays let the
// (delegated) click handlers map a clicked row back to its data.
let athleteExercises: string[] = [];
let athleteWorkouts: WorkoutDay[] = [];
let exercisesPage = 0;
let workoutsPage = 0;

/** Re-render every athlete sub-page for the selected athlete (resets paging). */
function renderAthlete() {
  exercisesPage = 0;
  workoutsPage = 0;
  athleteExercises = exerciseCountsForUser(data.records, els.athlete.value).map((c) => c.exerciseName);
  athleteWorkouts = workoutsForUser(data.records, els.athlete.value);
  populateProgressExercise();
  renderExercisesPage();
  renderWorkoutsPage();
  renderProgress();
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

// ---- Exercises page (all exercises, 20/page, expandable) ----
function renderExercisesPage() {
  const counts = exerciseCountsForUser(data.records, els.athlete.value);
  const totalSets = counts.reduce((sum, c) => sum + c.count, 0);
  els.athleteTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — exercises by sets ` +
    `<span class="muted">(${counts.length} exercises · ${totalSets.toLocaleString()} sets · tap a row for all sets)</span>`;

  const head = `<thead><tr><th class="rank">#</th><th>Exercise</th><th class="num">Sets</th></tr></thead>`;
  const start = exercisesPage * PAGE_SIZE;
  const rows = counts
    .slice(start, start + PAGE_SIZE)
    .map((c, i) => {
      const abs = start + i;
      return (
        `<tr class="ex-row" data-index="${abs}"><td class="rank ${abs === 0 ? "rank-1" : ""}">${abs + 1}</td>` +
        `<td><span class="caret">▸</span>${escapeHtml(c.exerciseName)}</td>` +
        `<td class="num">${c.count.toLocaleString()}</td></tr>`
      );
    })
    .join("");
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="3" class="muted">No exercises for this athlete.</td></tr>`}</tbody>`;
  els.exercisesPager.innerHTML = pagerHtml(exercisesPage, counts.length);
}

/** Expand/collapse the set-by-set detail under a clicked exercise row. */
function onExerciseRowClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest("tr.ex-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const exerciseName = athleteExercises[Number(row.dataset.index)];
  if (exerciseName === undefined) return;
  const sets = setsForUserExercise(data.records, els.athlete.value, exerciseName);
  insertDetail(row, 3, setsTableHtml(sets, false));
}

// ---- Workouts page (one row per training day, 20/page, expandable) ----
function renderWorkoutsPage() {
  els.workoutsTitle.innerHTML =
    `${escapeHtml(athleteLabel())} — workouts ` +
    `<span class="muted">(${athleteWorkouts.length} sessions · tap a day for all sets)</span>`;

  const head = `<thead><tr><th>Date</th><th>Did</th><th class="num">Sets</th></tr></thead>`;
  const start = workoutsPage * PAGE_SIZE;
  const rows = athleteWorkouts
    .slice(start, start + PAGE_SIZE)
    .map((d, i) => {
      const abs = start + i;
      const did = d.exercises.map((e) => `${escapeHtml(e.exerciseName)} ×${e.count}`).join(", ");
      return (
        `<tr class="wo-row" data-index="${abs}"><td><span class="caret">▸</span>${d.date}</td>` +
        `<td>${did}</td><td class="num">${d.totalSets}</td></tr>`
      );
    })
    .join("");
  els.workoutsTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="3" class="muted">No workouts for this athlete.</td></tr>`}</tbody>`;
  els.workoutsPager.innerHTML = pagerHtml(workoutsPage, athleteWorkouts.length);
}

function onWorkoutRowClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest("tr.wo-row") as HTMLTableRowElement | null;
  if (!row) return;
  if (toggleCollapse(row)) return;
  const day = athleteWorkouts[Number(row.dataset.index)];
  if (!day) return;
  insertDetail(row, 3, setsTableHtml(day.sets, true));
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
function setsTableHtml(sets: readonly SetRecord[], showExercise: boolean): string {
  const formula = currentFormula();
  const exHead = showExercise ? "<th>Exercise</th>" : "";
  const head =
    `<thead><tr>${exHead}<th class="num">Set</th><th class="num">Weight</th>` +
    `<th class="num">Reps</th><th class="num">Est. 1RM</th><th class="num">Volume</th><th>Notes</th></tr></thead>`;
  const rows = sets
    .map((s) => {
      const e1rm = estimate1RM(s.weight, s.reps, formula);
      const vol = setVolume(s.weight, s.reps);
      const note = [s.dropset ? "dropset" : "", s.notes].filter(Boolean).join(" · ");
      const exCell = showExercise ? `<td>${escapeHtml(s.exerciseName)}</td>` : "";
      return (
        `<tr>${exCell}<td class="num">${s.setNumber}</td>` +
        `<td class="num">${s.weight === null ? "—" : fmt(s.weight) + " kg"}</td>` +
        `<td class="num">${s.reps === null ? "—" : s.reps}</td>` +
        `<td class="num">${e1rm === null ? "—" : fmt(e1rm) + " kg"}</td>` +
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
  const series = exerciseProgressForUser(data.records, els.athlete.value, exercise, currentFormula());
  els.progressNote.textContent =
    `Bars = sets per day · line = best estimated 1RM (${currentFormula()}) · ${series.length} session(s).`;

  const canvas = $<HTMLCanvasElement>("progressChart");
  progressChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: series.map((p) => p.date),
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

function renderAll() {
  renderLeaderboard();
  renderPersonalRecords();
  renderAthlete();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ---- Reusable custom ("physical") dropdown ----
interface DropdownItem {
  value: string;
  label: string;
}
interface Dropdown {
  value: () => string;
  setValue: (v: string) => void;
  setItems: (items: DropdownItem[]) => void;
}

function createDropdown(
  btn: HTMLButtonElement,
  menu: HTMLUListElement,
  label: HTMLElement,
  onChange: (value: string) => void,
): Dropdown {
  let value = "";
  let items: DropdownItem[] = [];

  const render = () => {
    menu.innerHTML = items
      .map(
        (it) =>
          `<li role="option" class="dropdown-item${it.value === value ? " is-selected" : ""}" ` +
          `data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</li>`,
      )
      .join("");
  };
  const open = () => {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    (menu.querySelector(".is-selected") as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
  };
  const close = () => {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  const setValue = (v: string) => {
    value = v;
    label.textContent = items.find((it) => it.value === v)?.label ?? v ?? "—";
    render();
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  menu.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>(".dropdown-item");
    if (li?.dataset.value === undefined) return;
    setValue(li.dataset.value);
    close();
    onChange(li.dataset.value);
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== btn) close();
  });

  return {
    value: () => value,
    setValue,
    setItems: (its) => {
      items = its;
      render();
    },
  };
}

let exerciseDropdown: Dropdown | undefined;
let repsDropdown: Dropdown | undefined;

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

  // Build the custom exercise + reps dropdowns.
  const exercises = distinctExercises(data.records);
  exerciseDropdown = createDropdown(els.exerciseBtn, els.exerciseMenu, els.exerciseLabel, renderLeaderboard);
  exerciseDropdown.setItems(exercises.map((e) => ({ value: e, label: e })));
  exerciseDropdown.setValue(exercises[0] ?? "");

  repsDropdown = createDropdown(els.repsBtn, els.repsMenu, els.repsLabel, renderLeaderboard);
  repsDropdown.setItems(REP_RANGES.map((r) => ({ value: r.id, label: r.label })));
  repsDropdown.setValue("all");

  els.formula.value = DEFAULT_FORMULA;

  // Populate athlete dropdown (alphabetical by display name).
  const users = distinctUsers(data.records);
  els.athlete.innerHTML = users
    .map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.user)}</option>`)
    .join("");

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

  els.formula.addEventListener("change", renderAll);
  els.excludeDropsets.addEventListener("change", renderAll);
  els.prSearch.addEventListener("input", renderPersonalRecords);
  els.athlete.addEventListener("change", renderAthlete);
  els.progressExercise.addEventListener("change", renderProgress);

  // Expand/collapse rows.
  els.athleteTable.addEventListener("click", onExerciseRowClick);
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
