// WAREHOUSED (CUT-2, 2026-06-07): the legacy "Sets over time" chart from the
// Workouts panel. It was invisible dead weight — hidden in Analysis by the GRAPH-2
// CSS and the standalone Workouts tab is gone, so the universal #waGraph is the
// only trend chart. Restored verbatim from src/main.ts. See manifest.json.

// --- module-level handle (was in main.ts, with the other chart handles) ---
let workoutSetsSvg: SvgChart | null = null; // Workouts view: all sets over time (SVG engine)

// --- els entry (was in the `els` object in main.ts) ---
//   workoutSetsNote: $("workoutSetsNote"),

// --- the render function (was in main.ts) ---
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
    g.points.push({ x: ts(s.date), lo: added, hi: e1rm, meta: `${displayName(s.exerciseName)} ×${s.reps ?? 0}` });
  }
  const order = [...ranked.filter((n) => groups.has(n)), ...(groups.has("Other") ? ["Other"] : [])];
  const series: SvgSeries[] = order.map((label) => ({ name: label, color: groups.get(label)!.color, type: "range", points: groups.get(label)!.points }));

  const config = { series, xKind: "time" as const, compactable: true, yBeginAtZero: true, yUnit: "kg", insideLabels: true, height: 300 };
  if (!workoutSetsSvg) workoutSetsSvg = mountSvgChart(box, config);
  else workoutSetsSvg.update(config);
  els.workoutSetsNote.textContent =
    `Every set's weight → its own estimated 1RM (${formula}), coloured per exercise. Drag to pan · wheel to zoom · tap a bar.`;
}

/* --- index.html DOM that was inside <details id="workoutSets"> (the wrapper itself
   was kept as the calendar's relocation anchor) ---
      <summary class="workout-sets-summary">Sets over time <span class="ws-caret">▾</span></summary>
      <div class="workout-sets-body">
        <div id="workoutSetsChart"></div>
        <p class="muted" id="workoutSetsNote" style="margin: 0.25rem 0 0; font-size: 0.8rem"></p>
      </div>
*/
