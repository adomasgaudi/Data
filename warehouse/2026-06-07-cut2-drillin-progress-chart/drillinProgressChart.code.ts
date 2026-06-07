// WAREHOUSED (CUT-2, 2026-06-07): the per-exercise drill-in progression chart
// (Est. 1RM per set + Current strength line + Scaled-effort). Invisible dead
// weight — hidden in Analysis by GRAPH-2 CSS, standalone tab gone, universal
// #waGraph is the only trend chart. Restored verbatim from src/main.ts. See manifest.

// --- handle + state (main.ts module level) ---
let exerciseSvg: SvgChart | null = null; // per-exercise drill-in progress graph (SVG engine)
let exPersetBestOnly = false; // per-set range: show only each day's best set (top estimated 1RM)

// --- els entries (in the `els` object) ---
//   exerciseProgress: $("exerciseProgress"),
//   exerciseProgressNote: $("exerciseProgressNote"),   // NOTE: was also reused by saveCurrentCombine() for the "already exists" message — on removal that was switched to window.alert(); restore that too if you bring this back.
//   exerciseProgressCenter: $<HTMLButtonElement>("exerciseProgressCenter"),
//   exPersetBest: $<HTMLButtonElement>("exPersetBest"),
//   exProgCompact: $<HTMLButtonElement>("exProgCompact"),

// --- helper ---
function syncExProgCompactBtn(): void {
  const on = getTimeCompact();
  els.exProgCompact.textContent = on ? "⇄ Compacted time" : "⇄ Realistic time";
  els.exProgCompact.classList.toggle("is-active", on);
  els.exProgCompact.setAttribute("aria-pressed", String(on));
}

/** One combined per-exercise graph (drill-in). Est. 1RM (dot per set) + Current
 * strength (best 1RM so far, faded for time off) + Scaled effort (when holes). */
function renderExerciseProgressChart(exName: string) {
  const box = document.getElementById("exerciseProgressChart");
  if (!box) return;
  const formula = currentFormula();
  const username = els.athlete.value;
  const mount = (config: SvgChartConfig) => {
    if (!exerciseSvg) exerciseSvg = mountSvgChart(box, config);
    else exerciseSvg.update(config);
  };
  els.exPersetBest.hidden = false;
  els.exPersetBest.classList.toggle("is-active", exPersetBestOnly);
  els.exPersetBest.setAttribute("aria-pressed", String(exPersetBestOnly));
  syncExProgCompactBtn();

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
  const strengthRaw: { x: number; y: number; meta: string }[] = [];
  const scaledRaw: { x: number; y: number }[] = [];
  for (const s of sets) {
    const added = s.origWeight !== undefined ? (s.origWeight ?? 0) : (s.weight ?? 0);
    const e1rm = addedWeight1RM(s, formula);
    if (e1rm === null) continue;
    const reps = s.reps ?? 0;
    const base = Date.parse(s.date);
    const total = perDay.get(s.date) ?? 1;
    const idx = seenInDay.get(s.date) ?? 0;
    seenInDay.set(s.date, idx + 1);
    const frac = total > 1 ? (idx / (total - 1) - 0.5) * 0.7 : 0;
    const x = base + frac * MS_DAY;
    const meta = `${fmt(added)}×${reps} → ${fmt(e1rm)} 1RM · ${shortDate(s.date)}` + (rpeFor(s) ? ` · RIR ${rpeFor(s)}` : "");
    strengthRaw.push({ x, y: e1rm, meta });
    const nv = noteVariationScale(s) || 1;
    scaledRaw.push({ x, y: e1rm * (scaleForRecord(s) / nv) });
  }
  const strengthSorted = strengthRaw.slice().sort((a, b) => a.x - b.x);
  const hasLevels = sets.some((s) => s.levelValue !== undefined);
  const scaledPts = scaledRaw.slice().sort((a, b) => a.x - b.x).map((p) => ({ x: p.x, y: Math.round(p.y * 10) / 10 }));
  const strengthPts = decayingStrengthPoints(strengthSorted.map((p) => ({ x: p.x, y: p.y })));
  const e1rmPts = strengthSorted.map((p) => ({ x: p.x, y: Math.round(p.y * 10) / 10, meta: p.meta }));

  if (e1rmPts.length === 0) {
    els.exerciseProgress.hidden = true;
    els.exerciseProgressNote.textContent = "";
    return;
  }
  els.exerciseProgress.hidden = false;

  const series: SvgSeries[] = [
    { name: "Est. 1RM (per set)", color: "#b8902f", type: "scatter", axis: "left", points: e1rmPts },
    { name: "Current strength", color: CURRENT_STRENGTH_COLOR, type: "line", axis: "left", points: strengthPts },
  ];
  if (hasLevels)
    series.push({ name: "Scaled effort", color: "#1f8a8a", type: "scatter", axis: "left", points: scaledPts });

  mount({
    series, xKind: "time", compactable: true, noCompactToggle: true, yBeginAtZero: true,
    yUnit: "kg", insideLabels: true, height: 320,
  });
  els.exerciseProgressNote.textContent =
    "Tap a label to show/hide a view: Est. 1RM (a dot for every set) and Current strength (best 1RM so far, faded for time off). Use ⚙ for graph settings." +
    (hasLevels ? " Scaled effort = each set's real 1RM × its squat-rack hole's technique factor (tune the factors in the holes table); the real 1RM is never changed." : "") +
    (exPersetBestOnly ? " Showing each day's best set only." : "");
}

// --- also: `els.exerciseProgress.hidden = true;` at the start of the non-drill-in
//     render flow (hid the wrapper when not drilled in).

// --- event listeners (in init) ---
//   els.exerciseProgressCenter.addEventListener("click", () => { if (selectedExercise) renderExerciseProgressChart(selectedExercise); });
//   els.exPersetBest.addEventListener("click", () => { exPersetBestOnly = !exPersetBestOnly; if (selectedExercise !== null) renderExerciseProgressChart(selectedExercise); });
//   els.exProgCompact.addEventListener("click", () => { setTimeCompact(!getTimeCompact()); syncExProgCompactBtn(); });

// --- 5 call sites of renderExerciseProgressChart(...) across main.ts (drill-in render flows). ---

/* --- index.html: the whole <div id="exerciseProgress" class="exercise-progress" hidden> block ---
  <div class="ex-prog-controls"><details class="ex-prog-settings"><summary class="ex-prog-settings-sum">⚙ Settings</summary>
    <div class="ex-prog-settings-menu">
      <button type="button" id="exProgCompact" class="ex-best-toggle" aria-pressed="false">⇄ Realistic time</button>
      <button type="button" id="exPersetBest" class="ex-best-toggle" aria-pressed="false" hidden>Best set only</button>
      <button type="button" id="exerciseProgressCenter" class="ex-best-toggle" title="Center on data" aria-label="Center on data">⌖ Center on data</button>
    </div></details></div>
  <div class="ex-prog-wrap"><div id="exerciseProgressChart"></div></div>
  <p class="muted" id="exerciseProgressNote"></p>
*/
