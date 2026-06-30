# Ultra-bugs (UB-n) — defied every fix, PARKED on purpose

A tier ABOVE `docs/persistent-bugs.md` (PB-n). An ultra-bug is one that survived
MANY fix attempts across MANY turns/sessions AND where the AI's mental model and
the live behaviour still disagree — so continuing to patch it burns time for no
gain. The rule for these: **STOP, write down everything found + everything tried,
and park it** (owner: "stop this bug, log everything … and let's forget it for
now"). Pick it back up later with fresh eyes and the "NEXT TIME" checklist below.

---

## UB-1 — Dashboard graph pan/zoom "doesn't persist" (yet the trace says it DOES)

- **Owner symptom:** on the Analysis → Graph dashboard, zoom/scroll (pan/pinch) a
  graph; after switching bubble / switching tab / refreshing / or just idling a
  second or two, it "snaps back" and doesn't keep the view. Reported repeatedly
  across many sessions. Tags used: `#super-persistent`, `#max-debug`, `#debug`.
- **Device/browser:** Samsung Android, Brave. (Same device as every other report.)
- **Cross-ref:** `docs/persistent-bugs.md` → PB-39 (full attempt-by-attempt log).

### What the on-screen trace ACTUALLY shows (the paradox)
Full step-by-step `dbg()` instrumentation of the whole path (renderGraphDashboard
`reuse=Y/n` · analyticsGraph `MOUNT|UPDATE` · svgChart `mount`/`update`/`resetView`
/`panStart`/`panEnd` · `vSAVE`/`vMOUNT init=Y/n`) showed the mechanism WORKING:
- A pan fires `svgc panEnd flush x=20142..20818` then `vSAVE box sig=…` — the view
  IS captured on gesture end.
- Switching away and back: the bubble mounts `init=Y x=20142..20818` — i.e. the
  EXACT panned box is restored (sig matched, `initialView` applied). Verified with
  matching before/after numbers in one capture (pan→save 20142..20818, later
  restore 20142..20818).
- Same-bubble re-renders run `aG UPDATE … userAdj=Y x=<same>` — the live view is
  KEPT (not reset).
- The only `resetView` lines that wipe the view are `svgc update seriesChg=Y
  userAdj=n x=0..0` — updates on EMPTY data (x=0..0), i.e. a chart with no series
  yet (load/transition), not the populated dashboard graph.

So in the logs: save ✓, persist (per-athlete localStorage) ✓, restore-on-switch ✓,
hold-across-re-render ✓. The AI could NOT reproduce the owner's "snaps back" from
the traces — they show success. That contradiction is why this is parked.

### Every fix attempted (none resolved the owner's perception)
1. **CHART-171 / b.2.9.41** — added svgChart `initialView` + debounced
   `onViewChange`, and a per-bubble `savedView = { sig, box }` restored on mount
   while a content `sig` (type·view·×BW·lifts·metrics·time-compaction·athlete)
   matches. Didn't hold.
2. **CHART-178 / b.2.9.54** — on-screen `vSAVE` / `vMOUNT have/want init=Y|n` /
   `vDIFF` diagnostics (find where the chain breaks).
3. **CHART-180 / b.2.9.59** — `flushView()` on pointer-up: persist the view the
   instant a pan/zoom ENDS (not only on the 250 ms debounce), so a re-mount can't
   beat the save. Didn't hold.
4. **CHART-181 / b.2.9.64** — preserve the `#gdashStage` element across SAME-bubble
   re-renders (reuse the chart via `update()` instead of a fresh mount); only a
   real bubble switch (`dashStageBubbleId`) fresh-mounts. Didn't hold.
5. **CHART-184 / b.2.9.72** — `svgChart.update()` now HONORS `initialView` (restore
   the saved box instead of `resetView` when the user isn't mid-pan), mirroring the
   mount path — because the dashboard sends a fresh series every render so
   `seriesChanged` is always true and update used to blindly re-fit. Didn't hold.
6. **CHART-182/183 / b.2.9.66, b.2.9.69** — progressively heavier path tracing
   (rGD reuse · aG mount/update · svgc mount/update/resetView · panStart/panEnd ·
   schedWG) so one screenshot reveals the diverging step.
7. **META-196 / b.2.9.81** — debug console auto-scrolls to TOP (owner UX ask).

### Leading theories (unconfirmed)
- **(a) Stale cache / deploy lag** — the owner may be testing a version from BEFORE
  the latest fix deployed (Netlify rebuild lag). The live version number was never
  confirmed on-device per test. `#super-persistent` step 5 (device-cache check) is
  the FIRST thing to settle next time.
- **(b) Perception vs reality / wrong gesture** — every saved x-span is WIDE
  (~94–676 days); the owner may be trying to PINCH-ZOOM TIGHT (e.g. one month) and
  the view never gets tight, so it "looks" broken even though x-pan persists.
  Possibly the pinch-zoom gesture is weak/clamped, or the Y-axis zoom doesn't
  persist while X does. NOT YET separated: pan vs pinch-zoom vs Y-zoom.
- **(c) Stateful machinery is the fragile part (rule 55, debug-by-contrast)** — the
  per-bubble fields that DO persist on a bubble switch (exercises, metrics, type,
  view, ×BW) are re-applied as DATA INPUTS every render; the view is the ONLY one
  pushed through chart-internal state (`resetView`/`userAdjusted`/`initialView`).
  Spurious empty-data (`x=0..0`) updates `resetView` when `userAdjusted` is false.

### Code left IN PLACE (tested, harmless, possibly partial fixes)
`flushView()` (svgChart), the `#gdashStage` reuse + `dashStageBubbleId`
(renderGraphDashboard), and `update()`-honors-`initialView` (svgChart) are KEPT —
they pass 630+ tests, don't break anything, and are defensible improvements. The
heavy `dbg()` trace lines added during the hunt were REMOVED when parking (they
spammed the console on every render).

### NEXT TIME — start here (don't re-patch blind)
1. **Confirm the live version on device FIRST** (rule out stale cache) — have the
   owner read the version chip; only debug once it shows the build under test.
2. **Separate the gesture:** is it PAN (1-finger drag), PINCH-ZOOM, or Y-axis zoom
   that fails? Test each alone. The traces only ever captured small x-pans.
3. **Watch a TIGHT zoom:** does pinch actually produce a narrow range, or is the
   gesture/zoom clamped? (Maybe the bug is the zoom gesture, not persistence.)
4. **Debug by contrast (rule 55):** make `savedView` behave like the working
   siblings — a pure input re-applied deterministically each render — instead of
   going through the `userAdjusted` gate, and see if that removes the fragility.
5. Re-add the `dbg()` path trace (vSAVE/vMOUNT/svgc mount-update-resetView/panEnd)
   only for the SPECIFIC failing gesture, and read which single step diverges.
