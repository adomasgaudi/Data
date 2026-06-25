# Debugging & coding-assistance tools — graded for THIS app

> `#research` for the owner's ask "create a CSS viewer + research other debugging/coding tools."
> Each entry GRADED (High / Moderate / Low / Very Low) **re-judged for an AI-maintained,
> single-file (vite-singlefile), phone-first dashboard** — not for a human dev team. The app
> inlines into ONE `index.html`, so anything heavy must load ON DEMAND (CDN), never bundle.

## On-screen element / CSS inspectors (the direct ask)

- **eruda — SHIPPED (admin Settings → 🔍 Inspect (CSS)).** GRADE: **High.** A full mobile
  devtools overlay: Elements panel with the live box model (padding / margin / border / size) +
  computed styles + a tap-to-pick pointer, plus Console / Network / Resources / Sources / Info.
  One CDN script, `eruda.init()`. Loaded from CDN only when the admin toggles it, so the
  single-file deliverable stays lean (~3.87 MB) — bundling it added ~0.7 MB for everyone.
- **vConsole (Tencent).** GRADE: **Moderate.** Lighter, console/network/storage-focused; weaker
  element inspector (no real box-model view). Pick only if eruda feels heavy — but the box model
  is exactly what the owner wanted, so eruda wins here.
- **Chrome remote debugging (`chrome://inspect`).** GRADE: **Low (for this workflow).** The real
  DevTools, but needs a USB cable + a desktop Chrome. The owner debugs FROM the phone via
  screenshots, so a tethered tool doesn't fit the loop.
- **Weinre.** GRADE: **Very Low.** Deprecated / unmaintained — eruda superseded it.

## eruda plugins (cheap drop-in add-ons, same CDN pattern)

- **eruda-fps** (frame-rate), **eruda-timing** (perf / resource timing), **eruda-memory**,
  **eruda-features**. GRADE: **Moderate.** Add one line each only if a specific metric is needed
  (e.g. fps for the snappy-render work, SNAP-*). Not loaded by default.

## Home-grown tools we already have (keep using)

- **On-screen `dbg()` console** (rule 51). GRADE: **High.** Green overlay; instrument a failing
  flow step-by-step, one screenshot shows where it breaks. The control-flow debugger.
- **CSS box-viewer outlines** (rule 68). GRADE: **High.** Outline candidate containers in distinct
  colours to find which box owns a gap/overflow. The box-model debugger (now superseded for ad-hoc
  use by eruda's Elements panel, but still the fastest "which box?" answer in one screenshot).

## Broader coding-assistance ideas (ranked by payoff for this app)

- 🟠 **Runtime error → on-screen toast (`window.onerror` / `unhandledrejection`).** GRADE: **High.**
  The owner can't see the JS console, so an uncaught error is invisible — it just looks "frozen."
  Capture it into the `dbg()` overlay (or a toast) so a crash self-reports. Cheap, high value.
- 🟠 **Build source maps (`build.sourcemap: true` in Vite).** GRADE: **High.** Makes eruda's
  Sources/stack traces readable instead of minified soup. Small build-size cost (separate `.map`,
  not inlined), big debugging payoff.
- 🟢 **`?debug=1` URL flag.** GRADE: **Moderate.** Auto-init eruda + the dbg console from a query
  param, so a "debug me" link opens already-instrumented — no digging into admin Settings.
- 🟢 **Visual-regression screenshots (Playwright — already installed).** GRADE: **Moderate–High.**
  The app's #1 bug class is UI overflow / wasted space (PB-24/48/49/52). A tiny Playwright script
  that screenshots key views at 360 px and diffs against a baseline would catch the "out of bounds"
  family automatically. Some setup; pairs with the space-efficiency rubric.
- 🟢 **Static lint (ESLint or Biome).** GRADE: **Moderate.** Catch dead code (#prune), unused vars,
  and obvious bugs before commit. Biome is fast + zero-config; ESLint is more thorough. Either adds
  a pre-commit signal the Stop hook could surface.

## Recommendation (one action)

eruda is shipped — that covers the box-model ask. The single highest-payoff NEXT add is the
**runtime-error → on-screen toast** (🟠 High): the owner literally cannot see crashes today, and
it's a few lines wiring `window.onerror` into the existing `dbg()` overlay.
