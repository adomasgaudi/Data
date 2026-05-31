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
  filterRecords,
  leaderboard,
  personalRecords,
  type LeaderboardEntry,
  type PersonalRecord,
} from "./aggregate";
import { estimate1RM, setVolume, type OneRepMaxFormula } from "./metrics";
import { DEFAULT_FORMULA } from "./config";

Chart.register(...registerables);

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const els = {
  status: $("status"),
  exercise: $<HTMLSelectElement>("exercise"),
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
};

let data: LoadedData;
let lbChart: Chart | null = null;

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

function currentFormula(): OneRepMaxFormula {
  return els.formula.value === "brzycki" ? "brzycki" : "epley";
}

function renderStatus() {
  const users = distinctUsers(data.records).length;
  let html = `${data.records.length.toLocaleString()} sets · ${users} athletes`;
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
  const exercise = els.exercise.value;
  const formula = currentFormula();
  const filtered = filterRecords(data.records, {
    excludeDropsets: els.excludeDropsets.checked,
    requireWeightAndReps: true,
  });
  const entries = leaderboard(filtered, exercise, formula);

  els.lbTitle.textContent = `Leaderboard — ${exercise} (est. 1RM, ${formula})`;
  renderLeaderboardTable(entries);
  renderLeaderboardChart(entries);
}

function renderLeaderboardTable(entries: LeaderboardEntry[]) {
  const head = `<thead><tr><th class="rank">#</th><th>Athlete</th><th class="num">Est. 1RM</th><th class="num">Best set</th><th class="num">Date</th></tr></thead>`;
  const rows = entries
    .map(
      (e, i) =>
        `<tr><td class="rank ${i === 0 ? "rank-1" : ""}">${i + 1}</td><td>${escapeHtml(e.user)}</td>` +
        `<td class="num">${fmt(e.e1rm)} kg</td><td class="num">${fmt(e.weight)}×${e.reps}</td><td class="num">${e.date}</td></tr>`,
    )
    .join("");
  els.lbTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="5" class="muted">No data for this exercise.</td></tr>`}</tbody>`;
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
          backgroundColor: entries.map((_, i) => (i === 0 ? "#ffd166" : "#4f9dff")),
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
        x: { grid: { color: "#2a2f3a" }, ticks: { color: "#9aa3b2" } },
        y: { grid: { display: false }, ticks: { color: "#e6e8ec" } },
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

// Exercise names for the currently shown athlete, in displayed row order.
// Lets the (delegated) click handler map a clicked row back to its exercise.
let athleteExercises: string[] = [];

function renderAthlete() {
  const username = els.athlete.value;
  const label = els.athlete.options[els.athlete.selectedIndex]?.text ?? username;
  const counts = exerciseCountsForUser(data.records, username);
  const totalSets = counts.reduce((sum, c) => sum + c.count, 0);
  athleteExercises = counts.map((c) => c.exerciseName);

  els.athleteTitle.innerHTML =
    `${escapeHtml(label)} — exercises by sets ` +
    `<span class="muted">(${counts.length} exercises · ${totalSets.toLocaleString()} sets · tap a row for all sets)</span>`;

  const head = `<thead><tr><th class="rank">#</th><th>Exercise</th><th class="num">Sets</th></tr></thead>`;
  const rows = counts
    .map(
      (c, i) =>
        `<tr class="ex-row" data-index="${i}"><td class="rank ${i === 0 ? "rank-1" : ""}">${i + 1}</td>` +
        `<td><span class="caret">▸</span>${escapeHtml(c.exerciseName)}</td>` +
        `<td class="num">${c.count.toLocaleString()}</td></tr>`,
    )
    .join("");
  els.athleteTable.innerHTML =
    head + `<tbody>${rows || `<tr><td colspan="3" class="muted">No exercises for this athlete.</td></tr>`}</tbody>`;
}

/** Expand/collapse the set-by-set detail under a clicked exercise row. */
function onAthleteTableClick(e: MouseEvent) {
  const row = (e.target as HTMLElement).closest("tr.ex-row") as HTMLTableRowElement | null;
  if (!row) return;
  const next = row.nextElementSibling;
  if (next && next.classList.contains("detail-row")) {
    next.remove();
    row.classList.remove("open");
    return;
  }
  const exerciseName = athleteExercises[Number(row.dataset.index)];
  if (exerciseName === undefined) return;
  const detail = document.createElement("tr");
  detail.className = "detail-row";
  detail.innerHTML = `<td colspan="3">${setsDetailHtml(els.athlete.value, exerciseName)}</td>`;
  row.insertAdjacentElement("afterend", detail);
  row.classList.add("open");
}

/** Inner table: every set for this athlete+exercise with calculated values. */
function setsDetailHtml(username: string, exerciseName: string): string {
  const formula = currentFormula();
  const sets = setsForUserExercise(data.records, username, exerciseName);
  const head =
    `<thead><tr><th>Date</th><th class="num">Set</th><th class="num">Weight</th>` +
    `<th class="num">Reps</th><th class="num">Est. 1RM</th><th class="num">Volume</th><th>Notes</th></tr></thead>`;
  const rows = sets
    .map((s) => {
      const e1rm = estimate1RM(s.weight, s.reps, formula);
      const vol = setVolume(s.weight, s.reps);
      const note = [s.dropset ? "dropset" : "", s.notes].filter(Boolean).join(" · ");
      return (
        `<tr><td>${s.date}</td><td class="num">${s.setNumber}</td>` +
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

function renderAll() {
  renderLeaderboard();
  renderPersonalRecords();
  renderAthlete();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function init() {
  try {
    data = await loadData();
  } catch (err) {
    els.status.innerHTML = `<span class="badge warn">Failed to load data</span> ${escapeHtml(String(err))}`;
    return;
  }

  // Populate exercise dropdown (sorted, most-popular default chosen as the first).
  const exercises = distinctExercises(data.records);
  els.exercise.innerHTML = exercises.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
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

  els.exercise.addEventListener("change", renderLeaderboard);
  els.formula.addEventListener("change", renderAll);
  els.excludeDropsets.addEventListener("change", renderAll);
  els.prSearch.addEventListener("input", renderPersonalRecords);
  els.athlete.addEventListener("change", renderAthlete);
  els.athleteTable.addEventListener("click", onAthleteTableClick);
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
    });
  }
}

void init();
