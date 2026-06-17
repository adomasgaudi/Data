# On-screen debug console (`dbg()`) — the mobile-debug tool

**Why this exists.** The owner runs the site on a **phone** (Brave/Android). Phones have **no
devtools console**, so the usual "add a `console.log` and read it" loop is impossible. Instead
we paint debug lines to a **fixed green panel on screen**, and the owner sends ONE screenshot
that shows exactly what happened. This is what finally cracked **PB-38** (the tab menu that
"didn't work" through ~5 wrong fixes) — see `docs/persistent-bugs.md`.

> Owner, after it worked: *"#super persistent and #max debug worked — keep the green console
> and write a md to help other ais use it."* This is that md.

## What it is

`dbg(msg: string, isErr = false)` in `src/main.ts`:
- appends a timestamped line to a fixed panel, **bottom-left**, `z-index` max — **green** for normal trace, **red** for errors (`isErr` / the auto error-capture below);
- keeps the **last ~9 lines** (older ones scroll off);
- **tap the panel to clear it**;
- also reachable as **`window.dbg("…")`** (handy from a desktop console, or any module).

**Uncaught errors show automatically.** `window.error` and `unhandledrejection` handlers feed `dbg(…, true)`, so any JS crash or rejected promise paints a **red** line on-device (the owner can screenshot a phone crash that would otherwise be invisible).

It's on by default. To silence it: `localStorage.setItem("colosseum.dbg","off")` then reload.

## How to use it (the method that works)

This is the `#debug` / `#super-persistent` discipline made concrete:

1. **Stop guessing.** When a fix keeps failing, do NOT ship another speculative patch.
2. **Instrument EVERY step of the failing flow**, not just the one you suspect. Drop a `dbg()`
   at each hop: the event firing, each branch taken, each value read, every early-return. The
   bug is almost always at the step whose REAL value contradicts your mental model — logging
   every step is what surfaces that contradiction.
3. **Make the contradiction visible.** Include the runtime facts you're unsure about in the
   message — which element, which handler, what state. Example from PB-38:

   ```ts
   dbg(`⋯ tap (panel) → ${document.getElementById("dashTabMenu") ? "close" : "open"}`);
   dbg(`menu OPEN (in <body>, ${m.querySelectorAll("[data-tabmenu]").length} items)`);
   dbg(`menu ACTION ${act} (doc) ✓`);   // ← this line NOT appearing = the click never reached here
   ```

   The screenshot showed `⋯ tap` and `menu OPEN` but the **action line only appeared once the
   handler was moved to `document`** — proving the click had been landing outside the
   `panel`-scoped handler all along. Root found in one round.
4. **Ship it and ask the owner for a screenshot.** Read the lines; the missing/contradictory
   line is your bug. Fix the root, keep `dbg()` until the owner confirms on device.

## Conventions

- Keep messages **short** (the panel is narrow): `area ACTION detail ✓/✗`.
- Mark success/failure visibly (`✓`, `✗`) so a glance at the screenshot is enough.
- Prefer logging **where a click is RECEIVED** (which listener) vs only where it's emitted —
  delegated-handler scope bugs (PB-38) are invisible otherwise.

## Cleanup

`dbg()` calls are debugging aids — remove the instrumentation once a bug is confirmed fixed,
**unless the owner asks to keep the console** (they did, b.2.9.51). The `dbg()` function itself
stays as a reusable tool. Don't leave noisy per-frame logging in hot render paths.

## Lesson banked from PB-38

A delegated click handler **only sees clicks inside the element it's bound to**. Never append a
floating menu/popup to `document.body` and expect a container-scoped (`panel`/section) handler
to catch its clicks — bind the handler to `document`, or append the menu inside the handler's
element. The on-screen console is what made that invisible scope mismatch obvious.
