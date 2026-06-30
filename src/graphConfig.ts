/**
 * Graph configuration layer (TASK 29). The settings that shape a graph, kept as a
 * plain data object SEPARATE from rendering — the Universal Analytics Graph reads
 * it, and future settings plug in here without touching the renderer.
 */
import type { OneRepMaxFormula, DecayParams } from "./metrics";
import type { SetRecord } from "./domain";

export interface GraphConfig {
  /** How same-interval points are combined: none = every set, else per interval. */
  aggregation: "none" | "max" | "avg" | "sum";
  /** Bucket size when aggregating (volume/counts bars + aggregation). The month-multiples
   *  (quarter = 3 mo, halfyear = 6 mo, year = 12 mo) read longer-range volume; 2d–5d are
   *  fixed multi-day windows between Day and Week. */
  interval: "day" | "2d" | "3d" | "4d" | "5d" | "week" | "biweek" | "month" | "quarter" | "halfyear" | "year";
  /** Moving-average window in points (0 = off). */
  smoothing: number;
  /** Apply the strength-fade (detraining) model to strength metrics. */
  decay: boolean;
  /** The strength-decay MODEL to use (complexity level + its variables) for the
   *  Strength Decay metric and the `decay` fade. Omitted = the shipped full model. */
  decayParams?: DecayParams | undefined;
  /** 1RM formula for the strength/1RM metrics (matches the app-wide choice). */
  formula: OneRepMaxFormula;
  /** Rolling WINDOW (ms) over which the (non-decay) Strength line takes the best top set:
   * at each date it's the max e1RM within the last `strengthWindow`. Undefined / Infinity =
   * all-time (the legacy running-max that never drops). Smaller = the line tracks recent best
   * and can fall when you haven't beaten it lately. */
  strengthWindow?: number | undefined;
  /** REPS-VERSUS-WEIGHT mode: swap the graph to a scatter of every set at
   * (x = weight kg, y = reps) per exercise, instead of the time-series metrics. */
  repsVsWeight?: boolean;
  /** Draw a per-exercise least-squares best-fit line on the reps-vs-weight scatter. */
  repsVsWeightFit?: boolean;
  /** How far ahead the Predicted Strength metric projects, in days. */
  predictionDays: number;
  /** What logged points feed the projection fit:
   *  "records" = the running-max (PR) e1RM line (smooth lifetime trend, default),
   *  "hard"    = only hard sets' e1RM (near-failure effort),
   *  "all"     = every working set's e1RM.
   *  Warm-ups (clearly submaximal) are ALWAYS excluded, whatever the basis. */
  projectionBasis: "records" | "hard" | "all";
  /** Optional fit WINDOW (ms timestamps): only sets logged within [from, to] feed the
   * projection fit — the draggable vertical lines on the graph. Undefined = no bound. */
  projectionFrom?: number | undefined;
  projectionTo?: number | undefined;
  /** Fill opacity (0..1) for bar series (e.g. Volume), so they don't hide other
   * series. Default 0.6 — a touch more solid than the scatter dots. */
  opacity: number;
  /** Right-axis height scale: 1 = auto; >1 makes the right-axis series (counts /
   * volume) sit shorter, <1 makes them taller — a relative-axis knob. */
  rightHeadroom: number;
  /** Shift ONLY the Volume / Volume Load bars UP or DOWN, as a fraction of the
   * plot height (+ = up, − = down, 0 = on the floor). Both series share the same
   * dates as the 1RM lines, so a horizontal shift is meaningless — this vertical
   * offset lifts the bars off the strength line so the two don't overlap. */
  volumeYShift: number;
  /** Bar girth multiplier (≈0.5–3, default 1): scales the width of every bar so the
   * user can fatten thin grouped bars or slim them down. */
  barGirth: number;
  /** SPREAD (in DAYS, 0..~9.8) of a session's sets on the per-set / Weight-Range
   * views: how far the fan extends forward from the session's day. 0 = stacked on one
   * line, ~0.9 = across its own day, up to ~10 = fanned over several days (best read
   * in realistic-time mode). Lets the user pick how separated same-day sets look.
   * Default 0.9. */
  spread: number;
  /** Render-time hook (NOT a persisted setting): a per-set reps-in-reserve
   * resolver the app injects so the scatter can size each dot by effort — higher
   * RIR (easier) draws smaller, the hardest stay biggest. Absent = uniform dots. */
  rirOf?: (r: SetRecord) => number | null;
  /** Render-time hook (NOT persisted): resolves the projection's flattening CEILING
   * (kg) for a group's records — the user's Potential ceiling if set, else the
   * exercise's world-record level. Null = no ceiling known → the projection falls
   * back to the plain log fit. */
  ceilingOf?: (records: readonly SetRecord[]) => number | null;
  /** "Lifetime potential" log view: when on, the LEFT (strength/kg) axis is spaced by
   *  −ln(ceiling − value), so an exponential approach to the ceiling reads as a straight
   *  line. A real plateau still flattens; continued gains keep rising. Single ceiling for
   *  now (one athlete). Off / undefined = normal linear axis. */
  potentialLog?: boolean | undefined;
  /** The lifetime-potential ceiling (kg) the log view converges on. */
  potentialCeiling?: number | undefined;
  /** EXPERIMENTAL "native log": instead of re-spacing the axis, transform each data
   * POINT's value to −ln(ceiling − value) and plot THAT on a normal linear axis (so the
   * plotted numbers themselves become the log values). Off / undefined = normal. */
  potentialNativeLog?: boolean | undefined;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  aggregation: "none",
  interval: "week",
  smoothing: 0,
  decay: false,
  formula: "epley",
  predictionDays: 90,
  projectionBasis: "records",
  opacity: 0.6,
  rightHeadroom: 1,
  volumeYShift: 0,
  barGirth: 1,
  spread: 0.9,
};
